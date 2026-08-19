/**
 * Groups holdings by sector for the Dashboard's sector charts.
 *
 * The rule this exists to hold: **a breakdown reports every sector it was given,
 * including the ones a pie cannot draw.**
 *
 * The Dashboard used to filter each series to `value > 0` on the way into the
 * chart, which removed the row from the legend as well as from the slices. The
 * heading counts every sector, so a sector with a negative return disappeared
 * from the chart while still being counted above it — "Breakdown across 3
 * sectors" over a two-slice pie, with the remaining percentages quietly
 * restated as shares of a subtotal.
 *
 * Deciding what is plottable is a presentation concern and stays in PieChart.
 * Deciding what belongs in the breakdown is a business concern and lives here.
 *
 * No React and no Supabase: totals in, series out.
 */

/** What this service needs of a position. Any holding shape satisfying it works. */
export interface SectorContribution {
  sector: string;
  totalReturns: number;
  dividends: number;
  marketValue: number;
}

export interface SectorTotals {
  sector: string;
  returns: number;
  dividends: number;
  marketValue: number;
}

/** A chart series entry. `percentage` is left to the chart, which owns the basis. */
export interface SeriesPoint {
  label: string;
  value: number;
  color: string;
}

/**
 * Sector totals, ordered by name.
 *
 * Sorted rather than left in encounter order so the sector chips, the three
 * pies and the legend all list sectors the same way, and so the order does not
 * shift when a price moves.
 */
export function sectorTotals(holdings: SectorContribution[]): SectorTotals[] {
  const acc = new Map<string, SectorTotals>();

  for (const h of holdings) {
    const sector = h.sector || 'Other';
    let row = acc.get(sector);
    if (!row) {
      row = { sector, returns: 0, dividends: 0, marketValue: 0 };
      acc.set(sector, row);
    }
    row.returns += h.totalReturns;
    row.dividends += h.dividends;
    row.marketValue += h.marketValue;
  }

  return Array.from(acc.values()).sort((a, b) => a.sector.localeCompare(b.sector));
}

type Metric = 'returns' | 'dividends' | 'marketValue';

/**
 * One series per metric, over every sector.
 *
 * Nothing is filtered out. A sector with zero or negative returns is still a
 * fact about the portfolio, and the chart is responsible for saying it cannot
 * draw it — not for pretending it does not exist.
 */
export function sectorSeries(
  totals: SectorTotals[],
  metric: Metric,
  colorFor: (sector: string) => string,
): SeriesPoint[] {
  return totals.map(t => ({ label: t.sector, value: t[metric], color: colorFor(t.sector) }));
}

/**
 * Sectors that cannot appear as a slice, for callers that want to say so
 * outside the chart itself (a heading, a caption, an export).
 */
export function notPlottable(totals: SectorTotals[], metric: Metric): string[] {
  return totals.filter(t => !(t[metric] > 0)).map(t => t.sector);
}

/** A position that can be attributed to a sector and named on a chart. */
export interface SectorMember extends SectorContribution {
  /** Ticker, or whatever should label this slice. */
  label: string;
}

export interface SectorShareBreakdown {
  sector: string;
  /** That sector's total for the metric, so a caller can order or caption it. */
  total: number;
  /** Each position's contribution within the sector, largest first. */
  shares: SeriesPoint[];
}

/**
 * Which sectors get a breakdown, and what goes in each.
 *
 * Every sector present is included. The Dashboard used to pick sectors by
 * matching them against a hardcoded list of names — Banking, Construction
 * Materials, Diversified Financials, Industries — and sector names are user data
 * maintained on the Sector Types screen. The live names are GICS ones (Finance,
 * Materials, Industrials, Consumer Staples and so on), so **not one entry
 * matched** and the breakdown rendered nothing at all. No hardcoded list can be
 * right here; the names come from the data or they are wrong.
 *
 * Ordered by the size of each sector's contribution, largest first, because that
 * is the question a returns breakdown answers. Ties fall back to the name so the
 * order is deterministic.
 */
export function sectorShareBreakdown(
  members: SectorMember[],
  metric: Metric,
  colorFor: (label: string) => string,
): SectorShareBreakdown[] {
  const bySector = new Map<string, SectorMember[]>();
  for (const m of members) {
    const sector = m.sector || 'Other';
    const list = bySector.get(sector) ?? [];
    list.push(m);
    bySector.set(sector, list);
  }

  // A sector total is keyed `returns`; a position calls the same thing
  // `totalReturns`. Map once here rather than letting callers guess.
  // Narrowed to the numeric fields: `keyof SectorContribution` would include
  // `sector`, and indexing with it yields string | number.
  const FIELD: Record<Metric, 'totalReturns' | 'dividends' | 'marketValue'> = {
    returns: 'totalReturns',
    dividends: 'dividends',
    marketValue: 'marketValue',
  };
  const field = FIELD[metric];

  const out: SectorShareBreakdown[] = [];
  for (const [sector, list] of bySector) {
    out.push({
      sector,
      total: list.reduce((s, m) => s + m[field], 0),
      // Nothing filtered: a position that cannot be drawn is still reported, and
      // the chart says why. See the note on sectorSeries.
      shares: list
        .map(m => ({ label: m.label, value: m[field], color: colorFor(m.label) }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
    });
  }

  return out.sort(
    (a, b) => Math.abs(b.total) - Math.abs(a.total) || a.sector.localeCompare(b.sector),
  );
}
