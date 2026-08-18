import { PieChart, TrendingUp, TrendingDown, Wallet, Percent, Download } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';
import { CHART_COLOR_FALLBACK, buildSectorColorMap } from '../lib/chartColors';

/**
 * supabase-js types a to-one embed as an array; PostgREST returns a single object
 * (or null). Accept either so the code is correct whichever shape the client hands
 * back, instead of asserting one and being wrong about the other.
 */
type Embedded<T> = T | T[] | null | undefined;

function embeddedOne<T>(rel: Embedded<T>): T | undefined {
  return Array.isArray(rel) ? rel[0] : rel ?? undefined;
}


function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

interface PortfolioSummary {
  totalValue: number;
  totalGainLoss: number;
  percentChange: number;
  cashBalance: number;
}

interface SectorRow {
  sector: string;
  value: number;
  percentage: number;
  color: string;
}

interface EntityRow {
  name: string;
  value: number;
  percentage: number;
  shares: number;
}

interface PerformerRow {
  ticker: string;
  name: string;
  gainLoss: number;
  percentage: number;
}

/**
 * Paint the sector rows from the shared chart palette, so a sector reads the same
 * here as it does on the dashboard.
 *
 * Replaces a sector-name -> Tailwind-class table plus an index-keyed fallback.
 * Sector names are user data, maintained on the Sector Types screen and never
 * seeded, so the table only ever matched the handful of names its author wrote
 * down; everything else landed on the fallback list, which itself contained two
 * greys. The rows are also sorted by value, so the fallback's index key repainted
 * the list whenever a price moved.
 */
function sectorBarColors(sectors: string[]): Map<string, string> {
  return buildSectorColorMap(sectors.map(sector => ({ sector })));
}

