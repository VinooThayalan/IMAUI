import { useState, useEffect, useCallback } from 'react';
import { formatAer } from '../lib/aer';
import { sectorTotals, sectorSeries, sectorShareBreakdown } from '../services/sectorBreakdown.service';
import { loadShareMetrics, type ShareMetric } from '../services/shareMetrics.service';
import * as entitiesRepo from '../repositories/entities.repo';
import { PieChart } from '../components/PieChart';
import { Building2 } from 'lucide-react';
import {
  CHART_COLOR_FALLBACK,
  COST_SERIES_COLOR,
  PRICE_SERIES_COLOR,
  buildSectorColorMap,
  buildShareColorMap,
} from '../lib/chartColors';

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

// AER lives in ../lib/aer — this file used to carry its own copy of the solver
// that returned its last iterate on non-convergence, so a failed solve surfaced
// as a real-looking rate rather than "no answer".

// ── Types ─────────────────────────────────────────────────────────────────────

interface Entity { id: string; name: string; }

interface ShareRow {
  id: string;
  ticker: string;
  share_name: string;
  sector: string;
  sectorColor: string | null;
}

/**
 * The shape the service returns. Declared there, not here: this page held its own
 * copy, which is how it drifted out of step with what the service computes.
 */
type ShareMetrics = ShareMetric;

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
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded inline-block" style={{ background: PRICE_SERIES_COLOR }} /><span className="text-sm text-gray-600 font-medium">Market Price per share</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded inline-block" style={{ background: COST_SERIES_COLOR }} /><span className="text-sm text-gray-600 font-medium">Cost per share</span></div>
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
              <rect x={cx - barW - 2} y={pxY} width={barW} height={pxH} fill={PRICE_SERIES_COLOR} rx={3} />
              <rect x={cx + 2}        y={cxY} width={barW} height={cxH} fill={COST_SERIES_COLOR} rx={3} />
              <text x={cx} y={padT + chartH + 16} textAnchor="end" fontSize={11} fill="#374151"
                transform={`rotate(-42, ${cx}, ${padT + chartH + 16})`}>{b.label}</text>
              <text x={cx - barW / 2 - 2} y={pxY - 6} textAnchor="middle" fontSize={10} fill={PRICE_SERIES_COLOR} fontWeight="700">
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

  /*
    One source of truth for what a holding is.

    This used to compute holdings here, from `transactions` and unfiltered
    `buy_sell_notes`, and never read `scrip_entries` at all -- so it reported
    fewer shares than the holder owned and disagreed with Share Analytics and
    Portfolio Summary on market value, net market value, total returns and AER.
    Four reported defects, one divergence.

    It now goes through the same ledger every other screen uses.
  */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [metrics, entityRows] = await Promise.all([
        loadShareMetrics(selectedEntityId || undefined),
        entitiesRepo.listAll(),
      ]);

      setShares(
        metrics.map(m => ({
          id: m.shareId,
          ticker: m.ticker,
          share_name: m.shareName,
          sector: m.sector,
          sectorColor: m.sectorColor,
        })),
      );
      setMetrics(metrics);
      setEntities(entityRows.map(e => ({ id: e.id, name: e.name })));
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

  // KPI aggregates (all shares with holdings)
  const held = metrics.filter(m => m.heldShares > 0);

  // Keyed on ticker / sector name, not on list position — see the build helpers.
  //
  // Declared here, above every use. These are `const` arrow functions, so a
  // reference before this point is a temporal-dead-zone throw, not undefined —
  // "Cannot access 'sectorColor' before initialization", which took the whole
  // page down. They only need `metrics` and `held`, so this is the earliest
  // correct spot.
  //
  // Worth knowing why the compiler stayed quiet: the earlier uses were inside
  // `.map()` callbacks, and TypeScript will not flag use-before-declaration
  // through a function boundary because it cannot know when the function runs.
  // `.map` runs immediately, so it threw on first render.
  //
  // Shares are keyed off `held`, not off all of `metrics`. Every chart that
  // colours by share plots held shares only, and `metrics` carries the whole
  // universe including shares long since sold — feeding it the full list pushed
  // most of the plotted shares past the end of the palette, which is why the
  // top-5 pies came out mostly grey.
  const shareColorMap = buildShareColorMap(held);
  const shareColor = (ticker: string) => shareColorMap.get(ticker) ?? CHART_COLOR_FALLBACK;

  // Sectors are keyed off `shares`, not `metrics`. `metrics` is built from
  // `holdMap`, so it only covers shares that have a transaction or an opening
  // balance — the portfolio table below lists every active share, including ones
  // that have never traded, and those would miss the map and come out grey.
  // `shares` is the safe superset: `metrics` is derived from it and drops any
  // share it cannot find there, so it can never hold a sector `shares` lacks.
  //
  // Both functions are handed to Sections 5 and 6 rather than rebuilt there. A
  // section that derives its own map from a narrower list assigns different slots
  // and paints the same sector two colours on one page.
  const sectorColorMap = buildSectorColorMap(shares);
  const sectorColor = (sector: string) => sectorColorMap.get(sector) ?? CHART_COLOR_FALLBACK;

  // Top 5 contributors by net market value (held > 0)
  const top5 = held.slice(0, 5);
  const totalReturnsSinceInception = held.reduce((s, m) => s + m.totalReturns, 0);
  const totalReturnsBalShares      = held.reduce((s, m) => s + m.netMarketValue, 0);
  const totalDividendsSinceInc     = held.reduce((s, m) => s + m.dividends, 0);
  const totalBalDividends          = held.reduce((s, m) => s + m.dividends, 0);
  const totalMarketValue           = held.reduce((s, m) => s + m.marketValue, 0);
  const totalCostsBalShares        = held.reduce((s, m) => s + m.cost, 0);

  /*
    Sector aggregates over EVERY position, not just what is still held.

    `held` drops any share sold down to zero. Its realised gains and the
    dividends it paid are real and belong in a returns or dividends breakdown,
    and a sector whose shares have all been sold was disappearing from the chart
    and from the sector count entirely — the other half of "has not considered
    all the sectors".

    Market value is unaffected in substance: an exited position values at zero,
    so it shows in the legend as not plotted rather than silently vanishing.

    Grouping, and the rule that a breakdown reports every sector it was given,
    live in sectorBreakdown.service.
  */
  const sectors = sectorTotals(metrics);
  const sectorNames = sectors.map(s => s.sector);

  const sectorReturnsPie = sectorSeries(sectors, 'returns', sectorColor);
  const sectorDivPie     = sectorSeries(sectors, 'dividends', sectorColor);
  const sectorMvPie      = sectorSeries(sectors, 'marketValue', sectorColor);

  // Top-5 pie charts
  const top5NetMktPie  = mkPiePct(top5.map(m => ({ label: m.ticker, value: m.netMarketValue,  color: shareColor(m.ticker) })));
  const top5DivPie     = mkPiePct(top5.map(m => ({ label: m.ticker, value: m.dividends,       color: shareColor(m.ticker) })));
  const top5ReturnsPie = mkPiePct(top5.map(m => ({ label: m.ticker, value: m.totalReturns,    color: shareColor(m.ticker) })));
  const top5CostPie    = mkPiePct(top5.map(m => ({ label: m.ticker, value: m.totalCostAll,    color: shareColor(m.ticker) })));

  // Top-5 bar charts — use share name for x-axis labels
  const top5PriceCost  = top5.map(m => ({ label: m.shareName || m.ticker, price: m.latestPrice,      cost: m.avgCostPerShare, color: shareColor(m.ticker) }));
  const top5BalShares  = top5.map(m => ({ label: m.shareName || m.ticker, value: m.heldShares,        color: shareColor(m.ticker) }));
  // Shares with no computable AER are left out of the chart rather than
  // plotted as a 0% bar, which would read as a flat return.
  const top5AER        = top5
    .filter(m => m.aer !== null)
    .map(m => ({ label: m.shareName || m.ticker, value: m.aer as number, color: shareColor(m.ticker) }));

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
          <p className="text-xs text-gray-500 mt-0.5">Breakdown across {sectors.length} sectors</p>
          {/* Sector color legend */}
          {sectors.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {sectorNames.map(s => (
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
            <PieChart data={sectorReturnsPie} title="" size={210} formatValue={fmtCur} />
          </div>
          <div className="rounded-xl p-5 border" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%)', borderColor: '#a7f3d0' }}>
            <p className="text-xs font-bold mb-4 text-center uppercase tracking-wide" style={{ color: '#059669' }}>Total Dividends by Sector</p>
            <PieChart data={sectorDivPie} title="" size={210} formatValue={fmtCur} />
          </div>
          <div className="rounded-xl p-5 border" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)', borderColor: '#bfdbfe' }}>
            <p className="text-xs font-bold mb-4 text-center uppercase tracking-wide" style={{ color: '#2563eb' }}>Market Value by Sector</p>
            <PieChart data={sectorMvPie} title="" size={210} formatValue={fmtCur} />
          </div>
        </div>
        {/* Sector breakdown table with color bands */}
        {sectors.length > 0 && (
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
                  {[...sectors]
                    .sort((a, b) => b.marketValue - a.marketValue)
                    .map(({ sector, ...vals }) => {
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
              {top5.map(m => (
                <span key={m.shareId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-sm border border-white/20" style={{ background: shareColor(m.ticker) }}>
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
            <PieChart data={top5DivPie} title="" size={260} formatValue={fmtCur} />
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-rose-50 rounded-xl p-6 border border-rose-100">
            <p className="text-sm font-bold text-slate-700 mb-4 text-center">Total Returns by Share</p>
            <PieChart data={top5ReturnsPie} title="" size={260} formatValue={fmtCur} />
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
                    {top5.map(m => (
                      <tr key={m.shareId}>
                        {/* The swatch carries identity; the label stays in ink. Colouring
                            the text itself made low-contrast slots hard to read and tied
                            legibility to the palette. */}
                        <td className="py-1.5 font-semibold text-gray-900">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ background: shareColor(m.ticker) }}
                              aria-hidden="true"
                            />
                            {m.ticker}
                          </span>
                        </td>
                        <td className="py-1.5 text-right text-gray-600">{fmtNum(m.heldShares)}</td>
                        <td className="py-1.5 text-right text-gray-800 font-semibold">{fmtCur(m.marketValue)}</td>
                        <td
                          className={`py-1.5 text-right font-semibold ${m.aer === null ? 'text-gray-400' : m.aer >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          title={m.entityCount > 1
                            ? `Pooled across ${m.entityCount} entities. Share Analytics reports each holding separately: ${m.byEntity.map(b => `${b.entityName} ${formatAer(b.aer, 1)}`).join(', ')}`
                            : undefined}
                        >
                          {formatAer(m.aer, 1)}
                          {m.entityCount > 1 && <span className="ml-0.5 text-gray-400 font-normal">*</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Only shown when pooling actually changes an answer. A pooled
                    XIRR is not any single holding's AER, and Share Analytics and
                    Portfolio Summary both report per (entity, share) -- so
                    without this the two screens look like they disagree. */}
                {metrics.some(m => m.entityCount > 1) && (
                  <p className="mt-2 text-xs text-gray-400 leading-snug">
                    * AER is pooled across the entities holding that share — the money-weighted
                    return on the whole book, not any one holding. Share Analytics and Portfolio
                    Summary report per entity; hover the figure to see each. Select a single entity
                    above and the numbers line up.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 5: Total Returns by Sector ────────────────────────────── */}
      <Section5TotalReturnsBySector metrics={metrics} shareColor={shareColor} sectorColor={sectorColor} />

      {/* ── Section 6: Share Name Cards ───────────────────────────────────── */}
      <Section6ShareCards metrics={metrics} entityName={selectedEntityName} sectorColor={sectorColor} />

    </div>
  );
}

// ── Section 5 component ───────────────────────────────────────────────────────

function Section5TotalReturnsBySector({ metrics, shareColor, sectorColor }: {
  metrics: ShareMetrics[];
  shareColor: (ticker: string) => string;
  sectorColor: (sector: string) => string;
}) {
  /*
    Every sector, from the data.

    This section picked sectors by matching them against a hardcoded list --
    Banking, Construction Materials, Diversified Financials, Industries -- and
    sector names are user data from the Sector Types screen. The live names are
    GICS ones, so not a single entry matched and the per-sector breakdown
    rendered nothing at all. That is the "not all sectors are considered" report:
    none were.

    It also aggregated over held positions only, so a sector whose shares had all
    been sold lost its realised returns, the same defect fixed in the sector pies
    above. Both rules now live in sectorBreakdown.service.

    Colours come from the parent, so a ticker keeps the same colour here as in
    the top-5 charts above.
  */
  const sectorReturnsPie = sectorSeries(sectorTotals(metrics), 'returns', sectorColor);

  const sectorSharePies = sectorShareBreakdown(
    metrics.map(m => ({ ...m, label: m.ticker })),
    'returns',
    shareColor,
  ).map(b => ({ sector: b.sector, pieData: b.shares }));

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
            data={sectorReturnsPie}
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
                  data={pieData}
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

function Section6ShareCards({ metrics, entityName, sectorColor }: {
  metrics: ShareMetrics[];
  entityName: string;
  sectorColor: (sector: string) => string;
}) {
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
                    label={selected.entityCount > 1 ? `AER (pooled, ${selected.entityCount} entities)` : 'AER'}
                    value={formatAer(selected.aer, 1)}
                    bg="bg-yellow-50"
                    textColor={selected.aer === null ? 'text-gray-400' : selected.aer >= 0 ? 'text-green-700' : 'text-red-600'}
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
