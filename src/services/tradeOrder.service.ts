/**
 * Same-day trade order.
 *
 * A contract note records a trade date and no trade time, so when a holding has
 * more than one note on a date the ledger has to pick an order and the data does
 * not supply one. `buy_sell_notes.intraday_seq` is where someone states it; this
 * is the use case around it — find the days that need a decision, and write the
 * decision down.
 *
 * The replay itself lives in `shareLedger.service`, which is the only thing that
 * reads `intraday_seq`. Nothing here recomputes a balance.
 *
 * No React, no Supabase.
 */

import * as notesRepo from '../repositories/notes.repo';
import { logAudit } from '../lib/auditLog';
import { orderAffectsAverage, type ComputedRow } from './shareLedger.service';

/** One note on a contested day, as the editor needs to show it. */
export interface SameDayNote {
  id: string;
  note_type: string;
  no_of_shares: number;
  price_avg: number | null;
  gross_amount: number;
  /** The stated position, or null when this note's order is still unstated. */
  intraday_seq: number | null;
}

export interface SameDayGroup {
  trade_date: string;
  /** In the order the ledger currently replays them. */
  notes: SameDayNote[];
  /**
   * Whether reordering this day changes the average cost it closes on. False for
   * a day of only buys or only sells — both commute — so the screen can say so
   * rather than inviting a pointless decision.
   */
  affectsAverage: boolean;
  /** Whether every note on the day carries a stated position. */
  stated: boolean;
}

/**
 * The days of one holding that hold more than one trade.
 *
 * Reads the computed rows rather than the notes, because those are already in
 * the order the ledger replayed them — the order the user is looking at and the
 * one they will drag against. Dividends and scrip issues are left out: a
 * dividend moves neither the balance nor the cost, and a scrip issue is dated by
 * the registrar rather than the broker, so neither competes with a note for a
 * place in the day.
 */
export function sameDayGroups(rows: ComputedRow[]): SameDayGroup[] {
  const byDate = new Map<string, SameDayNote[]>();

  for (const r of rows) {
    if (r.row_type !== 'buy' && r.row_type !== 'sell') continue;
    if (!r.trade_date) continue;
    const list = byDate.get(r.trade_date) ?? [];
    list.push({
      id: r.id,
      note_type: r.note_type,
      no_of_shares: r.no_of_shares,
      price_avg: r.price_avg,
      gross_amount: r.gross_amount,
      intraday_seq: r.intraday_seq ?? null,
    });
    byDate.set(r.trade_date, list);
  }

  const groups: SameDayGroup[] = [];
  for (const [trade_date, notes] of byDate) {
    if (notes.length < 2) continue;
    groups.push({
      trade_date,
      notes,
      affectsAverage: orderAffectsAverage(notes.map(n => n.note_type)),
      stated: notes.every(n => n.intraday_seq != null),
    });
  }

  groups.sort((a, b) => (a.trade_date < b.trade_date ? -1 : a.trade_date > b.trade_date ? 1 : 0));
  return groups;
}

/** How many of a holding's days still have no order stated but need one. */
export function undecidedDays(groups: SameDayGroup[]): number {
  return groups.filter(g => g.affectsAverage && !g.stated).length;
}

/** Who is stating the order, and for which holding — for the audit trail. */
export interface OrderContext {
  performedBy: string;
  entityId: string;
  tradeDate: string;
}

/**
 * Write the assignments, then record them.
 *
 * Audited because this changes a reported average cost without changing a single
 * amount on a single note — the sort of edit that is impossible to explain six
 * months later from the numbers alone. `logAudit` swallows its own failures, so
 * a broken audit table cannot lose an order the user already saved.
 */
async function writeAndLog(
  assignments: notesRepo.SeqAssignment[],
  before: Map<string, number | null>,
  ctx: OrderContext,
  verb: string,
): Promise<void> {
  await notesRepo.setIntradaySeq(assignments);

  for (const a of assignments) {
    const was = before.get(a.id) ?? null;
    if (was === a.intraday_seq) continue;
    await logAudit({
      tableName: 'buy_sell_notes',
      recordId: a.id,
      action: 'UPDATE',
      performedBy: ctx.performedBy,
      entityId: ctx.entityId,
      oldValues: { intraday_seq: was },
      newValues: { intraday_seq: a.intraday_seq },
      description: `${verb} for ${ctx.tradeDate}: position ${was ?? 'unstated'} -> ${a.intraday_seq ?? 'unstated'}`,
    });
  }
}

/**
 * Record an order for one day.
 *
 * Positions are 1-based and assigned across the whole day, including notes the
 * caller left where they were. Writing a position for only the notes that moved
 * would leave the rest unstated, and unstated notes replay *after* stated ones —
 * so moving one note to the back would silently send every other note on the day
 * behind it. Stating the whole day is the only shape that means what it looks
 * like.
 */
export async function saveDayOrder(
  orderedNoteIds: string[],
  before: Map<string, number | null>,
  ctx: OrderContext,
): Promise<void> {
  if (orderedNoteIds.length === 0) return;
  const seen = new Set(orderedNoteIds);
  if (seen.size !== orderedNoteIds.length) {
    throw new Error('The same note appears twice in the order.');
  }
  await writeAndLog(
    orderedNoteIds.map((id, i) => ({ id, intraday_seq: i + 1 })),
    before,
    ctx,
    'Same-day trade order set',
  );
}

/**
 * Withdraw the order stated for one day.
 *
 * Back to null — unstated — rather than to some remembered previous order. The
 * day then replays the way an untouched day does, on the query's `id` order.
 * That is the honest end state: nobody is claiming to know the sequence.
 */
export async function clearDayOrder(
  noteIds: string[],
  before: Map<string, number | null>,
  ctx: OrderContext,
): Promise<void> {
  if (noteIds.length === 0) return;
  await writeAndLog(
    noteIds.map(id => ({ id, intraday_seq: null })),
    before,
    ctx,
    'Same-day trade order withdrawn',
  );
}
