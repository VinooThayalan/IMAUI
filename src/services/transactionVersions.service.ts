/**
 * One trade's figures as drafted, as approved and as the broker confirmed them
 * (bug-53). Drafted figures exist only as the audit snapshot taken at approval;
 * where none was kept they are not recorded, never assumed.
 */

import * as auditLogsRepo from '../repositories/auditLogs.repo';
import {
  approvalAmendment,
  netPricePerShare,
  submittedSnapshot,
  type ApprovalAmendment,
  type FigureChange,
} from './transactionApproval.service';
import * as notesRepo from '../repositories/notes.repo';
import { formatDisplayDate } from '../lib/dateInput';
import {
  formatFigure,
  type FigureKind,
  type PrintFigureRow,
  type TransactionPrintData,
} from '../lib/transactionPrint';

export interface TradeFigures {
  date: string | null;
  shares: number | null;
  grossPrice: number | null;
  gross: number | null;
  fees: number | null;
  net: number | null;
  netPrice: number | null;
}

/** The columns of a `transactions` row this reads. */
export interface VersionedTransaction {
  id: string;
  approval_status: string;
  transaction_type: string;
  transaction_date: string | null;
  no_of_shares: number | string | null;
  price_per_share: number | string | null;
  total_amount_gross?: number | string | null;
  fees?: number | string | null;
  total_amount: number | string | null;
  net_price_per_share?: number | string | null;
  approved_by?: string | null;
  approval_date?: string | null;
  entity_id?: string;
  share_id?: string;
  submitted_figures?: Record<string, unknown> | null;
}

export interface TransactionVersions {
  /** Null: not recorded. */
  drafted: TradeFigures | null;
  /** Null: not approved. */
  approved: TradeFigures | null;
  /** Null: no contract note (rejected notes excluded). */
  broker: TradeFigures | null;
  approvedBy: string | null;
  approvedAt: string | null;
  status: string;
  amendment: ApprovalAmendment | null;
  notes: { contractNo: string | null; status: string; approvedBy: string | null; approvedAt: string | null }[];
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const day = (v: unknown): string | null => (typeof v === 'string' && v ? v.slice(0, 10) : null);

/** A transaction row, or an audit snapshot of one. Null when it holds no figures. */
function transactionFigures(r: Record<string, unknown>): TradeFigures | null {
  const shares = num(r.no_of_shares);
  const grossPrice = num(r.price_per_share);
  if (shares == null && grossPrice == null) return null;
  const gross = num(r.total_amount_gross) ?? (shares != null && grossPrice != null ? shares * grossPrice : null);
  const net = num(r.total_amount);
  return {
    date: day(r.transaction_date),
    shares,
    grossPrice,
    gross,
    fees: num(r.fees),
    net,
    netPrice: netPricePerShare(net, shares) ?? num(r.net_price_per_share),
  };
}

const FEE_FIELDS = ['brokerage', 'sec', 'exchange', 'cds', 'gov_cess', 'clearing_fees', 'foreign_brokerage'] as const;

/** Sum of the values present; null when none is. */
const sumPresent = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v != null);
  return present.length ? present.reduce((s, v) => s + v, 0) : null;
};

function noteFigures(notes: notesRepo.NoteFiguresRow[]): TradeFigures | null {
  if (notes.length === 0) return null;
  const shares = sumPresent(notes.map(n => num(n.no_of_shares)));
  const gross = sumPresent(notes.map(n => num(n.gross_amount)));
  const net = sumPresent(notes.map(n => num(n.net_amount)));
  const fees = sumPresent(notes.map(n => sumPresent(FEE_FIELDS.map(f => num(n[f])))));
  const dates = [...new Set(notes.map(n => day(n.trade_date)).filter((d): d is string => d != null))];
  return {
    date: dates.length ? dates.join(', ') : null,
    shares,
    grossPrice: shares && gross != null ? gross / shares : null,
    gross,
    fees,
    net,
    netPrice: netPricePerShare(net, shares),
  };
}

export function transactionVersions(
  txn: VersionedTransaction,
  audit: auditLogsRepo.AuditLogRow[],
  notes: notesRepo.NoteFiguresRow[],
): TransactionVersions {
  const current = transactionFigures(txn as unknown as Record<string, unknown>);
  const confirmed = notes.filter(n => n.status !== 'REJECTED');
  const shared = {
    broker: noteFigures(confirmed),
    status: txn.approval_status,
    notes: confirmed.map(n => ({
      contractNo: n.contract_no, status: n.status, approvedBy: n.approved_by, approvedAt: n.approved_at,
    })),
  };

  if (txn.approval_status !== 'MANUAL_APPROVED') {
    return { drafted: current, approved: null, approvedBy: null, approvedAt: null, amendment: null, ...shared };
  }

  const approval = [...audit].reverse().find(a =>
    a.new_values?.approval_status === 'MANUAL_APPROVED' && a.old_values?.approval_status !== 'MANUAL_APPROVED');
  const submitted = submittedSnapshot(txn, audit);
  return {
    drafted: submitted ? transactionFigures(submitted) : null,
    approved: current,
    approvedBy: txn.approved_by ?? approval?.performed_by ?? null,
    approvedAt: txn.approval_date ?? approval?.performed_at ?? null,
    amendment: approvalAmendment(txn, audit),
    ...shared,
  };
}

