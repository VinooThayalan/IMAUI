/** A format-neutral export table, written as CSV or XLSX. */

import { XLSX_MIME, xlsxFile, type XlsxCell, type XlsxStyle } from './xlsx';

export type ExportFormat = 'xlsx' | 'csv';

export type NumberKind = 'money' | 'price' | 'count' | 'percent';

/** `null` is nothing recorded: an empty cell, never a zero. */
export type ExportCell = string | { n: number; kind: NumberKind } | null;

export interface ExportTable {
  /** Written above the header row, when a file opens with a summary. */
  preamble?: ExportCell[][];
  headers: string[];
  rows: ExportCell[][];
}

export const money = (n: number): ExportCell => ({ n, kind: 'money' });
export const price = (n: number): ExportCell => ({ n, kind: 'price' });
export const count = (n: number): ExportCell => ({ n, kind: 'count' });
/** A rate already in percent: 12.34 means 12.34%. */
export const percent = (n: number): ExportCell => ({ n, kind: 'percent' });

const DECIMALS: Record<NumberKind, number> = { money: 2, price: 4, count: 0, percent: 2 };

// Fixed locale, not the browser's, so every user's file is identical.
const GROUPED = 'en-US';
function csvNumber(n: number, kind: NumberKind): string {
  if (kind === 'percent') return n.toFixed(DECIMALS.percent);
  const d = DECIMALS[kind];
  return kind === 'count'
    ? n.toLocaleString(GROUPED, { maximumFractionDigits: 0 })
    : n.toLocaleString(GROUPED, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function csvCell(cell: ExportCell): string {
  const s = cell == null ? '' : typeof cell === 'string' ? cell : csvNumber(cell.n, cell.kind);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

/** With a BOM, so Excel reads it as UTF-8. */
export function toCsv(table: ExportTable): string {
  const lines = [...(table.preamble ?? []), table.headers, ...table.rows];
  return '\uFEFF' + lines.map(r => r.map(csvCell).join(',')).join('\r\n');
}

const XLSX_STYLE: Record<NumberKind, XlsxStyle> = {
  money: 'money', price: 'price', count: 'count', percent: 'decimal',
};

function xlsxCell(cell: ExportCell): XlsxCell | null {
  if (cell == null) return null;
  if (typeof cell === 'string') return cell === '' ? null : { value: cell };
  // Parsed from the CSV text so both files hold the same rounded value;
  // toFixed rounds halves differently from toLocaleString.
  return {
    value: Number(csvNumber(cell.n, cell.kind).replace(/,/g, '')),
    style: XLSX_STYLE[cell.kind],
  };
}

function columnWidths(lines: ExportCell[][]): number[] {
  const widths: number[] = [];
  for (const line of lines) {
    line.forEach((cell, i) => {
      const len = cell == null ? 0 : typeof cell === 'string' ? cell.length : csvNumber(cell.n, cell.kind).length;
      widths[i] = Math.max(widths[i] ?? 0, len);
    });
  }
  return widths.map(w => Math.min(Math.max(w + 2, 8), 60));
}

/** Header row bold and frozen. */
export function toXlsx(table: ExportTable, sheetName: string): Uint8Array<ArrayBuffer> {
  const preamble = table.preamble ?? [];
  const lines: ExportCell[][] = [...preamble, table.headers, ...table.rows];
  return xlsxFile({
    name: sheetName,
    rows: [
      ...preamble.map(r => r.map(xlsxCell)),
      table.headers.map(h => ({ value: h, style: 'bold' as const })),
      ...table.rows.map(r => r.map(xlsxCell)),
    ],
    frozenRows: preamble.length + 1,
    widths: columnWidths(lines),
  });
}

/** Saves the export as `<baseName>.xlsx` or `<baseName>.csv`. */
export function downloadExport(
  table: ExportTable,
  baseName: string,
  format: ExportFormat,
  sheetName: string,
): void {
  const blob = format === 'xlsx'
    ? new Blob([toXlsx(table, sheetName)], { type: XLSX_MIME })
    : new Blob([toCsv(table)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