function fmtSignedCurrency(value: number): string {
  const prefix = value >= 0 ? '+Rs. ' : '-Rs. ';
  return `${prefix}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtSignedPercent(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

export function Portfolio() {
  const [loading, setLoading] = useState(true);
  const [portfolioData, setPortfolioData] = useState<PortfolioSummary>({
    totalValue: 0,
    totalGainLoss: 0,
    percentChange: 0,
    cashBalance: 0,
  });
  const [sectorAllocation, setSectorAllocation] = useState<SectorRow[]>([]);
  const [entityBreakdown, setEntityBreakdown] = useState<EntityRow[]>([]);
  const [topPerformers, setTopPerformers] = useState<PerformerRow[]>([]);
  const [bottomPerformers, setBottomPerformers] = useState<PerformerRow[]>([]);
  const [entities, setEntities] = useState<{ id: string; name: string }[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchPortfolioData = useCallback(async (entityId?: string) => {
    setLoading(true);
    try {
      // The window is part of the cache identity. Without it a batch computed
      // for one date range would be served for another, silently.
      const scope = [entityId || 'all', fromDate || '-', toDate || '-'].join('|');

      // ── Compute source hash (same fingerprint as ShareAnalytics) ─────────
      const [bsnMax, txnMax, obMax, divMax, priceMax, scripMax, shareMax, entMax] = await Promise.all([
        supabase.from('buy_sell_notes').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('transactions').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('entity_share_opening_balances').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('dividends').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('daily_share_prices').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('scrip_entries').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('shares').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('entities').select('updated_at').order('updated_at', { ascending: false }).limit(1),
      ]);

      const fingerprint = [
        bsnMax.data?.[0]?.updated_at   ?? '0',
        txnMax.data?.[0]?.updated_at   ?? '0',
        obMax.data?.[0]?.updated_at    ?? '0',
        divMax.data?.[0]?.updated_at   ?? '0',
        priceMax.data?.[0]?.updated_at ?? '0',
        scripMax.data?.[0]?.updated_at ?? '0',
        shareMax.data?.[0]?.updated_at ?? '0',
        entMax.data?.[0]?.updated_at   ?? '0',
      ].join('|');
      const sourceHash = btoa(fingerprint).replace(/[/+=]/g, '');

      // ── Check portfolio_cache for a matching batch ───────────────────────
      const { data: existing } = await supabase
        .from('portfolio_cache')
        .select('source_hash')
        .eq('scope', scope)
        .eq('source_hash', sourceHash)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { data: cached, error: cacheErr } = await supabase
          .from('portfolio_cache')
          .select('*')
          .eq('scope', scope)
          .eq('source_hash', sourceHash)
          .order('section', { ascending: true })
          .order('sort_order', { ascending: true });
        if (cacheErr) throw cacheErr;

        if (cached) {
          let totalValue = 0, totalGainLoss = 0, percentChange = 0, cashBalance = 0;
          const sectors: SectorRow[] = [];
          const entities_: EntityRow[] = [];
          const tops: PerformerRow[] = [];
          const bottoms: PerformerRow[] = [];

          for (const c of cached) {
            if (c.section === 'summary') {
              if (c.label === 'totalValue') totalValue = Number(c.value) || 0;
              if (c.label === 'totalGainLoss') totalGainLoss = Number(c.value) || 0;
              if (c.label === 'percentChange') percentChange = Number(c.value) || 0;
              if (c.label === 'cashBalance') cashBalance = Number(c.value) || 0;
            } else if (c.section === 'sector') {
              // Colour is filled in below, once every sector name is known.
              sectors.push({
                sector: c.label, value: Number(c.value) || 0,
                percentage: Number(c.percentage) || 0,
                color: CHART_COLOR_FALLBACK,
              });
            } else if (c.section === 'entity') {
              entities_.push({
                name: c.label, value: Number(c.value) || 0,
                percentage: Number(c.percentage) || 0,
                shares: Number(c.extra_value) || 0,
              });
            } else if (c.section === 'performer') {
              const pr: PerformerRow = {
                ticker: c.label, name: c.label_2 || '—',
                gainLoss: Number(c.value) || 0,
                percentage: Number(c.percentage) || 0,
              };
              if (c.is_top_performer) tops.push(pr);
              else bottoms.push(pr);
            }
          }

          const cachedSectorColors = sectorBarColors(sectors.map(s => s.sector));
          setPortfolioData({ totalValue, totalGainLoss, percentChange, cashBalance });
          setSectorAllocation(sectors.map(s => ({
            ...s,
            color: cachedSectorColors.get(s.sector) ?? CHART_COLOR_FALLBACK,
          })));
          setEntityBreakdown(entities_);
          setTopPerformers(tops);
          setBottomPerformers(bottoms);

          // Still need entities list for the dropdown
          const { data: entData } = await supabase.from('entities').select('id, name');
          setEntities((entData || []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })));
          return;
        }
      }

      // ── Cache miss: read holdings from share_analytics_cache ─────────────
      // The last row of each entity-share group has the final cumulative values.
      //
      // Ordered by row_index, the order the rows were actually computed in, and
      // paged so the read is not truncated at db-max-rows.
      //
      // trade_date cannot order this. A buy and a sell on one day tie, and the
      // tie was broken arbitrarily -- land the buy last and the group reports a
      // balance inflated by the whole sale, because the sell that cancelled it
      // is no longer the final row.
      const analyticsRows = await selectAll(() =>
        supabase
          .from('share_analytics_cache')
          .select('entity_id, share_id, entity_name, share_ticker, share_name, share_cum_bal, av_cost, market_value, cum_dividend, trade_date, source_hash')
          .order('entity_name', { ascending: true })
          .order('share_ticker', { ascending: true })
          .order('row_index', { ascending: true })
          .order('id', { ascending: true }),
      );

      // If share_analytics_cache is empty or the hash doesn't match, we need
      // to fall back to computing from source tables directly.
      const analyticsHash = analyticsRows?.[0]?.source_hash;
      const cacheValid = analyticsRows && analyticsRows.length > 0 && analyticsHash === sourceHash;

      if (cacheValid) {
        // Build holdings from the last row of each entity-share group
        const lastRowMap = new Map<string, { held: number; cost: number; marketValue: number; dividends: number; entity_id: string; share_id: string; entity_name: string; share_ticker: string; share_name: string }>();
        /*
          The end date truncates; the start date does not.

          Every row carries the cumulative state after it, so ignoring rows
          traded after the end date leaves the last surviving row holding the
          position exactly as it stood that day. Skipping rows *before* a start
          date would instead hide the purchases the position is built from, and
          the holding would report a balance it has no record of acquiring.

          The one figure a start date can honestly scope is dividends, which
          accumulate: period dividends are the running total at the end of the
          window minus the total already banked before it opened.
        */
        const dividendsBefore = new Map<string, number>();
        for (const r of analyticsRows) {
          if (entityId && r.entity_id !== entityId) continue;
          if (toDate && r.trade_date && r.trade_date > toDate) continue;
          const key = `${r.entity_id}__${r.share_id}`;

          if (fromDate && r.trade_date && r.trade_date < fromDate) {
            dividendsBefore.set(key, Number(r.cum_dividend) || 0);
          }

          // Ordered by row_index, so the last entry is the final computed state
          lastRowMap.set(key, {
            held: Number(r.share_cum_bal) || 0,
            cost: Number(r.av_cost) || 0,
            marketValue: Number(r.market_value) || 0,
            dividends: (Number(r.cum_dividend) || 0) - (dividendsBefore.get(key) ?? 0),
            entity_id: r.entity_id, share_id: r.share_id,
            entity_name: r.entity_name, share_ticker: r.share_ticker, share_name: r.share_name,
          });
        }

        // Aggregate
        let totalValue = 0, totalCost = 0, totalGainLoss = 0;
        const sectorMap = new Map<string, number>();
        const entityHoldMap = new Map<string, { value: number; shares: number; name: string }>();
        const performers: PerformerRow[] = [];

        // We need sector info from shares table
        const { data: sharesData } = await supabase
          .from('shares')
          .select('id, ticker, share_name, sector, sector_types(sector_name)')
          .eq('is_active', true);
        const shareSectorMap = new Map<string, string>();
        (sharesData || []).forEach((s: {
          id: string;
          sector?: string;
          sector_types?: Embedded<{ sector_name: string }>;
        }) => {
          shareSectorMap.set(
            s.id,
            embeddedOne(s.sector_types)?.sector_name || s.sector || 'Other',
          );
        });

        const { data: entData } = await supabase.from('entities').select('id, name, current_balance');
        let cashBalance = 0;
        (entData || []).forEach((e: { id: string; name: string; current_balance: number }) => {
          if (!entityId || e.id === entityId) cashBalance += Number(e.current_balance) || 0;
        });
        setEntities((entData || []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })));

        lastRowMap.forEach((h, _key) => {
          if (h.held <= 0) return;
          totalValue += h.marketValue;
          totalCost += h.cost;
          const gainLoss = h.marketValue - h.cost + h.dividends;
          totalGainLoss += gainLoss;
          const pct = h.cost > 0 ? (gainLoss / h.cost) * 100 : 0;
          const sector = shareSectorMap.get(h.share_id) || 'Other';
          sectorMap.set(sector, (sectorMap.get(sector) || 0) + h.marketValue);

          performers.push({ ticker: h.share_ticker, name: h.share_name, gainLoss, percentage: pct });

          const ent = entityHoldMap.get(h.entity_id);
          if (ent) { ent.value += h.marketValue; ent.shares += 1; }
          else entityHoldMap.set(h.entity_id, { value: h.marketValue, shares: 1, name: h.entity_name });
        });

        const percentChange = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
        setPortfolioData({ totalValue, totalGainLoss, percentChange, cashBalance });

        const analyticsSectorColors = sectorBarColors(Array.from(sectorMap.keys()));
        const sectors: SectorRow[] = Array.from(sectorMap.entries())
          .map(([sector, value]) => ({
            sector, value,
            percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
            color: analyticsSectorColors.get(sector) ?? CHART_COLOR_FALLBACK,
          }))
          .sort((a, b) => b.value - a.value);
        setSectorAllocation(sectors);

        const entityRows: EntityRow[] = Array.from(entityHoldMap.entries())
          .map(([_, v]) => ({
            name: v.name, value: v.value,
            percentage: totalValue > 0 ? (v.value / totalValue) * 100 : 0,
            shares: v.shares,
          }))
          .sort((a, b) => b.value - a.value);
        setEntityBreakdown(entityRows);

        performers.sort((a, b) => b.gainLoss - a.gainLoss);
        setTopPerformers(performers.filter(p => p.gainLoss > 0).slice(0, 3));
        setBottomPerformers([...performers].sort((a, b) => a.gainLoss - b.gainLoss).filter(p => p.gainLoss < 0).slice(0, 3));

        // ── Store in portfolio_cache ─────────────────────────────────────
        const cacheRows: Record<string, unknown>[] = [];
        cacheRows.push({ scope, section: 'summary', sort_order: 0, label: 'totalValue', value: totalValue, percentage: 0, source_hash: sourceHash });
        cacheRows.push({ scope, section: 'summary', sort_order: 1, label: 'totalGainLoss', value: totalGainLoss, percentage: 0, source_hash: sourceHash });
        cacheRows.push({ scope, section: 'summary', sort_order: 2, label: 'percentChange', value: 0, percentage: percentChange, source_hash: sourceHash });
        cacheRows.push({ scope, section: 'summary', sort_order: 3, label: 'cashBalance', value: cashBalance, percentage: 0, source_hash: sourceHash });
        sectors.forEach((s, i) => cacheRows.push({ scope, section: 'sector', sort_order: i, label: s.sector, value: s.value, percentage: s.percentage, source_hash: sourceHash }));
        entityRows.forEach((e, i) => cacheRows.push({ scope, section: 'entity', sort_order: i, label: e.name, value: e.value, percentage: e.percentage, extra_value: e.shares, source_hash: sourceHash }));
        performers.filter(p => p.gainLoss > 0).slice(0, 3).forEach((p, i) => cacheRows.push({ scope, section: 'performer', sort_order: i, label: p.ticker, label_2: p.name, value: p.gainLoss, percentage: p.percentage, is_top_performer: true, source_hash: sourceHash }));
        [...performers].sort((a, b) => a.gainLoss - b.gainLoss).filter(p => p.gainLoss < 0).slice(0, 3).forEach((p, i) => cacheRows.push({ scope, section: 'performer', sort_order: i, label: p.ticker, label_2: p.name, value: p.gainLoss, percentage: p.percentage, is_top_performer: false, source_hash: sourceHash }));

        await supabase.from('portfolio_cache').delete().eq('scope', scope).eq('source_hash', sourceHash);
        for (let i = 0; i < cacheRows.length; i += 500) {
          await supabase.from('portfolio_cache').insert(cacheRows.slice(i, i + 500));
        }
        return;
      }

      // ── Fallback: share_analytics_cache is empty or stale ────────────────
      // Compute directly from source tables (same logic as before caching).
      const txnQuery = supabase
          .from('transactions')
          .select(`
            id, entity_id, share_id, transaction_type, no_of_shares, total_amount, approval_status,
            shares ( ticker, share_name, sector, sector_types ( sector_name ) )
          `)
          .in('approval_status', ['MANUAL_APPROVED'])
          .order('transaction_date', { ascending: true });
        if (entityId) txnQuery.eq('entity_id', entityId);
        // As-of only. A start date must not filter here: the position is built
        // from these rows, and dropping the early buys would break it.
        if (toDate) txnQuery.lte('transaction_date', toDate);

      const openingQuery = supabase.from('entity_share_opening_balances').select('entity_id, share_id, opening_shares, average_purchase_cost');
        if (entityId) openingQuery.eq('entity_id', entityId);

      const [sharesRes, txnsRes, pricesRes, dividendsRes, notesRes, entitiesRes, openingRes] = await Promise.all([
        supabase.from('shares').select('id, ticker, share_name, sector, sector_types(sector_name)').eq('is_active', true),
        txnQuery,
        supabase.from('daily_share_prices').select('share_id, share_price, effective_date').order('effective_date', { ascending: false }),
        supabase.from('dividends').select('share_id, amount_net'),
        supabase.from('buy_sell_notes').select('transaction_id, no_of_shares, gross_amount, note_type').not('transaction_id', 'is', null),
        supabase.from('entities').select('id, name, current_balance'),
        openingQuery,
      ]);

      if (txnsRes.error) throw txnsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;

      const shareMap = new Map<string, { ticker: string; name: string; sector: string }>();
      (sharesRes.data || []).forEach((s: {
        id: string;
        ticker: string;
        share_name: string;
        sector?: string;
        sector_types?: Embedded<{ sector_name: string }>;
      }) => {
        shareMap.set(s.id, {
          ticker: s.ticker || '—',
          name: s.share_name || s.ticker || '—',
          sector: embeddedOne(s.sector_types)?.sector_name || s.sector || 'Other',
        });
      });

      const entityNameMap = new Map<string, string>();
      let cashBalance = 0;
      (entitiesRes.data || []).forEach((e: { id: string; name: string; current_balance: number }) => {
        entityNameMap.set(e.id, e.name);
        if (!entityId || e.id === entityId) {
          cashBalance += Number(e.current_balance) || 0;
        }
      });
      setEntities((entitiesRes.data || []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })));

      const latestPrices = new Map<string, number>();
      (pricesRes.data || []).forEach((p: { share_id: string; share_price: number }) => {
        if (!latestPrices.has(p.share_id)) {
          latestPrices.set(p.share_id, Number(p.share_price) || 0);
        }
      });

      const divMap = new Map<string, number>();
      (dividendsRes.data || []).forEach((d: { share_id: string; amount_net: number }) => {
        divMap.set(d.share_id, (divMap.get(d.share_id) || 0) + Number(d.amount_net));
      });

      const txnNoteMap = new Map<string, { shares: number; gross: number }>();
      (notesRes.data || []).forEach((n: { transaction_id: string; no_of_shares: number; gross_amount: number }) => {
        txnNoteMap.set(n.transaction_id, {
          shares: Number(n.no_of_shares) || 0,
          gross: Number(n.gross_amount) || 0,
        });
      });

      type HoldingAcc = { held: number; cost: number; totalCostAll: number; saleProceeds: number };
      const shareHoldMap = new Map<string, HoldingAcc>();
      const entityHoldMap = new Map<string, Map<string, HoldingAcc>>();

      function ensureShareHolding(shareId: string): HoldingAcc {
        if (!shareHoldMap.has(shareId)) {
          shareHoldMap.set(shareId, { held: 0, cost: 0, totalCostAll: 0, saleProceeds: 0 });
        }
        return shareHoldMap.get(shareId)!;
      }

      function ensureEntityHolding(entityId: string, shareId: string): HoldingAcc {
        if (!entityHoldMap.has(entityId)) entityHoldMap.set(entityId, new Map());
        const entityShares = entityHoldMap.get(entityId)!;
        if (!entityShares.has(shareId)) {
          entityShares.set(shareId, { held: 0, cost: 0, totalCostAll: 0, saleProceeds: 0 });
        }
        return entityShares.get(shareId)!;
      }

      function applyMovement(h: HoldingAcc, sharesQty: number, gross: number, isBuy: boolean) {
        if (isBuy) {
          h.held += sharesQty;
          h.cost += gross;
          h.totalCostAll += gross;
        } else {
          const avgCps = h.held > 0 ? h.cost / h.held : 0;
          const removedCost = avgCps * sharesQty;
          h.held = Math.max(0, h.held - sharesQty);
          h.cost = Math.max(0, h.cost - removedCost);
          h.saleProceeds += gross;
        }
      }

      (openingRes.data || []).forEach((ob: {
        entity_id: string;
        share_id: string;
        opening_shares: number;
        average_purchase_cost: number;
      }) => {
        const sharesQty = Number(ob.opening_shares) || 0;
        const gross = sharesQty * (Number(ob.average_purchase_cost) || 0);
        applyMovement(ensureShareHolding(ob.share_id), sharesQty, gross, true);
        applyMovement(ensureEntityHolding(ob.entity_id, ob.share_id), sharesQty, gross, true);
      });

      (txnsRes.data || []).forEach((tx: {
        id: string;
        entity_id: string;
        share_id: string;
        transaction_type: string;
        no_of_shares: number;
        total_amount: number;
        shares?: Embedded<{
          ticker: string;
          share_name: string;
          sector?: string;
          sector_types?: Embedded<{ sector_name: string }>;
        }>;
      }) => {
        const txShare = embeddedOne(tx.shares);
        if (!shareMap.has(tx.share_id) && txShare) {
          shareMap.set(tx.share_id, {
            ticker: txShare.ticker || '—',
            name: txShare.share_name || txShare.ticker || '—',
            sector: embeddedOne(txShare.sector_types)?.sector_name || txShare.sector || 'Other',
          });
        }

        const note = txnNoteMap.get(tx.id);
        const sharesQty = note ? note.shares : Number(tx.no_of_shares) || 0;
        const gross = note ? note.gross : Number(tx.total_amount) || 0;
        const isBuy = (tx.transaction_type || '').toUpperCase() === 'BUY';

        applyMovement(ensureShareHolding(tx.share_id), sharesQty, gross, isBuy);
        applyMovement(ensureEntityHolding(tx.entity_id, tx.share_id), sharesQty, gross, isBuy);
      });

      let totalValue = 0;
      let totalCost = 0;
      let totalGainLoss = 0;

      const sectorMap = new Map<string, number>();
      const performers: PerformerRow[] = [];

      shareHoldMap.forEach((h, shareId) => {
        if (h.held <= 0) return;

        const share = shareMap.get(shareId);
        const price = latestPrices.get(shareId) || 0;
        const marketValue = h.held * price;
        const dividends = divMap.get(shareId) || 0;
        const gainLoss = marketValue - h.cost + dividends;
        const pct = h.cost > 0 ? (gainLoss / h.cost) * 100 : 0;

        totalValue += marketValue;
        totalCost += h.cost;
        totalGainLoss += gainLoss;

        const sector = share?.sector || 'Other';
        sectorMap.set(sector, (sectorMap.get(sector) || 0) + marketValue);

        performers.push({
          ticker: share?.ticker || '—',
          name: share?.name || '—',
          gainLoss,
          percentage: pct,
        });
      });

      performers.sort((a, b) => b.gainLoss - a.gainLoss);
      setTopPerformers(performers.filter(p => p.gainLoss > 0).slice(0, 3));
      setBottomPerformers(
        [...performers].sort((a, b) => a.gainLoss - b.gainLoss).filter(p => p.gainLoss < 0).slice(0, 3)
      );

      const liveSectorColors = sectorBarColors(Array.from(sectorMap.keys()));
      const sectors: SectorRow[] = Array.from(sectorMap.entries())
        .map(([sector, value]) => ({
          sector,
          value,
          percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
          color: liveSectorColors.get(sector) ?? CHART_COLOR_FALLBACK,
        }))
        .sort((a, b) => b.value - a.value);
      setSectorAllocation(sectors);

      const entityRows: EntityRow[] = [];
      entityHoldMap.forEach((shareMapForEntity, entityId) => {
        let entityValue = 0;
        let shareCount = 0;

        shareMapForEntity.forEach((h, shareId) => {
          if (h.held <= 0) return;
          entityValue += h.held * (latestPrices.get(shareId) || 0);
          shareCount += 1;
        });

        if (entityValue > 0) {
          entityRows.push({
            name: entityNameMap.get(entityId) || 'Unknown',
            value: entityValue,
            percentage: totalValue > 0 ? (entityValue / totalValue) * 100 : 0,
            shares: shareCount,
          });
        }
      });
      entityRows.sort((a, b) => b.value - a.value);
      setEntityBreakdown(entityRows);

      const percentChange = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
      setPortfolioData({
        totalValue,
        totalGainLoss,
        percentChange,
        cashBalance,
      });

      // ── Store fallback results in portfolio_cache too ──────────────────
      const cacheRows: Record<string, unknown>[] = [];
      cacheRows.push({ scope, section: 'summary', sort_order: 0, label: 'totalValue', value: totalValue, percentage: 0, source_hash: sourceHash });
      cacheRows.push({ scope, section: 'summary', sort_order: 1, label: 'totalGainLoss', value: totalGainLoss, percentage: 0, source_hash: sourceHash });
      cacheRows.push({ scope, section: 'summary', sort_order: 2, label: 'percentChange', value: 0, percentage: percentChange, source_hash: sourceHash });
      cacheRows.push({ scope, section: 'summary', sort_order: 3, label: 'cashBalance', value: cashBalance, percentage: 0, source_hash: sourceHash });
      sectors.forEach((s, i) => cacheRows.push({ scope, section: 'sector', sort_order: i, label: s.sector, value: s.value, percentage: s.percentage, source_hash: sourceHash }));
      entityRows.forEach((e, i) => cacheRows.push({ scope, section: 'entity', sort_order: i, label: e.name, value: e.value, percentage: e.percentage, extra_value: e.shares, source_hash: sourceHash }));
      performers.filter(p => p.gainLoss > 0).slice(0, 3).forEach((p, i) => cacheRows.push({ scope, section: 'performer', sort_order: i, label: p.ticker, label_2: p.name, value: p.gainLoss, percentage: p.percentage, is_top_performer: true, source_hash: sourceHash }));
      [...performers].sort((a, b) => a.gainLoss - b.gainLoss).filter(p => p.gainLoss < 0).slice(0, 3).forEach((p, i) => cacheRows.push({ scope, section: 'performer', sort_order: i, label: p.ticker, label_2: p.name, value: p.gainLoss, percentage: p.percentage, is_top_performer: false, source_hash: sourceHash }));

      await supabase.from('portfolio_cache').delete().eq('scope', scope).eq('source_hash', sourceHash);
      for (let i = 0; i < cacheRows.length; i += 500) {
        await supabase.from('portfolio_cache').insert(cacheRows.slice(i, i + 500));
      }
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchPortfolioData(selectedEntityId || undefined);
  }, [fetchPortfolioData, selectedEntityId, fromDate, toDate]);

  function handleExport() {
    const date = new Date().toISOString().split('T')[0];

    exportCsv(
      `portfolio_sector_allocation_${date}.csv`,
      ['Sector', 'Value (Rs.)', 'Percentage (%)'],
      sectorAllocation.map(s => [s.sector, s.value, s.percentage.toFixed(1)])
    );

    setTimeout(() => {
      exportCsv(
        `portfolio_entity_breakdown_${date}.csv`,
        ['Entity', 'Value (Rs.)', 'Percentage (%)', 'No. of Shares'],
        entityBreakdown.map(e => [e.name, e.value, e.percentage.toFixed(1), e.shares])
      );
    }, 300);
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  const gainPositive = portfolioData.totalGainLoss >= 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Overview</h1>
          <p className="text-gray-500 mt-1">Comprehensive view of your investment portfolio</p>
          {/* The two dates do different jobs here, and only one of them can
              honestly move the valuation. Say so rather than implying both do. */}
          {(fromDate || toDate) && (
            <p className="mt-2 text-xs text-blue-900 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 max-w-2xl">
              {toDate && <>Holdings, cost and value are <strong>as at {new Date(toDate + 'T00:00:00').toLocaleDateString('en-GB')}</strong>. </>}
              {fromDate && <>The start date scopes <strong>dividends</strong> to the period; holdings still include everything bought before it, or the position would not add up. </>}
              Shares are valued at the latest market price on file, not the price on the as-at date.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="pf-from" className="text-xs font-semibold text-gray-500 uppercase">From</label>
          <input
            id="pf-from"
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <label htmlFor="pf-to" className="text-xs font-semibold text-gray-500 uppercase">To (as of)</label>
          <input
            id="pf-to"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear dates
            </button>
          )}
          <select
            value={selectedEntityId}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Entities</option>
            {entities.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            disabled={sectorAllocation.length === 0 && entityBreakdown.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                Rs. {portfolioData.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center mt-2">
                {gainPositive ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ml-1 ${gainPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {fmtSignedPercent(portfolioData.percentChange)}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Gain/Loss</p>
              <p className={`text-2xl font-bold mt-2 ${gainPositive ? 'text-green-600' : 'text-red-600'}`}>
                {fmtSignedCurrency(portfolioData.totalGainLoss)}
              </p>
              <p className="text-sm text-gray-500 mt-2">All time</p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${gainPositive ? 'bg-green-100' : 'bg-red-100'}`}>
              {gainPositive ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Cash Balance</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                Rs. {portfolioData.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-500 mt-2">Available funds</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Return Rate</p>
              <p className={`text-2xl font-bold mt-2 ${gainPositive ? 'text-green-600' : 'text-red-600'}`}>
                {fmtSignedPercent(portfolioData.percentChange)}
              </p>
              <p className="text-sm text-gray-500 mt-2">On current holdings</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <Percent className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <PieChart className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-bold text-gray-900">Sector Allocation</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {sectorAllocation.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No sector data available</p>
            ) : (
              sectorAllocation.map((sector) => (
                <div key={sector.sector} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color }} />
                      <span className="text-sm font-medium text-gray-900">{sector.sector}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">
                        Rs. {sector.value.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{sector.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ width: `${sector.percentage}%`, backgroundColor: sector.color }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Entity Breakdown</h2>
          </div>
          <div className="p-6 space-y-4">
            {entityBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No entity data available</p>
            ) : (
              entityBreakdown.map((entity) => (
                <div key={entity.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{entity.name}</p>
                      <p className="text-xs text-gray-500">{entity.shares} different shares</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">
                        Rs. {entity.value.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{entity.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${entity.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Top Performers</h2>
          </div>
          <div className="p-6 space-y-4">
            {topPerformers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No positive performers yet</p>
            ) : (
              topPerformers.map((stock, index) => (
                <div key={stock.ticker} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-green-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{stock.ticker}</p>
                      <p className="text-xs text-gray-500">{stock.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">{fmtSignedCurrency(stock.gainLoss)}</p>
                    <p className="text-xs font-medium text-green-600">{fmtSignedPercent(stock.percentage)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Bottom Performers</h2>
          </div>
          <div className="p-6 space-y-4">
            {bottomPerformers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No underperformers</p>
            ) : (
              bottomPerformers.map((stock, index) => (
                <div key={stock.ticker} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-red-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{stock.ticker}</p>
                      <p className="text-xs text-gray-500">{stock.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{fmtSignedCurrency(stock.gainLoss)}</p>
                    <p className="text-xs font-medium text-red-600">{fmtSignedPercent(stock.percentage)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
