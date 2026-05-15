import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { PieChart } from '../components/PieChart';

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
  if (v >= 1_000_000_000) return `Rs. ${(v / 1_000_000_000).toFixed(2)}bn`;
  if (v >= 1_000_000)     return `Rs. ${(v / 1_000_000).toFixed(2)}m`;
  if (v >= 1_000)         return `Rs. ${(v / 1_000).toFixed(2)}k`;
  return `Rs. ${v.toFixed(2)}`;
}

function fmtNum(v: number) { return v.toLocaleString(undefined, { maximumFractionDigits: 0 }); }

// ── Types ─────────────────────────────────────────────────────────────────────

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
  aer: number; // (netMarketValue + dividends) / cost * 100
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
  const W = 420, H = 220, padL = 60, padR = 10, padT = 20, padB = 54;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = Math.min(40, (chartW / bars.length) * 0.55);
  const gap  = chartW / bars.length;

  const yTicks = 4;
  const yStep  = maxVal / yTicks;

  return (
    <div>
      {title && <p className="text-xs font-bold text-gray-700 mb-2">{title}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
        {/* y-axis label */}
        {yLabel && (
          <text x={10} y={H / 2} textAnchor="middle" fontSize={9} fill="#9CA3AF"
            transform={`rotate(-90, 10, ${H / 2})`}>{yLabel}</text>
        )}
        {/* grid lines + y ticks */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const y = padT + chartH - (i / yTicks) * chartH;
          const val = i * yStep;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#E5E7EB" strokeWidth={1} />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={8} fill="#9CA3AF">
                {val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}m` : val >= 1_000 ? `${(val / 1_000).toFixed(0)}k` : val.toFixed(0)}
              </text>
            </g>
          );
        })}
        {/* bars */}
        {bars.map((b, i) => {
          const x    = padL + i * gap + gap / 2 - barW / 2;
          const pct  = Math.abs(b.value) / maxVal;
          const bH   = Math.max(2, pct * chartH);
          const y    = padT + chartH - bH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bH} fill={b.color} rx={2} />
              <text x={x + barW / 2} y={padT + chartH + 12} textAnchor="middle" fontSize={8} fill="#374151"
                transform={`rotate(-35, ${x + barW / 2}, ${padT + chartH + 12})`}>
                {b.label}
              </text>
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={7} fill="#6B7280">
                {formatValue(b.value)}
              </text>
            </g>
          );
        })}
        {/* x-axis */}
        <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#D1D5DB" strokeWidth={1} />
      </svg>
    </div>
  );
}

// ── Grouped bar chart for price vs cost ──────────────────────────────────────

function PriceCostBarChart({ title, bars }: { title: string; bars: { label: string; price: number; cost: number }[] }) {
  if (bars.length === 0) return null;
  const maxVal = Math.max(...bars.flatMap(b => [b.price, b.cost]), 1);
  const W = 420, H = 230, padL = 65, padR = 10, padT = 30, padB = 54;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const groupW = chartW / bars.length;
  const barW   = Math.min(16, groupW * 0.3);
  const yTicks = 4;
  const yStep  = maxVal / yTicks;

  return (
    <div>
      {title && <p className="text-xs font-bold text-gray-700 mb-2">{title}</p>}
      {/* Legend */}
      <div className="flex items-center gap-4 mb-1">
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#1E3A5F' }} /><span className="text-xs text-gray-500">Net Market Price per share</span></div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#F59E0B' }} /><span className="text-xs text-gray-500">Cost per share</span></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 230 }}>
        {/* y-axis label */}
        <text x={10} y={H / 2} textAnchor="middle" fontSize={9} fill="#9CA3AF"
          transform={`rotate(-90, 10, ${H / 2})`}>Net Market Price per share</text>
        {/* grid + ticks */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const y = padT + chartH - (i / yTicks) * chartH;
          const val = i * yStep;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#E5E7EB" strokeWidth={1} />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={8} fill="#9CA3AF">
                {val >= 1_000 ? `${(val / 1_000).toFixed(0)}k` : val.toFixed(0)}
              </text>
            </g>
          );
        })}
        {bars.map((b, i) => {
          const cx    = padL + i * groupW + groupW / 2;
          const pxH   = Math.max(2, (b.price / maxVal) * chartH);
          const cxH   = Math.max(2, (b.cost / maxVal) * chartH);
          const pxY   = padT + chartH - pxH;
          const cxY   = padT + chartH - cxH;
          return (
            <g key={i}>
              <rect x={cx - barW - 1} y={pxY} width={barW} height={pxH} fill="#1E3A5F" rx={2} />
              <rect x={cx + 1}        y={cxY} width={barW} height={cxH} fill="#F59E0B" rx={2} />
              <text x={cx} y={padT + chartH + 12} textAnchor="middle" fontSize={8} fill="#374151"
                transform={`rotate(-35, ${cx}, ${padT + chartH + 12})`}>{b.label}</text>
              <text x={cx - barW / 2 - 1} y={pxY - 3} textAnchor="middle" fontSize={6} fill="#6B7280">
                {b.price >= 1000 ? `${(b.price/1000).toFixed(1)}k` : b.price.toFixed(0)}
              </text>
            </g>
          );
        })}
        <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#D1D5DB" strokeWidth={1} />
      </svg>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [shares, setShares]   = useState<ShareRow[]>([]);
  const [metrics, setMetrics] = useState<ShareMetrics[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sharesRes, txnsRes, pricesRes, dividendsRes, notesRes] = await Promise.all([
        supabase.from('shares').select('id, ticker, share_name, sector').eq('is_active', true).order('share_name'),
        supabase.from('transactions').select('share_id, transaction_type, no_of_shares, total_amount, price_per_share, approval_status'),
        supabase.from('daily_share_prices').select('share_id, share_price, effective_date').order('effective_date', { ascending: false }),
        supabase.from('dividends').select('share_id, amount_net'),
        supabase.from('buy_sell_notes').select('transaction_id, no_of_shares, price_avg, gross_amount, note_type').not('transaction_id', 'is', null),
      ]);

      const shareRows: ShareRow[] = (sharesRes.data || []).map((s: any) => ({
        id: s.id, ticker: s.ticker || '', share_name: s.share_name || s.ticker || '', sector: s.sector || 'Other',
      }));
      setShares(shareRows);

      const shareMap = new Map(shareRows.map(s => [s.id, s]));

      // latest price per share
      const latestPrices = new Map<string, number>();
      (pricesRes.data || []).forEach((p: any) => {
        if (!latestPrices.has(p.share_id)) latestPrices.set(p.share_id, Number(p.share_price) || 0);
      });

      // dividends by share
      const divMap = new Map<string, number>();
      (dividendsRes.data || []).forEach((d: any) => {
        divMap.set(d.share_id, (divMap.get(d.share_id) || 0) + Number(d.amount_net));
      });

      // build holdings from buy_sell_notes (processed) + transactions
      // Use notes where available (more accurate), fall back to transactions
      const txnNoteMap = new Map<string, { shares: number; gross: number; type: string }>();
      (notesRes.data || []).forEach((n: any) => {
        txnNoteMap.set(n.transaction_id, { shares: Number(n.no_of_shares) || 0, gross: Number(n.gross_amount) || 0, type: n.note_type });
      });

      // holdings accumulator: share_id -> { held, cost, totalCostAll, saleProceeds }
      type HoldingAcc = { held: number; cost: number; totalCostAll: number; saleProceeds: number };
      const holdMap = new Map<string, HoldingAcc>();

      (txnsRes.data || []).forEach((tx: any) => {
        if (!shareMap.has(tx.share_id)) return;
        const note = txnNoteMap.get(tx.id);
        const shares_qty = note ? note.shares : Number(tx.no_of_shares) || 0;
        const gross      = note ? note.gross  : Number(tx.total_amount) || 0;
        const isBuy      = (tx.transaction_type || '').toUpperCase() === 'BUY';

        if (!holdMap.has(tx.share_id)) holdMap.set(tx.share_id, { held: 0, cost: 0, totalCostAll: 0, saleProceeds: 0 });
        const h = holdMap.get(tx.share_id)!;

        if (isBuy) {
          h.held += shares_qty;
          h.cost += gross;
          h.totalCostAll += gross;
        } else {
          const avgCPS = h.held > 0 ? h.cost / h.held : 0;
          const rmCost = avgCPS * shares_qty;
          h.held          = Math.max(0, h.held - shares_qty);
          h.cost          = Math.max(0, h.cost - rmCost);
          h.saleProceeds += gross;
        }
      });

      const result: ShareMetrics[] = [];
      holdMap.forEach((h, shareId) => {
        const sr    = shareMap.get(shareId);
        if (!sr) return;
        const price = latestPrices.get(shareId) || 0;
        const mv    = h.held * price;
        const divs  = divMap.get(shareId) || 0;
        const nmv   = mv - h.cost;
        const tr    = (mv + h.saleProceeds + divs) - h.totalCostAll;
        const aer   = h.cost > 0 ? ((nmv + divs) / h.cost) * 100 : 0;
        const avgCPS = h.held > 0 ? h.cost / h.held : 0;

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
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
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

  // Top-5 bar charts
  const top5PriceCost  = top5.map((m, i) => ({ label: m.ticker, price: m.latestPrice,      cost: m.avgCostPerShare, color: shareColor(i) }));
  const top5BalShares  = top5.map((m, i) => ({ label: m.ticker, value: m.heldShares,        color: shareColor(i) }));
  const top5AER        = top5.map((m, i) => ({ label: m.ticker, value: m.aer,               color: shareColor(i) }));

  // Share portfolio table — all active shares
  const portfolioShares = shares.filter(s => held.some(m => m.shareId === s.id) || true);

  return (
    <div className="p-6 space-y-8">

      {/* ── Section 1: Share Portfolio Table + KPI cards ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Share portfolio table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Metrocorp Share Portfolio</h2>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Share Names</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Sector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {portfolioShares.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2 text-gray-800 font-medium">{s.share_name || s.ticker}</td>
                    <td className="px-4 py-2 text-gray-500">{s.sector}</td>
                  </tr>
                ))}
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
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Portfolio by Sector</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center">
            <PieChart data={sectorReturnsPie.filter(d => d.value > 0)} title="Total Returns on Bal. Shares by Sector" size={210} />
          </div>
          <div className="flex flex-col items-center">
            <PieChart data={sectorDivPie.filter(d => d.value > 0)} title="Total Dividends by Sector" size={210} />
          </div>
          <div className="flex flex-col items-center">
            <PieChart data={sectorMvPie.filter(d => d.value > 0)} title="Market Value of Share Portfolio by Sector" size={210} />
          </div>
        </div>
      </div>

      {/* ── Section 3: Metrocorp's Main Contributors – pie charts ─────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-blue-50">
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Metrocorp's Main Contributors</h2>
          <p className="text-xs text-gray-500 mt-0.5">Top 5 shares by net market value</p>
          {top5.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {top5.map((m, i) => (
                <span key={m.shareId} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: shareColor(i) }}>
                  {m.ticker}
                  <span className="opacity-80">{fmtCur(m.netMarketValue)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex flex-col items-center">
            <p className="text-xs font-bold text-red-600 mb-3 text-center">Total Net Market by Share</p>
            <PieChart data={top5NetMktPie} title="" size={200} />
          </div>
          <div className="flex flex-col items-center">
            <p className="text-xs font-bold text-red-600 mb-3 text-center">Total Dividends by Share</p>
            <PieChart data={top5DivPie.filter(d => d.value > 0)} title="" size={200} />
          </div>
          <div className="flex flex-col items-center">
            <p className="text-xs font-bold text-red-600 mb-3 text-center">Total Returns by Share</p>
            <PieChart data={top5ReturnsPie.filter(d => d.value > 0)} title="" size={200} />
          </div>
          <div className="flex flex-col items-center">
            <p className="text-xs font-bold text-red-600 mb-3 text-center">Total Cost by Share</p>
            <PieChart data={top5CostPie} title="" size={200} />
          </div>
        </div>
      </div>

      {/* ── Section 4: Metrocorp's Main Contributors – bar charts ─────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-blue-50">
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Metrocorp's Main Contributors</h2>
          <p className="text-xs text-gray-500 mt-0.5">Detailed metrics for top 5 contributors</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <PriceCostBarChart title="Net Market Price per share and Cost per share by Share" bars={top5PriceCost} />
          </div>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <BarChart
              title="AER by Share"
              bars={top5AER}
              formatValue={v => `${v.toFixed(1)}%`}
              yLabel="AER %"
            />
          </div>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <BarChart
              title="Total Balance No. of Shares by Share"
              bars={top5BalShares}
              formatValue={v => fmtNum(v)}
              yLabel="Shares"
            />
          </div>
          {/* spacer / future chart */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-center text-gray-300 text-sm">
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

      {/* Section 6 hidden */}

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

function Section6ShareCards({ metrics }: { metrics: ShareMetrics[] }) {
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);

  // Shares ordered ascending by total market value (heldShares > 0 first, then rest with 0)
  const allMetrics = [...metrics].sort((a, b) => a.marketValue - b.marketValue);

  const selected = selectedShareId ? allMetrics.find(m => m.shareId === selectedShareId) : null;

  // Grand totals row
  const grandTotal = allMetrics.reduce((acc, m) => ({
    marketValue: acc.marketValue + m.marketValue,
  }), { marketValue: 0 });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-gray-100">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Share Portfolio Details</h2>
        <p className="text-xs text-gray-500 mt-0.5">Ordered by total market value (ascending). Select a share to see details.</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Share Names</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Total Market Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allMetrics.map((m, i) => {
                    const isSelected = selectedShareId === m.shareId;
                    return (
                      <tr
                        key={m.shareId}
                        onClick={() => setSelectedShareId(isSelected ? null : m.shareId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50 border-l-2 border-l-blue-500'
                            : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/40 hover:bg-gray-100/60'
                        }`}
                      >
                        <td className={`px-4 py-2.5 font-medium ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                          {m.shareName || m.ticker}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono text-xs ${isSelected ? 'text-blue-700 font-bold' : 'text-gray-600'}`}>
                          {m.marketValue > 0 ? fmtCur(m.marketValue) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-700 uppercase">Total</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900 font-mono">{fmtCur(grandTotal.marketValue)}</td>
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
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-5 text-center">
                  <p className="text-2xl font-extrabold text-blue-900">{selected.shareName || selected.ticker}</p>
                  <p className="text-xs text-blue-500 mt-1 font-semibold uppercase tracking-wide">Share Name</p>
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
