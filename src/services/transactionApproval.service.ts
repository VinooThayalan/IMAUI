/**
 * Approving a transaction (bug-54): the figures it is approved at, and the figures
 * it was submitted with, saved on the row by the same update.
 */

import * as auditLogsRepo from '../repositories/auditLogs.repo';
import * as transactionsRepo from '../repositories/transactions.repo';
import { fetchRecordForAudit, logAudit } from '../lib/auditLog';

type Value = string | number | null;

export const FIGURE_FIELDS = [
  'entity_id', 'share_id', 'transaction_type', 'transaction_date',
  'no_of_shares', 'price_per_share', 'total_amount_gross', 'fees', 'total_amount', 'net_price_per_share',
  'brokerage_fee', 'cse_fee', 'cds_fee', 'clearing_fee', 'sec_cess', 'share_transaction_levy',
] as const;
export type FigureField = (typeof FIGURE_FIELDS)[number];
export type TransactionFigures = Record<FigureField, Value>;

export type ChangeKind = 'entity' | 'share' | 'text' | 'date' | 'count' | 'price' | 'money';

const FIELD: Record<FigureField, { label: string; kind: ChangeKind }> = {
  entity_id: { label: 'Entity', kind: 'entity' },
  share_id: { label: 'Share', kind: 'share' },
  transaction_type: { label: 'Transaction type', kind: 'text' },
  transaction_date: { label: 'Transaction date', kind: 'date' },
  no_of_shares: { label: 'No. of shares', kind: 'count' },
  price_per_share: { label: 'Price per share', kind: 'price' },
  total_amount_gross: { label: 'Gross value', kind: 'money' },
  fees: { label: 'Total fees', kind: 'money' },
  total_amount: { label: 'Total value', kind: 'money' },
  net_price_per_share: { label: 'Net price per share', kind: 'price' },
  brokerage_fee: { label: 'Brokerage fee', kind: 'money' },
  cse_fee: { label: 'CSE fees', kind: 'money' },
  cds_fee: { label: 'CDS fees', kind: 'money' },
  clearing_fee: { label: 'Clearing fees', kind: 'money' },
  sec_cess: { label: 'SEC CESS', kind: 'money' },
  share_transaction_levy: { label: 'Share transaction levy', kind: 'money' },
};

const COMPONENTS = ['brokerage_fee', 'cse_fee', 'cds_fee', 'clearing_fee', 'sec_cess', 'share_transaction_levy'] as const;

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Net price per share: total value over shares. Null without shares. */
export function netPricePerShare(total: unknown, shares: unknown): number | null {
  const t = num(total);
  const n = num(shares);
  return n && t != null ? t / n : null;
}

/** The columns of a `transactions` row this reads. */
export type ApprovableTransaction = { id: string; approval_status?: string } & Partial<Record<FigureField, unknown>> & {
  brokerage_fee_rate?: unknown;
  submitted_by?: string | null;
  approved_by?: string | null;
  approval_date?: string | null;
  submitted_figures?: Record<string, unknown> | null;
};

export interface ApprovalEdits {
  entity_id: string;
  share_id: string;
  transaction_type: string;
  transaction_date: string;
  no_of_shares: number;
  price_per_share: number;
}

/** The figure columns as they stand. */
export function submittedFigures(row: Record<string, unknown>): TransactionFigures {
  const out = {} as TransactionFigures;
  for (const f of FIGURE_FIELDS) {
    const v = row[f];
    out[f] = v == null ? null : typeof v === 'number' ? v : String(v);
  }
  return out;
}

/**
 * The figures an approval writes: the submitted ones, or the approver's edits with
 * gross, fees, every fee component, total and net price recalculated. Each fee is
 * a rate of gross, so components scale with it and still add up to the total.
 */
export function approvedFigures(txn: ApprovableTransaction, edits: ApprovalEdits | null): TransactionFigures {
  const before = submittedFigures(txn);
  if (!edits) return before;

  const gross = edits.no_of_shares * edits.price_per_share;
  const oldGross = num(txn.total_amount_gross) ?? ((num(txn.no_of_shares) ?? 0) * (num(txn.price_per_share) ?? 0));
  const ratio = oldGross > 0 ? gross / oldGross : null;

  const after: TransactionFigures = {
    ...before,
    entity_id: edits.entity_id,
    share_id: edits.share_id,
    transaction_type: edits.transaction_type,
    transaction_date: edits.transaction_date,
    no_of_shares: edits.no_of_shares,
    price_per_share: edits.price_per_share,
    total_amount_gross: gross,
  };

  let fees: number;
  if (ratio != null) {
    for (const c of COMPONENTS) {
      const v = num(txn[c]);
      after[c] = v == null ? null : round2(v * ratio);
    }
    const parts = COMPONENTS.map(c => after[c]).filter((v): v is number => typeof v === 'number');
    fees = parts.length === COMPONENTS.length
      ? round2(parts.reduce((s, v) => s + v, 0))
      : round2((num(txn.fees) ?? 0) * ratio);
  } else {
    const rate = num(txn.brokerage_fee_rate);
    if (rate == null) throw new Error('Cannot recalculate fees: this transaction has no gross value or fee rate recorded.');
    fees = round2((gross * rate) / 100);
  }

  const total = edits.transaction_type === 'SELL' ? gross - fees : gross + fees;
  after.fees = fees;
  after.total_amount = round2(total);
  after.net_price_per_share = netPricePerShare(total, edits.no_of_shares);
  return after;
}

