/**
 * Annual Equivalent Return (AER).
 *
 * One definition of AER for the whole app. Share Analytics, Portfolio Summary,
 * the Dashboard and Reports all used to carry their own — two of them were not
 * even annualised — so the same holding reported a different return depending
 * on which screen you opened. Everything now goes through `xirr` here.
 */

export interface CashFlow {
  date: Date;
  amount: number;
}

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

/** Below -100% the discount factor base goes non-positive and NPV is undefined. */
const MIN_RATE = -0.9999;

/** Rates scanned for a sign change before bisecting. Covers -99.99% to +10000%. */
const BRACKET_GRID = [
  MIN_RATE, -0.99, -0.95, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1,
  -0.05, 0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 25, 50, 100,
];

function npv(sorted: CashFlow[], d0: number, rate: number): number {
  let total = 0;
  const base = 1 + rate;
  if (base <= 0) return NaN;
  for (const cf of sorted) {
    const t = (cf.date.getTime() - d0) / MS_PER_YEAR;
    total += cf.amount / Math.pow(base, t);
  }
  return total;
}

/**
 * Bisection on a bracketed sign change. Newton is fast but unguarded: on a
 * stream that crosses zero several times it can walk off to a root that is
 * arithmetically valid and financially meaningless, or stall and hand back
 * whatever iterate it happened to be holding. This is the fallback that keeps
 * the answer inside a bracket we actually verified.
 *
 * Where several roots exist the lowest is returned, which at least makes the
 * result deterministic rather than a function of the starting guess.
 */
function bisect(sorted: CashFlow[], d0: number): number {
  let lo = NaN;
  let hi = NaN;
  let fLo = NaN;

  for (let i = 0; i < BRACKET_GRID.length - 1; i++) {
    const a = npv(sorted, d0, BRACKET_GRID[i]);
    const b = npv(sorted, d0, BRACKET_GRID[i + 1]);
    if (!isFinite(a) || !isFinite(b)) continue;
    if (a === 0) return BRACKET_GRID[i];
    if (b === 0) return BRACKET_GRID[i + 1];
    if (a * b < 0) {
      lo = BRACKET_GRID[i];
      hi = BRACKET_GRID[i + 1];
      fLo = a;
      break;
    }
  }
  if (!isFinite(lo)) return NaN;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(sorted, d0, mid);
    if (!isFinite(fMid)) return NaN;
    if (fMid === 0) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
    if (hi - lo < 1e-10) break;
  }
  return (lo + hi) / 2;
}

/**
 * Internal rate of return over irregularly spaced cash flows, as a decimal
 * rate (0.12 = 12% a year). Returns NaN when there is no answer rather than a
 * number that merely looks like one.
 */
