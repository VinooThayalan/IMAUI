/**
 * The To and CC rows of the transactional email dialogs.
 *
 * One component because there were two hand-built copies — Transactions and
 * Transaction Approvals — that drifted apart in both behaviour and appearance.
 * Presentational only: it takes addresses and options as props and reports every
 * change through callbacks, so the rules about *who* is offered stay in
 * `lib/emailRecipients` and the data loading stays on the page.
 *
 * Three things the old markup got wrong, all of them reported:
 *
 *  - CC chips sat loose *above* a bare input, so they read as part of the To row
 *    and the empty input below them read as "no CC loaded" when three had. Chips
 *    now live inside the field's own border, which is what makes them look owned
 *    by it.
 *  - The entity's contact address was indistinguishable from a broker's. It
 *    carries a `contact` tag wherever it appears, because sending a client's
 *    trade details to the client and to their brokerage are different acts. The
 *    tag does the work, so nothing has to explain the colour in prose.
 *  - Nothing explained where an address came from, or why To was empty. Each
 *    field carries an ⓘ that says so.
 */

import { useEffect, useState } from 'react';
import { Info, Plus, X } from 'lucide-react';

export interface RecipientOption {
  id: string;
  /** Null when the record has no address — offered as unusable rather than hidden. */
  email: string | null;
  /** Broker name, or the entity name for the contact. */
  label: string;
  kind: 'broker' | 'contact';
}

interface Props {
  to: string;
  onToChange: (address: string) => void;
  cc: string[];
  onCcChange: (addresses: string[]) => void;
  /** Clickable recipients: the entity's brokers, and its contact address. */
  options: RecipientOption[];
  /** Turns the To ⓘ amber and leads its popover. Null when nothing is wrong. */
  toWarning?: string | null;
  /** What the ⓘ beside To explains. */
  toInfo: string;
  /** What the ⓘ beside CC explains. */
  ccInfo: string;
  /** e.g. "Metrocorp (Private) Limited" — names where the CC addresses came from. */
  ccSource?: string | null;
  disabled?: boolean;
}

/**
 * A small popover. Click the ⓘ again, click away, or press Escape to close.
 *
 * Everything explanatory lives in here rather than as standing text beside the
 * field — the rows were carrying three sentences nobody reads twice. `warning`
 * turns the icon amber, which is the whole signal that a field needs attention.
 */
function InfoButton(
  { text, label, warning }: { text: string; label: string; warning?: string | null },
) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={label}
        aria-expanded={open}
        className={`p-0.5 rounded transition-colors ${
          warning
            ? open ? 'text-amber-600 bg-amber-100' : 'text-amber-500 hover:text-amber-600'
            : open ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600'
        }`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          {/* Swallows the next click so the panel closes wherever you click. */}
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <span className="absolute right-0 top-6 z-50 block w-64 rounded-lg border border-gray-200 bg-white p-2.5 text-xs leading-relaxed text-gray-600 shadow-lg">
            {warning && <span className="mb-1 block font-semibold text-amber-600">{warning}</span>}
            {text}
          </span>
        </>
      )}
    </span>
  );
}

/**
 * The bordered box that chips and the input share, so the chips look contained.
 *
 * `actions` sits outside the wrapping flow on purpose. Inside it, `ml-auto` on
 * the icons made them wrap to a second line as soon as chips filled the row, and
 * the CC field stood a line taller than To for no reason a reader could see.
 * `min-h` keeps both boxes the same height when one holds chips and the other a
 * bare input.
 */
function ChipBox(
  { disabled, actions, children }:
  { disabled?: boolean; actions?: React.ReactNode; children: React.ReactNode },
) {
  return (
    <div
      className={`flex min-h-[2.125rem] items-start gap-1 rounded-lg border px-2 py-1 ${
        disabled ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-white'
      } focus-within:ring-2 focus-within:ring-blue-500`}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">{children}</div>
      {actions && <div className="flex flex-shrink-0 items-center gap-0.5 pt-0.5">{actions}</div>}
    </div>
  );
}

function Chip(
  { email, tag, onRemove, disabled }:
  { email: string; tag?: string | null; onRemove: () => void; disabled?: boolean },
) {
  const isContact = tag === 'contact';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
        isContact
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-blue-200 bg-blue-50 text-blue-800'
      }`}
    >
      {email}
      {tag && (
        <span className={`rounded px-1 text-[10px] font-semibold uppercase tracking-wide ${
          isContact ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {tag}
        </span>
      )}
      <button type="button" onClick={onRemove} disabled={disabled} className="hover:opacity-70 disabled:opacity-40">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

