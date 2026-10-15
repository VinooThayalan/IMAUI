import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  approvalChanges,
  approvalSnapshot,
  approvedFigures,
  approveTransaction,
  loadApprovalAmendment,
  mayApprove,
  type ApprovableTransaction,
  type ApprovalAmendment,
  type ApprovalEdits,
  type FigureChange,
  type TransactionFigures,
} from '../services/transactionApproval.service';

export interface ApprovalPreview {
  figures: TransactionFigures;
  changes: FigureChange[];
}

export function useTransactionApproval() {
  const { user } = useAuth();

  const approve = useCallback(
    (txn: ApprovableTransaction, edits: ApprovalEdits | null, notes: string | null) =>
      approveTransaction(txn, edits, user?.email || 'system', notes),
    [user],
  );

  /** What approving with these edits would write, and what it changes. */
  const preview = useCallback((txn: ApprovableTransaction, edits: ApprovalEdits): ApprovalPreview => {
    const figures = approvedFigures(txn, edits);
    return { figures, changes: approvalChanges(txn, figures) };
  }, []);

  /** False for the person who submitted it. */
  const canApprove = useCallback((txn: { submitted_by?: string | null }) => mayApprove(txn, user?.email), [user]);

  return { approve, preview, canApprove, snapshot: approvalSnapshot };
}

/** What the approver changed on this transaction, loaded when it changes. */
export function useApprovalAmendment(txn: ApprovableTransaction | null): ApprovalAmendment | null {
  const [amendment, setAmendment] = useState<ApprovalAmendment | null>(null);
  const id = txn?.id;
  const status = txn?.approval_status;

  useEffect(() => {
    let cancelled = false;
    setAmendment(null);
    if (!txn) return;
    loadApprovalAmendment(txn)
      .then(a => { if (!cancelled) setAmendment(a); })
      .catch(err => console.error('Could not load approval amendment:', err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, status]);

  return amendment;
}
