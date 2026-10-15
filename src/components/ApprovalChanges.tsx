import type { ReactNode } from 'react';
import { PencilLine } from 'lucide-react';
import { formatFigure, type FigureKind } from '../lib/transactionPrint';
import { formatDisplayDateTime } from '../lib/dateInput';

export interface ApprovalChange {
  label: string;
  kind: 'entity' | 'share' | 'text' | 'date' | 'count' | 'price' | 'money';
  from: string | number | null;
  to: string | number | null;
}

type NameOf = (kind: 'entity' | 'share', id: string) => string;

interface ApprovalChangesProps {
  heading: ReactNode;
  changes: ApprovalChange[];
  /** Names for entity and share ids. */
  nameOf: NameOf;
}

const FIGURE: Partial<Record<ApprovalChange['kind'], FigureKind>> = {
  date: 'date', count: 'count', price: 'price', money: 'money',
};

function shown(c: ApprovalChange, v: string | number | null, nameOf: NameOf): string {
  if (v == null || v === '') return '—';
  const kind = FIGURE[c.kind];
  if (kind) return formatFigure(v, kind);
  if (c.kind === 'entity' || c.kind === 'share') return nameOf(c.kind, String(v));
  return String(v);
}

/** Figures changed at approval, old → new. */
export function ApprovalChanges({ heading, changes, nameOf }: ApprovalChangesProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-900">{heading}</p>
      <table className="mt-2 w-full text-xs">
        <tbody>
          {changes.map(c => (
            <tr key={c.label} className="border-t border-amber-100 first:border-t-0">
              <td className="py-1 pr-3 text-amber-800">{c.label}</td>
              <td className="py-1 pr-2 text-right tabular-nums text-gray-500 line-through">{shown(c, c.from, nameOf)}</td>
              <td className="py-1 px-1 text-amber-700">→</td>
              <td className="py-1 text-right font-semibold tabular-nums text-gray-900">{shown(c, c.to, nameOf)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Who amended the figures at approval, and how to read the fields marked below. */
export function AmendmentBanner({ by, at, count }: { by: string | null; at: string | null; count: number }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <PencilLine className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="font-semibold">Amended at approval</span> by{' '}
        <span className="font-semibold">{by ?? 'an approver whose name was not recorded'}</span>
        {at && <> on {formatDisplayDateTime(at)}</>}.{' '}
        {count === 1 ? '1 field was' : `${count} fields were`} changed; each shows the value submitted for approval.
      </p>
    </div>
  );
}

/** Under a field's current value: what it was submitted as, when the approver changed it. */
export function ChangedFrom({ change, nameOf }: { change: ApprovalChange | undefined; nameOf: NameOf }) {
  if (!change) return null;
  const unit = change.kind === 'money' || change.kind === 'price' ? 'LKR ' : '';
  return (
    <p className="mt-1 inline-flex flex-wrap items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
      <PencilLine className="h-3 w-3" />
      <span className="font-semibold">Changed</span>
      <span>· was</span>
      <span className="font-semibold tabular-nums text-gray-700">{unit}{shown(change, change.from, nameOf)}</span>
    </p>
  );
}
