/**
 * The one categorical palette every chart in the app draws from.
 *
 * These hexes were validated rather than eyeballed, and the rules they satisfy
 * are worth stating because anything added here has to satisfy them too:
 *
 *  - every colour sits inside the mid-lightness band and above the chroma floor,
 *    so nothing renders as a near-grey next to a real hue;
 *  - the orderings below are greedy max-min on CIEDE2000, taken as the minimum
 *    across normal vision and protan/deutan/tritan simulation. That makes every
 *    *prefix* as separable as the inventory allows: the first five differ by at
 *    least ΔE 23 (normal) / 14 (worst CVD), the first eight by ΔE 17 / 10;
 *  - a handful sit below 3:1 contrast on white. That is allowed here because
 *    every chart in this app direct-labels its data — PieChart legends each item
 *    with its name and percentage — so identity is never carried by colour alone.
 *
 * Separation necessarily degrades past eight slots: sixteen mutually distinct
 * hues do not exist at this lightness. Charts with more than eight categories
 * still get a distinct colour per slot, but the tail pairs are close, and under
 * CVD the two greens at slots 14/16 are effectively the same colour.
 */

/** The hue inventory. The two orderings below are permutations of this set. */
export const CATEGORICAL_COLORS = [
  '#2a78d6', '#e34948', '#008300', '#eda100',
  '#4a3aa7', '#eb6834', '#1baf7a', '#e87ba4',
  '#15803d', '#0369a1', '#b45309', '#b91c6b',
  '#a16207', '#0891b2', '#9a3412', '#6d28d9',
] as const;

/** Slots for shares, in assignment order. Opens on blue. */
export const SHARE_COLORS = [
  '#2a78d6', // blue
  '#e34948', // red
  '#008300', // green
  '#eda100', // yellow
  '#4a3aa7', // violet
  '#e87ba4', // pink
  '#b91c6b', // magenta
  '#1baf7a', // aqua
  '#0369a1', // deep blue
  '#6d28d9', // purple
  '#0891b2', // cyan
  '#9a3412', // rust
  '#eb6834', // orange
  '#b45309', // amber-brown
  '#15803d', // forest
  '#a16207', // olive
];

/**
 * Slots for sectors, in assignment order. Same inventory as SHARE_COLORS but a
 * different order, so the leading sector and the leading share are not painted
 * the same colour on a page that shows both.
 */
export const SECTOR_COLORS = [
  '#15803d', // forest
  '#6d28d9', // purple
  '#e87ba4', // pink
  '#eda100', // yellow
  '#b91c6b', // magenta
  '#2a78d6', // blue
  '#1baf7a', // aqua
  '#9a3412', // rust
  '#0369a1', // deep blue
  '#b45309', // amber-brown
  '#e34948', // red
  '#4a3aa7', // violet
  '#0891b2', // cyan
  '#008300', // green
  '#eb6834', // orange
  '#a16207', // olive
];

/**
 * Only for a key that is not in the map at all — an empty sector string, a
 * ticker the map was not built from. Never for overflow: a category that runs
 * off the end of the palette wraps around instead, because a grey slice reads
 * as "no data" rather than as the 17th category.
 */
export const CHART_COLOR_FALLBACK = '#6B7280';

/**
 * The two series of the price-vs-cost chart. Blue/orange is the canonical
 * two-series pair (ΔE 33.6 normal, 24.7 worst CVD). Deliberately not red — red
 * is reserved for status and would read as a verdict on cost rather than as a
 * second series.
 */
export const PRICE_SERIES_COLOR = '#2a78d6';
export const COST_SERIES_COLOR  = '#eb6834';

/**
 * Assign palette slots to keys, sorted alphabetically.
 *
 * Sorting is what makes the colour follow the thing rather than its rank. Charts
 * here are ordered by value, so indexing by list position meant a price movement
 * or an entity filter repainted everything, and the same share came out blue in
 * one chart and red in another. Sorted assignment depends only on which keys
 * exist, so a share or sector keeps its colour across every chart on the page
 * and as the numbers move.
 *
 * Callers should pass the keys that can actually appear in a chart — not a wider
 * universe. Feeding in shares that are never plotted pushes the plotted ones
 * deep into the palette for no reason.
 */
export function buildColorMap(keys: Iterable<string>, palette: string[]): Map<string, string> {
  const map = new Map<string, string>();
  Array.from(new Set(keys))
    .sort()
    .forEach((key, i) => map.set(key, palette[i % palette.length]));
  return map;
}

export function buildShareColorMap(rows: { ticker: string }[]): Map<string, string> {
  return buildColorMap(rows.map(r => r.ticker), SHARE_COLORS);
}

export function buildSectorColorMap(rows: { sector: string }[]): Map<string, string> {
  return buildColorMap(rows.map(r => r.sector), SECTOR_COLORS);
}
