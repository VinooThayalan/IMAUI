import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { PieChart } from '../components/PieChart';
import { Building2 } from 'lucide-react';

// ── Color palettes ────────────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  'Banking': '#3B82F6',
  'Diversified Financials': '#10B981',
  'Hotels': '#F59E0B',
  'Industries': '#EC4899',
  'Construction Materials': '#8B5CF6',
  'Constructions Materials': '#8B5CF6',
  'Automobile Components': '#EF4444',
  'Telecommunication': '#06B6D4',
  'Manufacturing': '#F97316',
  'Technology': '#6366F1',
  'Healthcare': '#14B8A6',
  'Energy': '#F43F5E',
  'Consumer Goods': '#84CC16',
  'Retail': '#A855F7',
  'Insurance': '#0EA5E9',
  'Real Estate': '#22C55E',
  'Other': '#6B7280',
};

const SHARE_COLORS = [
  '#1E3A5F', '#3B82F6', '#F59E0B', '#10B981', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6',
];

function sectorColor(s: string) { return SECTOR_COLORS[s] || SECTOR_COLORS['Other']; }
function shareColor(i: number) { return SHARE_COLORS[i % SHARE_COLORS.length]; }

function mkPiePct<T extends { value: number }>(arr: T[]): (T & { percentage: number })[] {
  const total = arr.reduce((s, d) => s + Math.max(0, d.value), 0);
  return arr.map(d => ({ ...d, percentage: total > 0 ? (Math.max(0, d.value) / total) * 100 : 0 }));
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtCur(v: number) {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}Rs. ${(abs / 1_000_000_000).toFixed(2)}bn`;
  if (abs >= 1_000_000)     return `${sign}Rs. ${(abs / 1_000_000).toFixed(2)}m`;
  if (abs >= 1_000)         return `${sign}Rs. ${(abs / 1_000).toFixed(2)}k`;
  return `Rs. ${v.toFixed(2)}`;
}

function fmtNum(v: number) { return v.toLocaleString(undefined, { maximumFractionDigits: 0 }); }

// ── XIRR ─────────────────────────────────────────────────────────────────────

function xirr(cashFlows: Array<{ date: Date; amount: number }>, guess = 0.1): number {
  if (cashFlows.length < 2) return 0;
  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const d0 = sorted[0].date.getTime();
  const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
  let rate = guess;
  for (let iter = 0; iter < 200; iter++) {
    let f = 0, df = 0;
    for (const cf of sorted) {
      const t = (cf.date.getTime() - d0) / MS_PER_YEAR;
      const base = 1 + rate;
      if (base <= 0) break;
      const pv = Math.pow(base, t);
      f  += cf.amount / pv;
      df -= (t * cf.amount) / (pv * base);
    }
    if (Math.abs(df) < 1e-12) break;
    const nr = rate - f / df;
    if (Math.abs(nr - rate) < 1e-8) return nr;
    rate = Math.max(-0.999, nr);
  }
  return rate;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Entity { id: string; name: string; }

interface ShareRow {
  id: string;
  ticker: string;
  share_name: string;
  sector: string;
}

interface ShareMetrics {
  shareId: string;
  ticker: string;
  shareName: string;
  sector: string;
  heldShares: number;
  cost: number;        // cumulative cost of held shares
  totalCostAll: number; // total cost ever (incl. sold)
  marketValue: number;
  dividends: number;
  saleProceeds: number;
  netMarketValue: number; // marketValue - cost (held)
  totalReturns: number;   // (marketValue + saleProceeds + dividends) - totalCostAll
  avgCostPerShare: number;
  latestPrice: number;
  aer: number; // XIRR annualized return % (matches ShareAnalytics)
}

// ── KPI summary card ─────────────────────────────────────────────────────────

function KpiCard({ label, value, bg, textColor }: { label: string; value: string; bg: string; textColor: string }) {
  return (
    <div className={`${bg} rounded-xl p-5 flex flex-col gap-2 shadow-sm`}>
      <span className={`text-2xl font-extrabold ${textColor} leading-tight`}>{value}</span>
      <span className="text-xs font-semibold text-gray-700 leading-snug">{label}</span>
    </div>
  );
}

// ── Bar chart (SVG, horizontal labels) ───────────────────────────────────────

interface BarChartProps {
  title: string;
  bars: { label: string; value: number; color: string }[];
  formatValue?: (v: number) => string;
  yLabel?: string;
}

function BarChart({ title, bars, formatValue = fmtCur, yLabel }: BarChartProps) {
  if (bars.length === 0) return null;
  const maxVal = Math.max(...bars.map(b => Math.abs(b.value)), 1);
  const W = 620, H = 400, padL = 80, padR = 16, padT = 32, padB = 110;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = Math.min(64, (chartW / bars.length) * 0.65);
  const gap  = chartW / bars.length;

  const yTicks = 5;
  const yStep  = maxVal / yTicks;

  return (
    <div>
      {title && <p className="text-sm font-bold text-gray-700 mb-3">{title}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 320 }}>
        {/* y-axis label */}
        {yLabel && (
          <text x={12} y={H / 2} textAnchor="middle" fontSize={11} fill="#9CA3AF"
            transform={`rotate(-90, 12, ${H / 2})`}>{yLabel}</text>
        )}
        {/* grid lines + y ticks */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const y = padT + chartH - (i / yTicks) * chartH;
          const val = i * yStep;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#E5E7EB" strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={11} fill="#9CA3AF">
                {val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}m` : val >= 1_000 ? `${(val / 1_000).toFixed(0)}k` : val.toFixed(0)}
              </text>
            </g>
          );
        })}
        {/* bars */}
        {bars.map((b, i) => {
          const x    = padL + i * gap + gap / 2 - barW / 2;
          const pct  = Math.abs(b.value) / maxVal;
          const bH   = Math.max(3, pct * chartH);
          const y    = padT + chartH - bH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bH} fill={b.color} rx={4} />
              <text x={x + barW / 2} y={padT + chartH + 16} textAnchor="end" fontSize={11} fill="#374151"
                transform={`rotate(-42, ${x + barW / 2}, ${padT + chartH + 16})`}>
                {b.label}
              </text>
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#1F2937" fontWeight="700">
                {formatValue(b.value)}
              </text>
            </g>
          );
        })}
        {/* x-axis */}
        <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#D1D5DB" strokeWidth={1.5} />
      </svg>
    </div>
  );
}