export function xirr(cashFlows: CashFlow[], guess = 0.1): number {
  if (cashFlows.length < 2) return NaN;

  const sorted = [...cashFlows]
    .filter(cf => isFinite(cf.amount) && cf.date instanceof Date && isFinite(cf.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (sorted.length < 2) return NaN;

  // Without both an outflow and an inflow the NPV never crosses zero and there
  // is no rate to find. A held position whose market price is missing lands
  // here: all buys, no terminal value.
  let hasInflow = false;
  let hasOutflow = false;
  let scale = 0;
  for (const cf of sorted) {
    if (cf.amount > 0) hasInflow = true;
    else if (cf.amount < 0) hasOutflow = true;
    scale += Math.abs(cf.amount);
  }
  if (!hasInflow || !hasOutflow) return NaN;

  const d0 = sorted[0].date.getTime();
  // All flows on one day: the return is instantaneous and cannot be annualised.
  if (sorted[sorted.length - 1].date.getTime() === d0) return NaN;

  const tolerance = Math.max(scale * 1e-9, 1e-6);

  let rate = guess;
  for (let iter = 0; iter < 100; iter++) {
    const base = 1 + rate;
    if (base <= 0) break;

    let f = 0;
    let df = 0;
    for (const cf of sorted) {
      const t = (cf.date.getTime() - d0) / MS_PER_YEAR;
      const pv = Math.pow(base, t);
      f += cf.amount / pv;
      df -= (t * cf.amount) / (pv * base);
    }
    if (!isFinite(f) || !isFinite(df) || Math.abs(df) < 1e-12) break;

    const next = rate - f / df;
    if (!isFinite(next)) break;

    if (Math.abs(next - rate) < 1e-9) {
      // Converged on *something*. Only hand it back if it actually zeroes the
      // NPV — a stalled iterate satisfies the step test just as well.
      const residual = npv(sorted, d0, next);
      if (isFinite(residual) && Math.abs(residual) <= tolerance) return next;
      break;
    }
    rate = Math.max(MIN_RATE, next);
  }

  return bisect(sorted, d0);
}

/**
 * A same-week round trip annualises into the millions of percent. That is
 * arithmetic rather than performance.
 *
 * The limit began as an overflow guard: share_analytics_cache.aer was
 * numeric(10,4) and could not hold anything at or above 1,000,000, so one such
 * holding failed the entire cache write. 20260807060001 widened the column to
 * numeric(20,4), so the cap is no longer needed for storage — it stays because a
 * seven-figure percentage is noise either way, and reporting nothing is more
 * honest than reporting that.
 */
export const AER_PERCENT_LIMIT = 1_000_000;

/** XIRR rate as an annualised percentage, or null when there is no meaningful answer. */
export function toAerPercent(rate: number): number | null {
  if (!isFinite(rate)) return null;
  const percent = rate * 100;
  return Math.abs(percent) > AER_PERCENT_LIMIT ? null : percent;
}

/** AER percentage for a cash flow stream, or null when it has no solution. */
export function aerPercent(cashFlows: CashFlow[]): number | null {
  if (cashFlows.length < 2) return null;
  try {
    return toAerPercent(xirr(cashFlows));
  } catch {
    return null;
  }
}

/**
 * Terminal value of a holding: what the shares would realise if sold today,
 * after brokerage. Every AER in the app discounts back to this same number —
 * the Share Analytics portfolio card used to use the gross figure instead,
 * which quietly flattered it against every other screen.
 */
export function netMarketValue(
  shares: number,
  marketPrice: number,
  brokerageFeeRatePercent: number,
): number {
  if (!(shares > 0) || !(marketPrice > 0)) return 0;
  return shares * marketPrice * (1 - brokerageFeeRatePercent / 100);
}

export interface AerPosition {
  /** Shown to the user when the position has to be excluded. */
  label: string;
  cashFlows: CashFlow[];
  heldShares: number;
  marketPrice: number;
  /** Percent, e.g. 1.12 for 1.12%. */
  brokerageFeeRate: number;
}

export interface PortfolioAerResult {
  percent: number | null;
  /** Labels of held positions dropped for want of a market price. */
  excluded: string[];
}

/**
 * One AER across many positions, pooling every cash flow and discounting each
 * position's net market value back from `asOf`.
 *
 * Positions still held but carrying no market price are dropped whole. Their
 * terminal value is unknown, and leaving their purchases in the pool without
 * one prices them as a total loss — that single omission was enough to take a
 * +7.4% portfolio to -5.6% in testing. Dropping them narrows what the number
 * covers, so the caller is handed the list to show rather than left to assume
 * the figure spans everything.
 */
export function portfolioAer(positions: AerPosition[], asOf: Date): PortfolioAerResult {
  const pooled: CashFlow[] = [];
  const excluded: string[] = [];

  for (const p of positions) {
    if (p.heldShares > 0 && !(p.marketPrice > 0)) {
      excluded.push(p.label);
      continue;
    }
    pooled.push(...p.cashFlows);
    const terminal = netMarketValue(p.heldShares, p.marketPrice, p.brokerageFeeRate);
    if (terminal > 0) pooled.push({ date: asOf, amount: terminal });
  }

  return { percent: aerPercent(pooled), excluded };
}

/** "-32.79%", "+7.40%", or "—" when there is no answer. */
export function formatAer(percent: number | null, digits = 2): string {
  if (percent === null || !isFinite(percent)) return '—';
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(digits)}%`;
}
