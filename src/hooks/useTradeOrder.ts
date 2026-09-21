/**
 * Editing the same-day order of one holding's trades.
 *
 * Owns the draft the user is dragging around, the saving flag and the error, and
 * nothing else: what a contested day is and what a position means both live in
 * `tradeOrder.service`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  sameDayGroups,
  saveDayOrder,
  clearDayOrder,
  type SameDayGroup,
} from '../services/tradeOrder.service';
import type { ComputedRow } from '../services/shareLedger.service';
import { useAuth } from '../contexts/AuthContext';
import { useWriteError } from './useWriteError';

export interface UseTradeOrder {
  groups: SameDayGroup[];
  /** Note ids per trade date, in the order currently drafted. */
  draft: Record<string, string[]>;
  saving: string | null;
  move: (tradeDate: string, from: number, to: number) => void;
  /** Whether this day's draft differs from what is recorded. */
  isDirty: (tradeDate: string) => boolean;
  save: (tradeDate: string) => Promise<boolean>;
  clear: (tradeDate: string) => Promise<boolean>;
}

/**
 * @param rows     the holding's computed rows, in replay order
 * @param entityId the holding's entity, for the audit trail
 * @param onSaved  run after a successful write — the analytics cache is keyed on
 *                 a fingerprint that a note update moves, so the caller refetches
 *                 rather than patching its copy
 */
export function useTradeOrder(
  rows: ComputedRow[],
  entityId: string,
  onSaved: () => void,
): UseTradeOrder {
  const groups = useMemo(() => sameDayGroups(rows), [rows]);
  const { user } = useAuth();

  // Seeded from the replay order, which is what the table above it shows.
  const recorded = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const g of groups) out[g.trade_date] = g.notes.map(n => n.id);
    return out;
  }, [groups]);

  // What is on record now, so the audit entry can say what it changed from.
  const recordedSeq = useMemo(() => {
    const out = new Map<string, number | null>();
    for (const g of groups) for (const n of g.notes) out.set(n.id, n.intraday_seq);
    return out;
  }, [groups]);

  const [moved, setMoved] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  /*
    Days written but not yet read back.

    Saving refetches, because the figures are served from a cache keyed on a
    fingerprint this write moves — so between the write landing and the new rows
    arriving, `recorded` still describes the old order. Without this the day
    would go on claiming to be unsaved for as long as the recompute takes, which
    is the one moment the user is watching it.
  */
  const [pending, setPending] = useState<Record<string, true>>({});
  const reportWriteError = useWriteError();

  // New rows: whatever was in flight has arrived.
  useEffect(() => {
    setPending(prev => (Object.keys(prev).length > 0 ? {} : prev));
  }, [recorded]);

  // Days the user has not touched read straight from `recorded`, so a refetch
  // that changes the replay order is reflected instead of being masked by stale
  // draft state.
  const draft = useMemo(() => ({ ...recorded, ...moved }), [recorded, moved]);

  const move = useCallback((tradeDate: string, from: number, to: number) => {
    setMoved(prev => {
      const current = prev[tradeDate] ?? recorded[tradeDate] ?? [];
      if (to < 0 || to >= current.length || from === to) return prev;
      const next = [...current];
      const [held] = next.splice(from, 1);
      next.splice(to, 0, held);
      return { ...prev, [tradeDate]: next };
    });
  }, [recorded]);

  const isDirty = useCallback((tradeDate: string) => {
    if (pending[tradeDate]) return false;
    const drafted = moved[tradeDate];
    if (!drafted) return false;
    const base = recorded[tradeDate] ?? [];
    return drafted.length !== base.length || drafted.some((id, i) => id !== base[i]);
  }, [moved, pending, recorded]);

  const dropDraft = useCallback((tradeDate: string) => {
    setMoved(prev => {
      if (!(tradeDate in prev)) return prev;
      const next = { ...prev };
      delete next[tradeDate];
      return next;
    });
  }, []);

  const run = useCallback(async (
    tradeDate: string,
    work: () => Promise<void>,
    action: string,
    /*
      Whether the draft still describes the truth once the write succeeds.

      It does for a save — the draft *is* what was written, so holding it keeps
      the list still while the refetch runs. It does not for a clear, which puts
      the day back to no stated order at all; there the draft has to go so the
      list can fall back to whatever order the ledger reaches for instead.
    */
    keepDraft: boolean,
  ): Promise<boolean> => {
    setSaving(tradeDate);
    try {
      await work();
      if (keepDraft) setPending(prev => ({ ...prev, [tradeDate]: true }));
      else dropDraft(tradeDate);
      onSaved();
      return true;
    } catch (err) {
      await reportWriteError(err, action);
      return false;
    } finally {
      setSaving(null);
    }
  }, [dropDraft, onSaved, reportWriteError]);

  const ctxFor = useCallback((tradeDate: string) => ({
    performedBy: user?.email || 'system',
    entityId,
    tradeDate,
  }), [user, entityId]);

  const save = useCallback((tradeDate: string) =>
    run(
      tradeDate,
      () => saveDayOrder(draft[tradeDate] ?? [], recordedSeq, ctxFor(tradeDate)),
      'set the order of these trades',
      true,
    ),
    [draft, recordedSeq, ctxFor, run]);

  const clear = useCallback((tradeDate: string) =>
    run(
      tradeDate,
      () => clearDayOrder(recorded[tradeDate] ?? [], recordedSeq, ctxFor(tradeDate)),
      'clear the order of these trades',
      false,
    ),
    [recorded, recordedSeq, ctxFor, run]);

  return { groups, draft, saving, move, isDirty, save, clear };
}
