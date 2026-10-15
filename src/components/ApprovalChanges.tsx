import type { ReactNode } from 'react';
import { formatFigure, type FigureKind } from '../lib/transactionPrint';

export interface ApprovalChange {
  label: string;
  kind: 'entity' | 'share' | 'text' | 'date' | 'count' | 'price' | 'money';
  from: string | number | null;
  to: string | number | null;
}

interface ApprovalChangesProps {
  heading: ReactNode;
  changes: ApprovalChange[];
  /** Names for entity and share ids. */
  nameOf: (kind: 'entity' | 'share', id: string) => string;
}

const FIGURE: Partial<Record<ApprovalChange['kind'], FigureKind>> = {
  date: 'date', count: 'count', price: 'price', money: 'money',
};

/** Figures changed at approval, old → new. */
export function ApprovalChanges({ heading, changes, nameOf }: ApprovalChangesProps) {
  const show = (c: ApprovalChange, v: string | number | null) => {
    if (v == null || v === '') return '—';
    const kind = FIGURE[c.kind];
    if (kind) return formatFigure(v, kind);
    if (c.kind === 'entity' || c.kind === 'share') return nameOf(c.kind, String(v));
    return String(v);
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-900">{heading}</p>
      <table className="mt-2 w-full text-xs">
        <tbody>
          {changes.map(c => (
            <tr key={c.label} className="border-t border-amber-100 first:border-t-0">
              <td className="py-1 pr-3 text-amber-800">{c.label}</td>
              <td className="py-1 pr-2 text-right tabular-nums text-gray-500 line-through">{show(c, c.from)}</td>
              <td className="py-1 px-1 text-amber-700">→</td>
              <td className="py-1 text-right font-semibold tabular-nums text-gray-900">{show(c, c.to)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
