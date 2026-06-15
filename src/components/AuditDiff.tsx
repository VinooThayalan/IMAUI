import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface AuditDiffProps {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  changedFields?: string[] | null;
}

const SKIP_FIELDS = new Set(['id', 'created_at', 'updated_at']);

function formatValue(val: any): string {
  if (val === null || val === undefined) return '--';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return val.toLocaleString();
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

function humanizeField(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AuditDiff({ action, oldValues, newValues, changedFields }: AuditDiffProps) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const changedSet = new Set(changedFields || []);

  if (action === 'CREATE' && newValues) {
    const fields = Object.entries(newValues).filter(([k]) => !SKIP_FIELDS.has(k));
    return (
      <div className="rounded-lg border border-green-200 overflow-hidden">
        <div className="bg-green-50 px-4 py-2 text-xs font-semibold text-green-800 uppercase tracking-wider">
          New Record Created
        </div>
        <table className="w-full text-sm">
          <tbody>
            {fields.map(([key, val]) => (
              <tr key={key} className="border-t border-green-100">
                <td className="px-4 py-2 font-medium text-gray-600 w-1/3 bg-white">{humanizeField(key)}</td>
                <td className="px-4 py-2 bg-green-50 text-green-900">{formatValue(val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (action === 'DELETE' && oldValues) {
    const fields = Object.entries(oldValues).filter(([k]) => !SKIP_FIELDS.has(k));
    return (
      <div className="rounded-lg border border-red-200 overflow-hidden">
        <div className="bg-red-50 px-4 py-2 text-xs font-semibold text-red-800 uppercase tracking-wider">
          Record Deleted
        </div>
        <table className="w-full text-sm">
          <tbody>
            {fields.map(([key, val]) => (
              <tr key={key} className="border-t border-red-100">
                <td className="px-4 py-2 font-medium text-gray-600 w-1/3 bg-white">{humanizeField(key)}</td>
                <td className="px-4 py-2 bg-red-50 text-red-900 line-through">{formatValue(val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (action === 'UPDATE' && oldValues && newValues) {
    const allKeys = Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)])).filter(
      (k) => !SKIP_FIELDS.has(k)
    );
    const changed = allKeys.filter((k) => changedSet.has(k));
    const unchanged = allKeys.filter((k) => !changedSet.has(k));

    return (
      <div className="rounded-lg border border-amber-200 overflow-hidden">
        <div className="bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 uppercase tracking-wider">
          {changed.length} Field{changed.length !== 1 ? 's' : ''} Changed
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-1/3">Field</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-red-600 w-1/3">Previous Value</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-green-600 w-1/3">New Value</th>
            </tr>
          </thead>
          <tbody>
            {changed.map((key) => (
              <tr key={key} className="border-t border-gray-200">
                <td className="px-4 py-2 font-medium text-gray-700">{humanizeField(key)}</td>
                <td className="px-4 py-2 bg-red-50 text-red-800">{formatValue(oldValues[key])}</td>
                <td className="px-4 py-2 bg-green-50 text-green-800">{formatValue(newValues[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {unchanged.length > 0 && (
          <div className="border-t border-gray-200">
            <button
              onClick={() => setShowUnchanged(!showUnchanged)}
              className="flex items-center gap-1 px-4 py-2 text-xs text-gray-500 hover:text-gray-700 w-full text-left"
            >
              {showUnchanged ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {unchanged.length} unchanged field{unchanged.length !== 1 ? 's' : ''}
            </button>
            {showUnchanged && (
              <table className="w-full text-sm">
                <tbody>
                  {unchanged.map((key) => (
                    <tr key={key} className="border-t border-gray-100">
                      <td className="px-4 py-1.5 font-medium text-gray-400 w-1/3">{humanizeField(key)}</td>
                      <td className="px-4 py-1.5 text-gray-400" colSpan={2}>{formatValue(oldValues[key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  }

  return <p className="text-sm text-gray-400 italic">No detail available</p>;
}
