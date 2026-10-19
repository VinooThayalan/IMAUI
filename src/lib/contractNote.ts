/**
 * A broker's contract note read against what is on record: the share it is for, the
 * transaction it confirms, whose note it is, and its trade date. Each answer is given
 * only when exactly one record fits; a guessed link is worse than none.
 */

import { parseDisplayDate } from './dateInput';

/** Account numbers compared without spacing or hyphens: "SBL - 4328 -LC/00" is "SBL-4328-LC/00". */
export const accountKey = (n: string) => n.replace(/[\s-]/g, '').toUpperCase();

const tickerKey = (t: string) => t.trim().toUpperCase();

/**
 * The share a printed security names. "JKH.N0000" must match in full; a bare "JKH"
 * matches only when one share has that symbol ("HNB" is HNB.N0000 or HNB.X0000).
 */
export function matchShareByTicker<S extends { ticker: string | null }>(printed: string | null | undefined, shares: S[]): S | null {
  const p = tickerKey(printed ?? '');
  if (!p) return null;
  const exact = shares.filter(s => s.ticker && tickerKey(s.ticker) === p);
  if (exact.length > 0) return exact.length === 1 ? exact[0] : null;
  if (p.includes('.')) return null;
  const bySymbol = shares.filter(s => s.ticker && tickerKey(s.ticker).split('.')[0] === p);
  return bySymbol.length === 1 ? bySymbol[0] : null;
}

export interface NoteFacts {
  shareId: string;
  type: 'Buy' | 'Sell';
  quantity: number;
  /** yyyy-mm-dd, when the note's trade date was read. */
  tradeDate: string | null;
  /** The CDS account printed on the note, when read. */
  account: string | null;
}

/**
 * The one transaction a note confirms: same share, side and quantity, the same trade
 * date and CDS account wherever both sides record one. Null when none or several fit.
 */
export function matchNoteTransaction<T extends {
  share_id: string;
  transaction_type: string;
  no_of_shares: number | string;
  transaction_date?: string | null;
  cds_account_id?: string | null;
}>(note: NoteFacts, transactions: T[]): T | null {
  const fits = transactions.filter(t =>
    t.share_id === note.shareId &&
    t.transaction_type?.toUpperCase() === note.type.toUpperCase() &&
    Math.abs(Number(t.no_of_shares) - note.quantity) < 0.0001 &&
    (!note.tradeDate || !t.transaction_date || t.transaction_date.slice(0, 10) === note.tradeDate) &&
    (!note.account || !t.cds_account_id?.trim() || accountKey(t.cds_account_id) === accountKey(note.account)));
  return fits.length === 1 ? fits[0] : null;
}

/**
 * Whose note it is: the broker printed on it, else the linked transaction's. The printed
 * name wins because the note is that broker's own document; `differs` flags a
 * transaction booked with someone else, for the screen to show rather than settle.
 */
export function noteBroker(printedBrokerId: string | null | undefined, transactionBrokerId: string | null | undefined) {
  return {
    brokerId: printedBrokerId || transactionBrokerId || null,
    differs: !!printedBrokerId && !!transactionBrokerId && printedBrokerId !== transactionBrokerId,
  };
}

/**
 * The yyyy-mm-dd on a note's "Trade Date : dd/mm/yyyy" (or "Transaction Date") line, or
 * null. Read from laid-out lines: these PDFs store every label before every value, so
 * the raw text never has the two side by side.
 */
export function printedTradeDate(lines: string[]): string | null {
  for (const line of lines) {
    const m = /^(?:Transaction|Trade)\s*Date\s*:?\s*(\d{2}\/\d{2}\/\d{4})\b/i.exec(line.trim());
    if (m) return parseDisplayDate(m[1]) || null;
  }
  return null;
}