const ROWS: { label: string; kind: FigureKind; key: keyof TradeFigures }[] = [
  { label: 'Trade date', kind: 'date', key: 'date' },
  { label: 'Number of shares', kind: 'count', key: 'shares' },
  { label: 'Price per share (gross)', kind: 'price', key: 'grossPrice' },
  { label: 'Gross value', kind: 'money', key: 'gross' },
  { label: 'Fees', kind: 'money', key: 'fees' },
  { label: 'Net value (purchase / sale value)', kind: 'money', key: 'net' },
  { label: 'Price per share (net)', kind: 'price', key: 'netPrice' },
];

const SCALE: Record<FigureKind, number> = { date: 1, count: 1, price: 10000, money: 100 };

/** Compared at the precision printed; unknown on either side is not a difference. */
function differs(a: number | string | null, b: number | string | null, kind: FigureKind): boolean {
  if (a == null || b == null) return false;
  if (kind === 'date') return a !== b;
  return Math.round(Number(a) * SCALE[kind]) !== Math.round(Number(b) * SCALE[kind]);
}

export function printRows(v: TransactionVersions): PrintFigureRow[] {
  const reference = v.approved ?? v.drafted;
  return ROWS.map(({ label, kind, key }) => {
    const drafted = v.drafted?.[key] ?? null;
    const approved = v.approved?.[key] ?? null;
    const broker = v.broker?.[key] ?? null;
    const ref = reference?.[key] ?? null;
    const difference = kind !== 'date' && broker != null && ref != null
      ? Math.round((Number(broker) - Number(ref)) * SCALE[kind]) / SCALE[kind]
      : null;
    return {
      label, kind, drafted, approved, broker, difference,
      approvedChanged: differs(drafted, approved, kind),
      brokerChanged: differs(ref, broker, kind),
    };
  });
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  ON_HOLD: 'On hold',
  MANUAL_APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  PROCESSED: 'Processed',
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;
const onDay = (iso: string | null) => (iso ? ` on ${formatDisplayDate(iso)}` : '');

const FIGURE_KIND: Partial<Record<FigureChange['kind'], FigureKind>> = {
  date: 'date', count: 'count', price: 'price', money: 'money',
};

/** "No. of shares 99,000 → 100,000"; entity and share by name are the screen's to resolve. */
export function describeChange(c: FigureChange): string {
  const kind = FIGURE_KIND[c.kind];
  if (kind) return `${c.label} ${formatFigure(c.from, kind)} → ${formatFigure(c.to, kind)}`;
  if (c.kind === 'text') return `${c.label} ${c.from ?? '—'} → ${c.to ?? '—'}`;
  return `${c.label} changed`;
}

export interface TransactionPrintHeader {
  entityName: string;
  shareInfo: string;
  cdsAccount: string;
  brokerName: string;
  preparedBy: string | null;
  generatedOn: string;
}

export function transactionPrintData(
  txn: VersionedTransaction,
  header: TransactionPrintHeader,
  v: TransactionVersions,
): TransactionPrintData {
  const rows = printRows(v);
  return {
    transactionId: txn.id,
    investment: txn.transaction_type === 'BUY' ? 'Purchase' : 'Sale',
    transactionType: txn.transaction_type,
    ...header,
    rows,
    draftedNote: v.drafted ? null : 'Not recorded. The figures submitted for approval were not kept for this transaction.',
    approvedNote: v.approved
      ? (v.approvedBy ? `Approved by ${v.approvedBy}${onDay(v.approvedAt)}.` : `Approved${onDay(v.approvedAt)}; approver not recorded.`)
      : `Not approved. Status: ${statusLabel(v.status)}.`,
    brokerNote: v.notes.length
      ? v.notes.map(n => `Contract note ${n.contractNo || '(no number)'}: ${statusLabel(n.status)}` +
          (n.approvedBy ? `, approved by ${n.approvedBy}${onDay(n.approvedAt)}` : '')).join('; ') + '.'
      : 'No contract note uploaded yet.',
    amendments: v.amendment
      ? [`Amended at approval${v.amendment.by ? ` by ${v.amendment.by}` : ''}${onDay(v.amendment.at)}: ` +
          v.amendment.changes.map(describeChange).join('; ') + '.']
      : [],
  };
}

export async function loadTransactionVersions(txn: VersionedTransaction): Promise<TransactionVersions> {
  const [audit, notes] = await Promise.all([
    auditLogsRepo.listForRecord('transactions', txn.id),
    notesRepo.listForTransaction(txn.id),
  ]);
  return transactionVersions(txn, audit, notes);
}