export function EmailRecipientsField({
  to, onToChange, cc, onCcChange, options, toWarning, toInfo, ccInfo, ccSource, disabled,
}: Props) {
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');

  const describe = (address: string) => options.find(o => o.email && o.email.toLowerCase() === address.toLowerCase());

  const addCc = (raw: string) => {
    const address = raw.trim();
    if (!address) return;
    if (cc.some(a => a.toLowerCase() === address.toLowerCase())) return;
    onCcChange([...cc, address]);
  };

  /*
    Where they came from belongs in the ⓘ, not under the field. Once addresses
    are loaded that IS the explanation, so it replaces the generic text rather
    than being pasted in front of it.
  */
  const ccText = cc.length && ccSource
    ? `${cc.length} filled in from ${ccSource}. Change them on the Entities page.`
    : ccInfo;

  const usable = options.filter(o => o.email);
  const unusable = options.filter(o => !o.email);

  return (
    <div className="space-y-2.5">
      {/* To — one recipient, so it holds a single chip once chosen. */}
      <div className="flex items-start gap-3">
        <label className="w-10 flex-shrink-0 pt-1.5 text-xs font-semibold text-gray-500">To</label>
        <div className="flex-1 space-y-1">
          <ChipBox
            disabled={disabled}
            actions={<InfoButton label="Where this address comes from" text={toInfo} warning={toWarning} />}
          >
            {to ? (
              <Chip
                email={to}
                tag={describe(to)?.kind === 'contact' ? 'contact' : describe(to)?.kind === 'broker' ? 'broker' : null}
                onRemove={() => onToChange('')}
                disabled={disabled}
              />
            ) : (
              <input
                type="email"
                value={toInput}
                onChange={e => setToInput(e.target.value)}
                onBlur={() => { if (toInput.trim()) { onToChange(toInput.trim()); setToInput(''); } }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && toInput.trim()) { e.preventDefault(); onToChange(toInput.trim()); setToInput(''); }
                }}
                placeholder="recipient@example.com"
                disabled={disabled}
                className="min-w-[12rem] flex-1 bg-transparent px-1 py-0.5 text-sm focus:outline-none"
              />
            )}
          </ChipBox>

          {(usable.length > 0 || unusable.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {usable.map(o => {
                const chosen = o.email!.toLowerCase() === to.toLowerCase();
                const inCc = cc.some(a => a.toLowerCase() === o.email!.toLowerCase());
                return (
                  <span key={o.id} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => onToChange(o.email!)}
                      disabled={disabled || chosen}
                      title={o.email!}
                      className={`inline-flex items-center gap-1 rounded-l-full border py-0.5 pl-2 pr-1.5 text-xs transition-colors ${
                        o.kind === 'contact'
                          ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:bg-emerald-100'
                          : 'border-blue-200 text-blue-700 hover:bg-blue-50 disabled:bg-blue-100'
                      } disabled:cursor-default`}
                    >
                      {chosen && <span aria-hidden>✓</span>}
                      {o.label}
                      {o.kind === 'contact' && (
                        <span className="rounded bg-emerald-100 px-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          contact
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => addCc(o.email!)}
                      disabled={disabled || chosen || inCc}
                      title={`Add ${o.email} to CC`}
                      className="rounded-r-full border border-l-0 border-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-blue-600 disabled:text-gray-300 disabled:cursor-default"
                    >
                      +CC
                    </button>
                  </span>
                );
              })}
              {unusable.map(o => (
                <span key={o.id} title="No email address on file" className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                  {o.label} (no email)
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CC — chips inside the box, with the add button at its end. */}
      <div className="flex items-start gap-3">
        <label className="w-10 flex-shrink-0 pt-1.5 text-xs font-semibold text-gray-500">CC</label>
        <div className="flex-1 space-y-1">
          <ChipBox
            disabled={disabled}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => { addCc(ccInput); setCcInput(''); }}
                  disabled={disabled || !ccInput.trim()}
                  aria-label="Add CC address"
                  className="rounded p-0.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:text-gray-300 disabled:hover:bg-transparent"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <InfoButton label="Where these addresses come from" text={ccText} />
              </>
            }
          >
            {cc.map((address, i) => (
              <Chip
                key={`${address}-${i}`}
                email={address}
                tag={describe(address)?.kind === 'contact' ? 'contact' : null}
                onRemove={() => onCcChange(cc.filter((_, idx) => idx !== i))}
                disabled={disabled}
              />
            ))}
            <input
              type="email"
              value={ccInput}
              onChange={e => setCcInput(e.target.value)}
              onBlur={() => { if (ccInput.trim()) { addCc(ccInput); setCcInput(''); } }}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ',') && ccInput.trim()) {
                  e.preventDefault(); addCc(ccInput); setCcInput('');
                } else if (e.key === 'Backspace' && !ccInput && cc.length) {
                  onCcChange(cc.slice(0, -1));
                }
              }}
              placeholder={cc.length ? 'Add another…' : 'Add CC, press Enter'}
              disabled={disabled}
              className="min-w-[10rem] flex-1 bg-transparent px-1 py-0.5 text-sm focus:outline-none"
            />
          </ChipBox>
        </div>
      </div>
    </div>
  );
}
