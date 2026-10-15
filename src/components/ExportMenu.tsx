/** Export button with a format menu; reports the chosen format to the caller. */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import type { ExportFormat } from '../lib/exportTable';

interface ExportMenuProps {
  onExport: (format: ExportFormat) => void;
  /** `button`: labelled, for a toolbar. `icon`: bare download icon, for a dialog header. */
  variant?: 'button' | 'icon';
  disabled?: boolean;
}

const OPTIONS: { format: ExportFormat; label: string; icon: JSX.Element }[] = [
  { format: 'xlsx', label: 'Excel (.xlsx)', icon: <FileSpreadsheet className="w-4 h-4 text-green-600" /> },
  { format: 'csv', label: 'CSV (.csv)', icon: <FileText className="w-4 h-4 text-gray-500" /> },
];

export function ExportMenu({ onExport, variant = 'button', disabled }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const trigger = variant === 'icon'
    ? (
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        title="Export"
        aria-label="Export"
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 disabled:opacity-50"
      >
        <Download className="w-5 h-5" />
      </button>
    )
    : (
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        Export
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    );

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {trigger}
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-xl border border-gray-200 z-30 overflow-hidden">
          {OPTIONS.map(o => (
            <button
              key={o.format}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onExport(o.format); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {o.icon}
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