export interface FigureChange {
  field: FigureField;
  label: string;
  kind: ChangeKind;
  from: Value;
  to: Value;
}

const SCALE: Partial<Record<ChangeKind, number>> = { count: 1, price: 10000, money: 100 };

// net_price_per_share was stored to 2 places before 20261016060001; compare it as total / shares.
function withDerivedNetPrice(f: TransactionFigures): TransactionFigures {
  const derived = netPricePerShare(f.total_amount, f.no_of_shares);
  return derived != null ? { ...f, net_price_per_share: derived } : f;
}

/** Fields whose value differs, compared at the precision shown. */
export function approvalChanges(before: Record<string, unknown>, after: Record<string, unknown>): FigureChange[] {
  const b = withDerivedNetPrice(submittedFigures(before));
  const a = withDerivedNetPrice(submittedFigures(after));
  return FIGURE_FIELDS.flatMap(field => {
    const { label, kind } = FIELD[field];
    const from = b[field];
    const to = a[field];
    const scale = SCALE[kind];
    const differs = scale
      ? (num(from) == null) !== (num(to) == null) ||
        (num(from) != null && Math.round(num(from)! * scale) !== Math.round(num(to)! * scale))
      : String(from ?? '').slice(0, kind === 'date' ? 10 : undefined) !== String(to ?? '').slice(0, kind === 'date' ? 10 : undefined);
    return differs ? [{ field, label, kind, from, to }] : [];
  });
}

/**
 * The figures the transaction was submitted with: saved on the row at approval,
 * or for earlier approvals the audit snapshot taken then. Null when neither exists.
 */
export function submittedSnapshot(
  txn: ApprovableTransaction,
  audit: auditLogsRepo.AuditLogRow[],
): Record<string, unknown> | null {
  if (txn.submitted_figures) return txn.submitted_figures;
  const approval = [...audit].reverse().find(a =>
    a.new_values?.approval_status === 'MANUAL_APPROVED' && a.old_values?.approval_status !== 'MANUAL_APPROVED');
  return approval?.old_values?.no_of_shares != null ? approval.old_values : null;
}

export interface ApprovalAmendment {
  by: string | null;
  at: string | null;
  changes: FigureChange[];
}

/** What the approver changed. Null when not approved, nothing changed, or nothing was recorded. */
export function approvalAmendment(
  txn: ApprovableTransaction,
  audit: auditLogsRepo.AuditLogRow[],
): ApprovalAmendment | null {
  if (txn.approval_status !== 'MANUAL_APPROVED') return null;
  const before = submittedSnapshot(txn, audit);
  if (!before) return null;
  const changes = approvalChanges(before, txn);
  if (changes.length === 0) return null;
  const approval = [...audit].reverse().find(a => a.new_values?.approval_status === 'MANUAL_APPROVED');
  return {
    by: txn.approved_by ?? approval?.performed_by ?? null,
    at: txn.approval_date ?? approval?.performed_at ?? null,
    changes,
  };
}

export async function loadApprovalAmendment(txn: ApprovableTransaction): Promise<ApprovalAmendment | null> {
  if (txn.approval_status !== 'MANUAL_APPROVED') return null;
  const audit = txn.submitted_figures ? [] : await auditLogsRepo.listForRecord('transactions', txn.id);
  return approvalAmendment(txn, audit);
}

/** Columns every approval writes beside its status: the submitted figures. */
export function approvalSnapshot(txn: ApprovableTransaction): { submitted_figures: TransactionFigures } {
  return { submitted_figures: submittedFigures(txn) };
}

/** Four eyes: anyone with access may approve, except whoever submitted it. */
export function mayApprove(txn: { submitted_by?: string | null }, approver: string | null | undefined): boolean {
  return !!approver && (txn.submitted_by ?? '').toLowerCase() !== approver.toLowerCase();
}

export async function approveTransaction(
  txn: ApprovableTransaction,
  edits: ApprovalEdits | null,
  approver: string,
  notes: string | null,
): Promise<void> {
  if (!mayApprove(txn, approver)) throw new Error('A transaction cannot be approved by the person who submitted it.');
  const values: Record<string, unknown> = {
    ...(edits ? approvedFigures(txn, edits) : {}),
    ...approvalSnapshot(txn),
    approval_status: 'MANUAL_APPROVED',
    approved_by: approver,
    approval_date: new Date().toISOString(),
    approval_notes: notes,
  };
  const oldRecord = await fetchRecordForAudit('transactions', txn.id);
  await transactionsRepo.update(txn.id, values);
  void logAudit({
    tableName: 'transactions', recordId: txn.id, action: 'UPDATE', performedBy: approver,
    oldValues: oldRecord, newValues: { ...oldRecord, ...values },
    entityId: (txn.entity_id as string | undefined) ?? null, description: 'Approved transaction',
  });
}
