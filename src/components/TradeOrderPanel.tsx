/**
 * Stating the order of trades that share a date.
 *
 * Presentational only. It is handed the days, the draft order and the flags, and
 * reports intent back through callbacks — what a day is, whether the order
 * changes anything and what a position means all live in `tradeOrder.service`.
 *
 * The prop types are declared here rather than imported from the service,
 * because a component does not import from a service. They are the shape this
 * panel needs to draw; the page maps the service's answer onto them.
 */

import { ArrowDown, ArrowUp, Info, RotateCcw, Save, TrendingDown, TrendingUp, X } from 'lucide-react';
import { Spinner } from './Loading';

export interface TradeOrderNote {
  id: string;
  note_type: string;
  no_of_shares: number;
  price_avg: number | null;
  gross_amount: number;
  intraday_seq: number | null;
}

export interface TradeOrderDay {
  trade_date: string;
  notes: TradeOrderNote[];
  affectsAverage: boolean;
  stated: boolean;
}

interface Props {
  shareTicker: string;
  entityName: string;
  days: TradeOrderDay[];
  /** Note ids per trade date, in the order currently drafted. */
  draft: Record<string, string[]>;
  /** The trade date currently being written, or null. */
  saving: string | null;
  isDirty: (tradeDate: string) => boolean;
  onMove: (tradeDate: string, from: number, to: number) => void;
  onSave: (tradeDate: string) => void;
  onClear: (tradeDate: string) => void;
  onClose: () => void;
}

const fmt     = (v: number, d = 2) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtN    = (v: number)        => v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = (d: string)        => new Date(d + 'T00:00:00').toLocaleDateString('en-GB');

const isBuy = (t: string) => t === 'Buy' || t === 'BUY';

export function TradeOrderPanel({
  shareTicker, entityName, days, draft, saving, isDirty, onMove, onSave, onClear, onClose,
}: Props) {
  const contested = days.filter(d => d.affectsAverage);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">

        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Same-day trade order</h2>
            <p className="text-sm text-gray-500 mt-0.5">{shareTicker} · {entityName}</p>
          </div>
          <button onClick={onClose} title="Close" aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 bg-blue-50/60 border-b border-blue-100 flex gap-2.5 items-start flex-shrink-0">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-900 leading-relaxed">
            A contract note carries a trade date but no trade time, so the ledger cannot tell which of
            two trades on one day came first. Put them in the order they happened and the average cost
            follows.{' '}
            {contested.length > 0 ? (
              <>
                Only <span className="font-semibold">{contested.length}</span> of these {days.length}{' '}
                day{days.length === 1 ? '' : 's'} change the average — a day of only buys, or only
                sells, closes on the same figure whichever way round it runs.
              </>
            ) : (
              <>
                None of these days changes the average: each holds only buys, or only sells, and those
                close on the same figure whichever way round they run.
              </>
            )}
          </p>
        </div>

        <div className="overflow-auto flex-1 px-6 py-4 space-y-4">
          {days.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              No day of this holding has more than one trade, so there is no order to state.
            </p>
          )}

          {days.map(day => {
            const order = draft[day.trade_date] ?? day.notes.map(n => n.id);
            const byId  = new Map(day.notes.map(n => [n.id, n]));
            const dirty = isDirty(day.trade_date);
            const busy  = saving === day.trade_date;

            return (
              <div
                key={day.trade_date}
                className={`rounded-xl border ${day.affectsAverage ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-100 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{fmtDate(day.trade_date)}</span>
                    <span className="text-xs text-gray-400">{day.notes.length} trades</span>
                    {day.affectsAverage ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-400 text-white">
                        Order changes Av Cost
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                        Order does not change Av Cost
                      </span>
                    )}
                    {day.stated
                      ? <span className="text-xs text-emerald-700 font-medium">Order stated</span>
                      : <span className="text-xs text-gray-400">No order stated</span>}
                  </div>

                  <div className="flex items-center gap-2">
                    {day.stated && (
                      <button
                        onClick={() => onClear(day.trade_date)}
                        disabled={busy}
                        title="Withdraw the stated order for this day"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Clear
                      </button>
                    )}
                    <button
                      onClick={() => onSave(day.trade_date)}
                      disabled={busy || (!dirty && day.stated)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors"
                    >
                      {busy
                        ? <Spinner size="xs" />
                        : <Save className="w-3.5 h-3.5" />}
                      Save order
                    </button>
                  </div>
                </div>

                <ol className="divide-y divide-gray-100">
                  {order.map((id, idx) => {
                    const note = byId.get(id);
                    if (!note) return null;
                    const buy = isBuy(note.note_type);
                    return (
                      <li key={id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-6 text-center text-xs font-bold text-gray-400 flex-shrink-0">{idx + 1}</span>

                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${buy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {buy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {buy ? 'Buy' : 'Sell'}
                        </span>

                        <span className="font-mono text-sm text-gray-900 flex-shrink-0">{fmtN(note.no_of_shares)}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">@</span>
                        <span className="font-mono text-sm text-gray-700 flex-shrink-0">
                          {note.price_avg != null ? fmt(note.price_avg) : '—'}
                        </span>

                        <span className="font-mono text-xs text-gray-500 ml-auto flex-shrink-0">
                          Rs. {fmt(note.gross_amount)}
                        </span>

                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            onClick={() => onMove(day.trade_date, idx, idx - 1)}
                            disabled={idx === 0 || busy}
                            title="Move earlier"
                            aria-label="Move earlier"
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onMove(day.trade_date, idx, idx + 1)}
                            disabled={idx === order.length - 1 || busy}
                            title="Move later"
                            aria-label="Move later"
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {dirty && (
                  <p className="px-4 py-2 text-xs text-amber-700 bg-amber-100/60 border-t border-amber-200">
                    Not saved yet. The report keeps its current figures until you save.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
