/**
 * The "Transaction Approval Details" print: the trade as drafted, as approved and
 * as the broker confirmed it, with changed figures marked (bug-53).
 */

import { formatDisplayDate } from './dateInput';

export type FigureKind = 'date' | 'count' | 'price' | 'money';

/** One figure across the three versions. `null` is not recorded: a dash, never a zero. */
export interface PrintFigureRow {
  label: string;
  kind: FigureKind;
  drafted: number | string | null;
  approved: number | string | null;
  broker: number | string | null;
  /** Broker minus approved (or drafted, before approval); null when either is missing or not numeric. */
  difference: number | null;
  approvedChanged: boolean;
  brokerChanged: boolean;
}

export interface TransactionPrintData {
  transactionId: string;
  entityName: string;
  investment: 'Purchase' | 'Sale';
  shareInfo: string;
  transactionType: string;
  cdsAccount: string;
  brokerName: string;
  preparedBy: string | null;
  generatedOn: string;
  rows: PrintFigureRow[];
  /** e.g. "Not recorded: approved before approval history was kept". */
  draftedNote: string | null;
  approvedNote: string | null;
  brokerNote: string | null;
  /** e.g. "Amended at approval by … on …: Number of shares 99,000 → 100,000". */
  amendments: string[];
}

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function formatFigure(v: number | string | null, kind: FigureKind): string {
  if (v == null || v === '') return '—';
  if (kind === 'date') return formatDisplayDate(String(v)) || String(v);
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (kind === 'count') return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const d = kind === 'price' ? 4 : 2;
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function signed(v: number | null, kind: FigureKind): string {
  if (v == null) return '—';
  const text = formatFigure(Math.abs(v), kind);
  return v > 0 ? `+${text}` : v < 0 ? `-${text}` : text;
}

export function transactionPrintHtml(d: TransactionPrintData): string {
  const cell = (v: number | string | null, kind: FigureKind, changed: boolean) =>
    `<td class="num${changed ? ' changed' : ''}">${esc(formatFigure(v, kind))}</td>`;

  const rows = d.rows.map(r => `
              <tr>
                <td>${esc(r.label)}</td>
                ${cell(r.drafted, r.kind, false)}
                ${cell(r.approved, r.kind, r.approvedChanged)}
                ${cell(r.broker, r.kind, r.brokerChanged)}
                <td class="num${r.difference ? ' changed' : ''}">${r.kind === 'date' ? '' : esc(signed(r.difference, r.kind))}</td>
              </tr>`).join('');

  const notes = [
    d.draftedNote && `<li><strong>Drafted:</strong> ${esc(d.draftedNote)}</li>`,
    d.approvedNote && `<li><strong>Approved:</strong> ${esc(d.approvedNote)}</li>`,
    d.brokerNote && `<li><strong>Broker confirmed:</strong> ${esc(d.brokerNote)}</li>`,
    ...d.amendments.map(a => `<li>${esc(a)}</li>`),
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Transaction Approval - ${esc(d.transactionId)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; margin: 0 auto; max-width: 1200px; }
      h2 { margin: 0 0 20px 0; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 13px; }
      th { background-color: #f5f5f5; font-weight: bold; }
      td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
      td.changed { background-color: #fff3cd; font-weight: bold; }
      .info td { border: none; padding: 4px 8px; }
      .info td:first-child { font-weight: bold; width: 200px; }
      .legend { font-size: 12px; margin: -10px 0 20px 0; }
      .legend span { background-color: #fff3cd; border: 1px solid #000; padding: 0 6px; }
      ul { font-size: 12px; margin: 0 0 20px 0; padding-left: 18px; }
      .sign td { border: none; padding: 6px 8px; }
      .sign td:first-child { width: 200px; }
      @media print { body { padding: 20px; } td.changed, .legend span { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
  </head>
  <body>
    <h2>Transaction Approval Details</h2>

    <table class="info">
      <tr><td>Entity:</td><td>${esc(d.entityName)}</td></tr>
      <tr><td>Investment</td><td>${d.investment}</td></tr>
      <tr><td>Name of the Investment</td><td>${esc(d.shareInfo)}</td></tr>
      <tr><td>Buy/Sell</td><td>${esc(d.transactionType)}</td></tr>
      <tr><td>CDS Acc. No</td><td>${esc(d.cdsAccount)}</td></tr>
      <tr><td>Broker Name</td><td>${esc(d.brokerName)}</td></tr>
    </table>

    <table>
      <thead>
        <tr>
          <th>Figure</th>
          <th class="num">Drafted (submitted)</th>
          <th class="num">Approved</th>
          <th class="num">Broker confirmed (contract note)</th>
          <th class="num">Difference (broker − approved)</th>
        </tr>
      </thead>
      <tbody>${rows}
      </tbody>
    </table>
    <p class="legend"><span>&nbsp;</span> differs from the previous version</p>
    ${notes ? `<ul>${notes}</ul>` : ''}

    <table class="sign">
      <tr><td>Prepared by</td><td>${d.preparedBy ? esc(d.preparedBy) : '..........................'}</td></tr>
      <tr><td>Authorized by</td><td>..........................</td></tr>
      <tr><td>Authorized date</td><td>..........................</td></tr>
      <tr><td>Generate Date</td><td>${esc(d.generatedOn)}</td></tr>
    </table>

    <script>setTimeout(function () { window.print(); }, 500);</script>
  </body>
</html>`;
}
