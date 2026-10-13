/**
 * The first line of every email dialog: what was traded, and for whom.
 *
 * Type badge, then "TICKER — Share name", then the entity, labelled, on the
 * same line. Send Transaction Details had it here and Email Broker put the
 * entity in a box halfway down, below the CC field, so the same fact sat in a
 * different place depending on which dialog was open. One component now; the
 * emails `send-transaction-email` renders carry the same row.
 */

interface EmailHeadlineProps {
  /** BUY / SELL, in either case -- transactions say "BUY", notes say "Buy". */
  type: string;
  ticker: string;
  share: string;
  entity: string;
}

export function EmailHeadline({ type, ticker, share, entity }: EmailHeadlineProps) {
  const label = type.toUpperCase();
  const typeColor = label === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${typeColor}`}>{label}</span>
      <span className="font-semibold text-gray-900 text-sm">{ticker} — {share}</span>
      <span className="ml-auto flex items-baseline gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Entity</span>
        <span className="text-sm font-bold text-gray-900">{entity}</span>
      </span>
    </div>
  );
}
