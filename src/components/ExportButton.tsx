import { Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { exportData, type ExportColumn } from '../lib/exportData';

interface ExportButtonProps<T> {
  filename: string;
  columns: ExportColumn<T>[];
  data: T[];
}

export function ExportButton<T>({ filename, columns, data }: ExportButtonProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const disabled = data.length === 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-30 overflow-hidden">
          <button
            onClick={() => {
              exportData(filename, columns, data, 'csv');
              setOpen(false);
            }}
            className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-4 h-4 text-gray-500" />
            <span>CSV</span>
          </button>
          <button
            onClick={() => {
              exportData(filename, columns, data, 'excel');
              setOpen(false);
            }}
            className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            <span>Excel</span>
          </button>
        </div>
      )}
    </div>
  );
}