// ── Grouped bar chart for price vs cost ──────────────────────────────────────

function PriceCostBarChart({ title, bars }: { title: string; bars: { label: string; price: number; cost: number }[] }) {
  if (bars.length === 0) return null;
  const maxVal = Math.max(...bars.flatMap(b => [b.price, b.cost]), 1);
  const W = 620, H = 400, padL = 80, padR = 16, padT = 40, padB = 110;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const groupW = chartW / bars.length;
  const barW   = Math.min(28, groupW * 0.35);
  const yTicks = 5;
  const yStep  = maxVal / yTicks;

  return (
    <div>
      {title && <p className="text-sm font-bold text-gray-700 mb-3">{title}</p>}
      {/* Legend */}
      <div className="flex items-center gap-6 mb-2">
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded inline-block" style={{ background: '#1E3A5F' }} /><span className="text-sm text-gray-600 font-medium">Market Price per share</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded inline-block" style={{ background: '#F59E0B' }} /><span className="text-sm text-gray-600 font-medium">Cost per share</span></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 320 }}>
        {/* y-axis label */}
        <text x={12} y={H / 2} textAnchor="middle" fontSize={11} fill="#9CA3AF"
          transform={`rotate(-90, 12, ${H / 2})`}>Price (Rs.)</text>
        {/* grid + ticks */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const y = padT + chartH - (i / yTicks) * chartH;
          const val = i * yStep;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#E5E7EB" strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={11} fill="#9CA3AF">
                {val >= 1_000 ? `${(val / 1_000).toFixed(0)}k` : val.toFixed(0)}
              </text>
            </g>
          );
        })}
        {bars.map((b, i) => {
          const cx    = padL + i * groupW + groupW / 2;
          const pxH   = Math.max(3, (b.price / maxVal) * chartH);
          const cxH   = Math.max(3, (b.cost / maxVal) * chartH);
          const pxY   = padT + chartH - pxH;
          const cxY   = padT + chartH - cxH;
          return (
            <g key={i}>
              <rect x={cx - barW - 2} y={pxY} width={barW} height={pxH} fill="#1E3A5F" rx={3} />
              <rect x={cx + 2}        y={cxY} width={barW} height={cxH} fill="#F59E0B" rx={3} />
              <text x={cx} y={padT + chartH + 16} textAnchor="end" fontSize={11} fill="#374151"
                transform={`rotate(-42, ${cx}, ${padT + chartH + 16})`}>{b.label}</text>
              <text x={cx - barW / 2 - 2} y={pxY - 6} textAnchor="middle" fontSize={10} fill="#1E3A5F" fontWeight="700">
                {b.price >= 1000 ? `${(b.price/1000).toFixed(1)}k` : b.price.toFixed(0)}
              </text>
            </g>
          );
        })}
        <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#D1D5DB" strokeWidth={1.5} />
      </svg>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function Dashboard() {
  const [loading, setLoading]           = useState(true);
  const [shares, setShares]             = useState<ShareRow[]>([]);
  const [metrics, setMetrics]           = useState<ShareMetrics[]>([]);
  const [entities, setEntities]         = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState('');

  useEffect(() => {
    supabase.from('entities').select('id, name').order('name').then(({ data }) => setEntities(data || []));
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      let txnsQ = supabase.from('transactions')
        .select('id, share_id, entity_id, transaction_type, no_of_shares, total_amount, brokerage_fee_rate, transaction_date')
        .in('approval_status', ['MANUAL_APPROVED'])
        .order('transaction_date', { ascending: true });
      if (selectedEntityId) txnsQ = txnsQ.eq('entity_id', selectedEntityId);

      let dividendsQ = supabase.from('dividends').select('share_id, entity_id, amount_net, payment_date');
      if (selectedEntityId) dividendsQ = dividendsQ.eq('entity_id', selectedEntityId);

      let openingQ = supabase.from('entity_share_opening_balances')
        .select('share_id, entity_id, opening_shares, average_purchase_cost, effective_date');
      if (selectedEntityId) openingQ = openingQ.eq('entity_id', selectedEntityId);

      const [sharesRes, txnsRes, pricesRes, dividendsRes, notesRes, openingRes] = await Promise.all([
        supabase.from('shares')
          .select('id, ticker, share_name, sector, sector_types(sector_name)')
          .eq('is_active', true)
          .order('share_name'),
        txnsQ,
        supabase.from('daily_share_prices')
          .select('share_id, share_price, effective_date')
          .order('effective_date', { ascending: false }),
        dividendsQ,
        // Notes override transaction amounts with more accurate settled figures
        supabase.from('buy_sell_notes')
          .select('transaction_id, no_of_shares, gross_amount, note_type, trade_date')
          .not('transaction_id', 'is', null),
        openingQ,
      ]);

      const shareRows: ShareRow[] = (sharesRes.data || []).map((s: any) => ({
        id: s.id,
        ticker: s.ticker || '',
        share_name: s.share_name || s.ticker || '',
        // Prefer sector_types.sector_name, fall back to shares.sector column
        sector: (s.sector_types as { sector_name: string } | null)?.sector_name || s.sector || 'Other',
      }));
      setShares(shareRows);

      const shareMap = new Map(shareRows.map(s => [s.id, s]));

      // Latest price per share
      const latestPrices = new Map<string, number>();
      (pricesRes.data || []).forEach((p: any) => {
        if (!latestPrices.has(p.share_id)) latestPrices.set(p.share_id, Number(p.share_price) || 0);
      });

      // Dividends by share (aggregate across all entities for dashboard totals)
      const divMap = new Map<string, number>();
      (dividendsRes.data || []).forEach((d: any) => {
        divMap.set(d.share_id, (divMap.get(d.share_id) || 0) + (Number(d.amount_net) || 0));
      });

      // Notes map: transaction_id → settled amounts (more accurate than raw transaction)
      const txnNoteMap = new Map<string, { shares: number; gross: number; type: string; date: string | null }>();
      (notesRes.data || []).forEach((n: any) => {
        if (n.transaction_id) {
          txnNoteMap.set(n.transaction_id, {
            shares: Number(n.no_of_shares) || 0,
            gross:  Number(n.gross_amount)  || 0,
            type:   n.note_type,
            date:   n.trade_date ?? null,
          });
        }
      });

      // Holdings accumulator: share_id → { held, cost, totalCostAll, saleProceeds, feeRate }
      type HoldingAcc = { held: number; cost: number; totalCostAll: number; saleProceeds: number; feeRate: number };
      const holdMap = new Map<string, HoldingAcc>();
      // Cash flows per share for XIRR — aggregated across all entities
      const cfMap = new Map<string, Array<{ date: Date; amount: number }>>();

      const ensureHolding = (shareId: string): HoldingAcc => {
        if (!holdMap.has(shareId)) holdMap.set(shareId, { held: 0, cost: 0, totalCostAll: 0, saleProceeds: 0, feeRate: 0 });
        return holdMap.get(shareId)!;
      };
      const addCf = (shareId: string, date: Date, amount: number) => {
        if (!cfMap.has(shareId)) cfMap.set(shareId, []);
        cfMap.get(shareId)!.push({ date, amount });
      };

      // Seed with opening balances first (they represent pre-system holdings)
      (openingRes.data || []).forEach((ob: any) => {
        if (!shareMap.has(ob.share_id)) return;
        const h = ensureHolding(ob.share_id);
        const qty  = Number(ob.opening_shares) || 0;
        const cost = qty * (Number(ob.average_purchase_cost) || 0);
        h.held        += qty;
        h.cost        += cost;
        h.totalCostAll += cost;
        if (cost > 0 && ob.effective_date) {
          addCf(ob.share_id, new Date(ob.effective_date + 'T00:00:00'), -cost);
        }
      });

      // Dividends cash flows (inflow, dated)
      (dividendsRes.data || []).forEach((d: any) => {
        if (d.payment_date && Number(d.amount_net) > 0) {
          addCf(d.share_id, new Date(d.payment_date + 'T00:00:00'), Number(d.amount_net));
        }
      });

      // Apply approved transactions (notes take precedence for settled amounts)
      (txnsRes.data || []).forEach((tx: any) => {
        if (!shareMap.has(tx.share_id)) return;
        const note       = txnNoteMap.get(tx.id);
        const shares_qty = note ? note.shares : Number(tx.no_of_shares) || 0;
        const gross      = note ? note.gross  : Number(tx.total_amount)  || 0;
        const txType     = note?.type || tx.transaction_type || '';
        const isBuy      = txType.toUpperCase() === 'BUY';
        const h = ensureHolding(tx.share_id);

        // Track the latest brokerage fee rate for this share
        if (tx.brokerage_fee_rate != null) h.feeRate = Number(tx.brokerage_fee_rate);

        // Use note's trade_date first, fall back to transaction_date
        const rawDate = note?.date ?? tx.transaction_date ?? null;
        const cfDate = rawDate ? new Date(rawDate + 'T00:00:00') : null;

        if (isBuy) {
          h.held        += shares_qty;
          h.cost        += gross;
          h.totalCostAll += gross;
          if (cfDate && gross > 0) addCf(tx.share_id, cfDate, -gross);
        } else {
          const avgCPS = h.held > 0 ? h.cost / h.held : 0;
          h.held          = Math.max(0, h.held - shares_qty);
          h.cost          = Math.max(0, h.cost - avgCPS * shares_qty);
          h.saleProceeds += gross;
          if (cfDate && gross > 0) addCf(tx.share_id, cfDate, gross);
        }
      });

      const today = new Date();
      const result: ShareMetrics[] = [];
      holdMap.forEach((h, shareId) => {
        const sr = shareMap.get(shareId);
        if (!sr) return;
        const price   = latestPrices.get(shareId) || 0;
        const feeRate = h.feeRate / 100;
        // Net market value (after brokerage fees) — matches ShareAnalytics & PortfolioSummary
        const mv      = h.held * price * (1 - feeRate);
        const divs    = divMap.get(shareId) || 0;
        const nmv     = mv - h.cost;
        const tr      = (mv + h.saleProceeds + divs) - h.totalCostAll;
        const avgCPS  = h.held > 0 ? h.cost / h.held : 0;

        // AER = XIRR annualized return (matches ShareAnalytics)
        let aer = 0;
        const cfs = [...(cfMap.get(shareId) || [])];
        if (mv > 0) cfs.push({ date: today, amount: mv });
        if (cfs.length >= 2) {
          try {
            const rate = xirr(cfs);
            if (isFinite(rate)) aer = rate * 100;
          } catch { /* leave as 0 */ }
        }

        result.push({
          shareId, ticker: sr.ticker, shareName: sr.share_name, sector: sr.sector,
          heldShares: h.held, cost: h.cost, totalCostAll: h.totalCostAll,
          marketValue: mv, dividends: divs, saleProceeds: h.saleProceeds,
          netMarketValue: nmv, totalReturns: tr, avgCostPerShare: avgCPS,
          latestPrice: price, aer,
        });
      });

      result.sort((a, b) => b.netMarketValue - a.netMarketValue);
      setMetrics(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="p-6 space-y-8">
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-slate-600">
            <Building2 className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Entity</span>
          </div>
          <div className="flex flex-wrap gap-2 flex-1">
            <button
              onClick={() => setSelectedEntityId('')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                !selectedEntityId
                  ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800'
              }`}
            >
              All Entities
            </button>
            {entities.map(e => (
              <button
                key={e.id}
                onClick={() => setSelectedEntityId(prev => prev === e.id ? '' : e.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  selectedEntityId === e.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                }`}
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Top 5 contributors by net market value (held > 0)
  const top5 = metrics.filter(m => m.heldShares > 0).slice(0, 5);

  // KPI aggregates (all shares with holdings)
  const held = metrics.filter(m => m.heldShares > 0);
  const totalReturnsSinceInception = held.reduce((s, m) => s + m.totalReturns, 0);
  const totalReturnsBalShares      = held.reduce((s, m) => s + m.netMarketValue, 0);
  const totalDividendsSinceInc     = held.reduce((s, m) => s + m.dividends, 0);
  const totalBalDividends          = held.reduce((s, m) => s + m.dividends, 0);
  const totalMarketValue           = held.reduce((s, m) => s + m.marketValue, 0);
  const totalCostsBalShares        = held.reduce((s, m) => s + m.cost, 0);

  // Sector aggregates
  const sectorMap = new Map<string, { returns: number; dividends: number; marketValue: number }>();
  held.forEach(m => {
    if (!sectorMap.has(m.sector)) sectorMap.set(m.sector, { returns: 0, dividends: 0, marketValue: 0 });
    const s = sectorMap.get(m.sector)!;
    s.returns     += m.totalReturns;
    s.dividends   += m.dividends;
    s.marketValue += m.marketValue;
  });

  const sectorReturnsPie   = mkPiePct(Array.from(sectorMap.entries()).map(([k, v]) => ({ label: k, value: v.returns,     color: sectorColor(k) })));
  const sectorDivPie       = mkPiePct(Array.from(sectorMap.entries()).map(([k, v]) => ({ label: k, value: v.dividends,   color: sectorColor(k) })));
  const sectorMvPie        = mkPiePct(Array.from(sectorMap.entries()).map(([k, v]) => ({ label: k, value: v.marketValue, color: sectorColor(k) })));

  // Top-5 pie charts
  const top5NetMktPie  = mkPiePct(top5.map((m, i) => ({ label: m.ticker, value: m.netMarketValue,  color: shareColor(i) })));
  const top5DivPie     = mkPiePct(top5.map((m, i) => ({ label: m.ticker, value: m.dividends,       color: shareColor(i) })));
  const top5ReturnsPie = mkPiePct(top5.map((m, i) => ({ label: m.ticker, value: m.totalReturns,    color: shareColor(i) })));
  const top5CostPie    = mkPiePct(top5.map((m, i) => ({ label: m.ticker, value: m.totalCostAll,    color: shareColor(i) })));

  // Top-5 bar charts — use share name for x-axis labels
  const top5PriceCost  = top5.map((m, i) => ({ label: m.shareName || m.ticker, price: m.latestPrice,      cost: m.avgCostPerShare, color: shareColor(i) }));
  const top5BalShares  = top5.map((m, i) => ({ label: m.shareName || m.ticker, value: m.heldShares,        color: shareColor(i) }));
  const top5AER        = top5.map((m, i) => ({ label: m.shareName || m.ticker, value: m.aer,               color: shareColor(i) }));

  // Share portfolio table — active shares with holdings, then the rest (dimmed)
  const heldIds = new Set(held.map(m => m.shareId));
  const portfolioShares = [
    ...shares.filter(s => heldIds.has(s.id)),
    ...shares.filter(s => !heldIds.has(s.id)),
  ];

  const selectedEntityName = selectedEntityId
    ? (entities.find(e => e.id === selectedEntityId)?.name ?? '')
    : '';

  return (
    <div className="p-6 space-y-8">

      {/* ── Entity Filter Bar ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-600">
          <Building2 className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Entity</span>
        </div>
        <div className="flex flex-wrap gap-2 flex-1">
          <button
            onClick={() => setSelectedEntityId('')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
              !selectedEntityId
                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800'
            }`}
          >
            All Entities
          </button>
          {entities.map(e => (
            <button
              key={e.id}
              onClick={() => setSelectedEntityId(prev => prev === e.id ? '' : e.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                selectedEntityId === e.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              {e.name}
            </button>
          ))}
        </div>
        {selectedEntityId && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
              <Building2 className="w-3 h-3" />
              {selectedEntityName}
            </span>
          </div>
        )}
      </div>

      {/* ── Section 1: Share Portfolio Table + KPI cards ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Share portfolio table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-800 to-slate-700">
            <h2 className="text-base font-bold text-white">
              {selectedEntityName ? `${selectedEntityName} — Share Portfolio` : 'Share Portfolio'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{portfolioShares.length} listed securities</p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Share</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Sector</th>
                </tr>
              </thead>
              <tbody>
                {portfolioShares.map((s) => {
                  const sc = sectorColor(s.sector);
                  const isHeld = held.some(m => m.shareId === s.id);
                  return (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                      style={{ borderLeftColor: sc, borderLeftWidth: 3 }}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white leading-none"
                            style={{ backgroundColor: sc }}>{s.ticker}</span>
                          <span className={`text-sm font-medium ${isHeld ? 'text-slate-800' : 'text-slate-400'}`}>
                            {s.share_name || s.ticker}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc }} />
                          <span className="text-xs text-slate-600">{s.sector}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {portfolioShares.length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400 text-xs">No shares found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* KPI summary cards — 2×3 grid */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Total Returns Since Inception" value={fmtCur(totalReturnsSinceInception)} bg="bg-rose-100"   textColor="text-rose-800" />
          <KpiCard label="Total Returns on Bal. Shares"  value={fmtCur(totalReturnsBalShares)}      bg="bg-amber-100"  textColor="text-amber-800" />
          <KpiCard label="Total Dividends since Inception" value={fmtCur(totalDividendsSinceInc)}   bg="bg-green-100"  textColor="text-green-800" />
          <KpiCard label="Total Bal. of Dividends"       value={fmtCur(totalBalDividends)}           bg="bg-teal-100"   textColor="text-teal-800" />
          <KpiCard label="Market Value of Current Share Portfolio" value={fmtCur(totalMarketValue)} bg="bg-blue-100"   textColor="text-blue-800" />
          <KpiCard label="Total Costs on Bal. Shares"    value={fmtCur(totalCostsBalShares)}        bg="bg-pink-100"   textColor="text-pink-800" />
        </div>
      </div>

      {/* ── Section 2: Sector pie charts ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50">
          <h2 className="text-lg font-bold text-gray-900">Portfolio by Sector</h2>
          <p className="text-xs text-gray-500 mt-0.5">Breakdown across {sectorMap.size} sectors</p>
          {/* Sector color legend */}
          {sectorMap.size > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Array.from(sectorMap.keys()).map(s => (
                <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-sm" style={{ backgroundColor: sectorColor(s) }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="rounded-xl p-5 border" style={{ background: 'linear-gradient(135deg, #fff1f2 0%, #fff7ed 100%)', borderColor: '#fecdd3' }}>
            <p className="text-xs font-bold mb-4 text-center uppercase tracking-wide" style={{ color: '#e11d48' }}>Total Returns by Sector</p>
            <PieChart data={sectorReturnsPie.filter(d => d.value > 0)} title="" size={210} formatValue={fmtCur} />
          </div>
          <div className="rounded-xl p-5 border" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%)', borderColor: '#a7f3d0' }}>
            <p className="text-xs font-bold mb-4 text-center uppercase tracking-wide" style={{ color: '#059669' }}>Total Dividends by Sector</p>
            <PieChart data={sectorDivPie.filter(d => d.value > 0)} title="" size={210} formatValue={fmtCur} />
          </div>
          <div className="rounded-xl p-5 border" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)', borderColor: '#bfdbfe' }}>
            <p className="text-xs font-bold mb-4 text-center uppercase tracking-wide" style={{ color: '#2563eb' }}>Market Value by Sector</p>
            <PieChart data={sectorMvPie.filter(d => d.value > 0)} title="" size={210} formatValue={fmtCur} />
          </div>
        </div>
        {/* Sector breakdown table with color bands */}
        {sectorMap.size > 0 && (
          <div className="px-6 pb-6">
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sector</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Market Value</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Returns</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Dividends</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(sectorMap.entries())
                    .sort((a, b) => b[1].marketValue - a[1].marketValue)
                    .map(([sector, vals]) => {
                      const sc = sectorColor(sector);
                      return (
                        <tr key={sector} className="border-b border-gray-50 hover:bg-gray-50/60" style={{ borderLeftColor: sc, borderLeftWidth: 4 }}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sc }} />
                              <span className="font-semibold text-gray-800">{sector}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-blue-700 font-semibold">{fmtCur(vals.marketValue)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono font-semibold ${vals.returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtCur(vals.returns)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-amber-600 font-semibold">{fmtCur(vals.dividends)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Main Contributors – pie charts ─────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-sky-800 to-blue-700">
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {selectedEntityName ? `${selectedEntityName} — Main Contributors` : "Main Contributors"}
          </h2>
          <p className="text-xs text-sky-200 mt-0.5">Top 5 shares by net market value</p>
          {top5.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {top5.map((m, i) => (
                <span key={m.shareId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-sm border border-white/20" style={{ background: shareColor(i) }}>
                  {m.ticker}
                  <span className="opacity-90 font-mono">{fmtCur(m.netMarketValue)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 border border-blue-100">
            <p className="text-sm font-bold text-slate-700 mb-4 text-center">Total Net Market Value by Share</p>
            <PieChart data={top5NetMktPie} title="" size={260} formatValue={fmtCur} />
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-emerald-50 rounded-xl p-6 border border-emerald-100">
            <p className="text-sm font-bold text-slate-700 mb-4 text-center">Total Dividends by Share</p>
            <PieChart data={top5DivPie.filter(d => d.value > 0)} title="" size={260} formatValue={fmtCur} />
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-rose-50 rounded-xl p-6 border border-rose-100">
            <p className="text-sm font-bold text-slate-700 mb-4 text-center">Total Returns by Share</p>
            <PieChart data={top5ReturnsPie.filter(d => d.value > 0)} title="" size={260} formatValue={fmtCur} />
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-amber-50 rounded-xl p-6 border border-amber-100">
            <p className="text-sm font-bold text-slate-700 mb-4 text-center">Total Cost by Share</p>
            <PieChart data={top5CostPie} title="" size={260} formatValue={fmtCur} />
          </div>
        </div>
      </div>

      {/* ── Section 4: Main Contributors – bar charts ─────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-sky-800 to-blue-700">
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {selectedEntityName ? `${selectedEntityName} — Detail` : "Main Contributors — Detail"}
          </h2>
          <p className="text-xs text-sky-200 mt-0.5">Detailed metrics for top 5 contributors</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-5 border border-blue-100">
            <PriceCostBarChart title="Market Price vs Cost per Share" bars={top5PriceCost} />
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-yellow-50 rounded-xl p-5 border border-yellow-100">
            <BarChart
              title="AER by Share"
              bars={top5AER}
              formatValue={v => `${v.toFixed(1)}%`}
              yLabel="AER %"
            />
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-emerald-50 rounded-xl p-5 border border-emerald-100">
            <BarChart
              title="Total Balance No. of Shares by Share"
              bars={top5BalShares}
              formatValue={v => fmtNum(v)}
              yLabel="Shares"
            />
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-rose-50 rounded-xl p-5 border border-rose-100 flex items-center justify-center text-gray-300 text-sm">
            {top5.length === 0 && 'No contributor data available'}
            {top5.length > 0 && (
              <div className="w-full">
                <p className="text-xs font-bold text-gray-700 mb-2">Summary — Top 5 Contributors</p>
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-400 border-b border-gray-200">
                    <th className="text-left py-1">Share</th>
                    <th className="text-right py-1">Held</th>
                    <th className="text-right py-1">Market Value</th>
                    <th className="text-right py-1">AER</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {top5.map((m, i) => (
                      <tr key={m.shareId}>
                        <td className="py-1.5 font-semibold" style={{ color: shareColor(i) }}>{m.ticker}</td>
                        <td className="py-1.5 text-right text-gray-600">{fmtNum(m.heldShares)}</td>
                        <td className="py-1.5 text-right text-gray-800 font-semibold">{fmtCur(m.marketValue)}</td>
                        <td className={`py-1.5 text-right font-semibold ${m.aer >= 0 ? 'text-green-600' : 'text-red-600'}`}>{m.aer.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 5: Total Returns by Sector ────────────────────────────── */}
      <Section5TotalReturnsBySector metrics={metrics} />

      {/* ── Section 6: Share Name Cards ───────────────────────────────────── */}
      <Section6ShareCards metrics={metrics} entityName={selectedEntityName} />

    </div>
  );
}

// ── Section 5 component ───────────────────────────────────────────────────────

const SECTOR_DISPLAY_ORDER = [
  'Banking',
  'Construction Materials',
  'Constructions Materials',
  'Diversified Financials',
  'Industries',
];

function Section5TotalReturnsBySector({ metrics }: { metrics: ShareMetrics[] }) {
  const held = metrics.filter(m => m.heldShares > 0);

  // Overall sector returns pie
  const sectorRetMap = new Map<string, number>();
  held.forEach(m => sectorRetMap.set(m.sector, (sectorRetMap.get(m.sector) || 0) + m.totalReturns));
  const sectorReturnsPie = mkPiePct(
    Array.from(sectorRetMap.entries()).map(([k, v]) => ({ label: k, value: v, color: sectorColor(k) }))
  );

  // Per-sector: returns broken down by share
  const targetSectors = Array.from(new Set(
    held.map(m => m.sector).filter(s =>
      SECTOR_DISPLAY_ORDER.some(ds => ds.toLowerCase() === s.toLowerCase())
    )
  )).sort((a, b) => {
    const ia = SECTOR_DISPLAY_ORDER.findIndex(d => d.toLowerCase() === a.toLowerCase());
    const ib = SECTOR_DISPLAY_ORDER.findIndex(d => d.toLowerCase() === b.toLowerCase());
    return ia - ib;
  });

  const sectorSharePies = targetSectors.map(sector => {
    const shares = held.filter(m => m.sector.toLowerCase() === sector.toLowerCase());
    const pieData = mkPiePct(
      shares.map((m, i) => ({ label: m.ticker, value: m.totalReturns, color: shareColor(i) }))
    );
    return { sector, pieData };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-rose-50 to-orange-50">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Total Returns by Sector</h2>
        <p className="text-xs text-gray-500 mt-0.5">Overall sector breakdown and per-sector share contribution</p>
      </div>
      <div className="p-6 space-y-8">
        {/* Overall sector returns pie — full width centred */}
        <div className="flex flex-col items-center">
          <PieChart
            data={sectorReturnsPie.filter(d => d.value > 0)}
            title="Total Returns by Sector"
            size={260}
          />
        </div>

        {/* Per-sector pies — 2 columns */}
        {sectorSharePies.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {sectorSharePies.map(({ sector, pieData }) => (
              <div key={sector} className="bg-gray-50 rounded-xl p-5 border border-gray-100 flex flex-col items-center">
                <p className="text-xs font-bold text-red-600 mb-4 text-center">
                  Total Returns in {sector} by Share
                </p>
                <PieChart
                  data={pieData.filter(d => d.value > 0)}
                  title=""
                  size={220}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section 6 component ───────────────────────────────────────────────────────

function Section6ShareCards({ metrics, entityName }: { metrics: ShareMetrics[]; entityName: string }) {
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);

  // Shares ordered descending by total market value
  const allMetrics = [...metrics].sort((a, b) => b.marketValue - a.marketValue);

  const selected = selectedShareId ? allMetrics.find(m => m.shareId === selectedShareId) : null;

  // Grand totals row
  const grandTotal = allMetrics.reduce((acc, m) => ({
    marketValue: acc.marketValue + m.marketValue,
  }), { marketValue: 0 });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-slate-800 to-slate-700">
        <h2 className="text-xl font-extrabold text-white tracking-tight">
          {entityName ? `${entityName} — Portfolio Details` : 'Share Portfolio Details'}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">Ordered by market value (highest first). Select a share to see details.</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-700 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">#&nbsp;&nbsp;Share</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wide">Market Value</th>
                  </tr>
                </thead>
                <tbody>
                  {allMetrics.map((m, i) => {
                    const isSelected = selectedShareId === m.shareId;
                    const sc = sectorColor(m.sector);
                    return (
                      <tr
                        key={m.shareId}
                        onClick={() => setSelectedShareId(isSelected ? null : m.shareId)}
                        className={`cursor-pointer transition-colors border-b border-slate-100 ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                        style={{ borderLeftColor: isSelected ? '#3B82F6' : sc, borderLeftWidth: 3 }}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 w-4 text-right">{i + 1}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold text-white leading-none"
                              style={{ backgroundColor: sc }}>{m.ticker}</span>
                            <span className={`font-medium text-sm truncate ${isSelected ? 'text-blue-700' : m.heldShares > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                              {m.shareName || m.ticker}
                            </span>
                          </div>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono text-xs ${isSelected ? 'text-blue-700 font-bold' : 'text-slate-600'}`}>
                          {m.marketValue > 0 ? fmtCur(m.marketValue) : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-slate-800 border-t-2 border-slate-600">
                  <tr>
                    <td className="px-4 py-2.5 text-xs font-bold text-slate-300 uppercase">Total</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-white font-mono">{fmtCur(grandTotal.marketValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Right: Name card detail */}
          <div className="flex flex-col gap-4">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm min-h-[300px]">
                Select a share from the table to view details
              </div>
            ) : (
              <>
                {/* Header card */}
                <div className="rounded-xl px-6 py-5 text-center text-white" style={{ background: sectorColor(selected.sector) }}>
                  <p className="text-2xl font-extrabold">{selected.shareName || selected.ticker}</p>
                  <p className="text-xs mt-1 font-semibold uppercase tracking-wide opacity-80">{selected.sector} · {selected.ticker}</p>
                </div>

                {/* 2-column metric cards */}
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="AER"
                    value={`${selected.aer.toFixed(1)}%`}
                    bg="bg-yellow-50"
                    textColor={selected.aer >= 0 ? 'text-green-700' : 'text-red-600'}
                    border="border-yellow-200"
                  />
                  <MetricCard
                    label="Total Returns on Bal. Shares"
                    value={fmtCur(selected.netMarketValue)}
                    bg="bg-green-50"
                    textColor="text-green-800"
                    border="border-green-200"
                  />
                  <MetricCard
                    label="Bal. No. of Shares"
                    value={fmtNum(selected.heldShares)}
                    bg="bg-pink-50"
                    textColor="text-pink-800"
                    border="border-pink-200"
                  />
                  <MetricCard
                    label="Total bal. of Dividends"
                    value={fmtCur(selected.dividends)}
                    bg="bg-teal-50"
                    textColor="text-teal-800"
                    border="border-teal-200"
                  />
                  <MetricCard
                    label="Market Value of current share portfolio"
                    value={fmtCur(selected.marketValue)}
                    bg="bg-blue-50"
                    textColor="text-blue-800"
                    border="border-blue-200"
                  />
                  <MetricCard
                    label="Total Cost of current share portfolio"
                    value={fmtCur(selected.cost)}
                    bg="bg-orange-50"
                    textColor="text-orange-800"
                    border="border-orange-200"
                  />
                  <MetricCard
                    label="Market Price per share"
                    value={`Rs. ${selected.latestPrice.toFixed(2)}`}
                    bg="bg-slate-50"
                    textColor="text-slate-800"
                    border="border-slate-200"
                  />
                  <MetricCard
                    label="Costs per share"
                    value={`Rs. ${selected.avgCostPerShare.toFixed(2)}`}
                    bg="bg-rose-50"
                    textColor="text-rose-800"
                    border="border-rose-200"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, bg, textColor, border }: { label: string; value: string; bg: string; textColor: string; border: string }) {
  return (
    <div className={`${bg} ${border} border rounded-xl px-4 py-3 flex flex-col gap-1`}>
      <span className={`text-lg font-extrabold ${textColor} leading-tight`}>{value}</span>
      <span className="text-xs text-gray-500 leading-snug">{label}</span>
    </div>
  );
}
