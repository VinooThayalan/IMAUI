/**
 * Contract notes (`buy_sell_notes`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface NoteRow {
  id: string;
  note_type: string;
  trade_date: string | null;
  no_of_shares: number | string;
  price_avg: number | string | null;
  gross_amount: number | string;
  net_amount: number | string;
  transaction_id: string | null;
  /** Stated position within this note's trade date, or null when unstated. */
  intraday_seq: number | null;
}

const NOTE_COLUMNS =
  'id, note_type, trade_date, no_of_shares, price_avg, gross_amount, ' +
  'net_amount, transaction_id, intraday_seq';

/**
 * Only PROCESSED notes.
 *
 * The status filter is the point. A REJECTED or PENDING note is not a settled
 * trade, and a consumer that reads notes without filtering counts amounts the
 * ledger must not see, which is how the Dashboard's figures drifted from every
 * cache-based screen.
 *
 * `intraday_seq` nulls last, matching `sortNotes` in shareLedger.service: a note
 * nobody has ordered runs after the ones somebody has. Postgres would otherwise
 * put nulls first on this ascending order and the two would disagree about a
 * partially sequenced day.
 */
export async function listProcessed(): Promise<NoteRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('buy_sell_notes')
      .select(NOTE_COLUMNS)
      .eq('status', 'PROCESSED')
      .order('trade_date', { ascending: true })
      .order('intraday_seq', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }),
  );
  return rows as unknown as NoteRow[];
}

/** A contract note's figures, for comparing it with its transaction. */
export interface NoteFiguresRow {
  id: string;
  status: string;
  contract_no: string | null;
  trade_date: string | null;
  no_of_shares: number | string | null;
  price_avg: number | string | null;
  gross_amount: number | string | null;
  brokerage: number | string | null;
  sec: number | string | null;
  exchange: number | string | null;
  cds: number | string | null;
  gov_cess: number | string | null;
  clearing_fees: number | string | null;
  foreign_brokerage: number | string | null;
  net_amount: number | string | null;
  approved_by: string | null;
  approved_at: string | null;
}

/** Every note on one transaction, any status. */
export async function listForTransaction(transactionId: string): Promise<NoteFiguresRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('buy_sell_notes')
      .select(
        'id, status, contract_no, trade_date, no_of_shares, price_avg, gross_amount, brokerage, sec, ' +
        'exchange, cds, gov_cess, clearing_fees, foreign_brokerage, net_amount, approved_by, approved_at',
      )
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
  );
  return rows as unknown as NoteFiguresRow[];
}

/** One note's new position, or null to withdraw the one it has. */
export interface SeqAssignment {
  id: string;
  intraday_seq: number | null;
}

/**
 * Write stated positions back.
 *
 * One statement per note. PostgREST has no bulk update of differing values, and
 * an upsert would need every NOT NULL column of `buy_sell_notes` restated — a
 * write path that could blank a column it never meant to touch. A day holds a
 * handful of notes, so the round trips are affordable and the blast radius of a
 * mistake is one integer.
 *
 * Sequential rather than `Promise.all`: on a refusal the caller needs to know
 * how far it got, and a half-applied day with a duplicate position is worse than
 * a half-applied day that stops at the first note it could not write.
 */
export async function setIntradaySeq(assignments: SeqAssignment[]): Promise<void> {
  for (const a of assignments) {
    const { error } = await supabase
      .from('buy_sell_notes')
      .update({ intraday_seq: a.intraday_seq })
      .eq('id', a.id);
    if (error) throw error;
  }
}

/** One note as stored, every column. */
export async function getById(id: string): Promise<Record<string, unknown> & { id: string; transaction_id: string | null } | null> {
  const { data, error } = await supabase.from('buy_sell_notes').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function update(id: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('buy_sell_notes').update(values).eq('id', id);
  if (error) throw error;
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('buy_sell_notes').delete().eq('id', id);
  if (error) throw error;
}
