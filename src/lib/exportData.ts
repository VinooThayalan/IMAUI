export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | boolean | null;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive';
  return String(value);
}

export function exportToCSV<T>(
  filename: string,
  columns: ExportColumn<T>[],
  data: T[],
): void {
  const headerRow = columns.map((c) => escapeCSV(c.header)).join(',');
  const dataRows = data.map((row) =>
    columns
      .map((c) => escapeCSV(formatValue(c.accessor(row))))
      .join(','),
  );
  const csv = '\uFEFF' + [headerRow, ...dataRows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportToExcel<T>(
  filename: string,
  columns: ExportColumn<T>[],
  data: T[],
): void {
  const headerCells = columns
    .map((c) => `<th style="background:#1e293b;color:#fff;padding:8px 12px;font-family:Arial;font-size:11px;text-align:left;">${c.header}</th>`)
    .join('');

  const dataRows = data
    .map(
      (row) =>
        `<tr>${columns
          .map(
            (c) =>
              `<td style="padding:8px 12px;font-family:Arial;font-size:11px;border:1px solid #e2e8f0;">${escapeHTML(formatValue(c.accessor(row)))}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table style="border-collapse:collapse;">${headerCells}${dataRows}</table></body></html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportData<T>(
  filename: string,
  columns: ExportColumn<T>[],
  data: T[],
  format: 'csv' | 'excel',
): void {
  const date = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${date}`;
  if (format === 'csv') {
    exportToCSV(fullFilename, columns, data);
  } else {
    exportToExcel(fullFilename, columns, data);
  }
}
