import { Search, Calendar, TrendingUp, TrendingDown, Save, Minus, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Share {
  id: string;
  ticker: string;
  name: string | null;
}

interface PriceRow {
  share_id: string;
  ticker: string;
  name: string | null;
  previousPrice: number | null;
  existingId: string | null;
  newPrice: string;
}

export function DailyPrices() {
  const { appUser, user } = useAuth();
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [effectiveDate]);

  async function loadData() {
    try {
      setLoading(true);

      const { data: sharesData, error: sharesError } = await supabase
        .from('shares')
        .select('id, ticker, name, is_active')
        .order('ticker');
      if (sharesError) throw sharesError;

      const activeShares = (sharesData || []).filter((s: any) => s.is_active !== false) as Share[];

      const { data: todaysPrices, error: todayError } = await supabase
        .from('daily_share_prices')
        .select('id, share_id, share_price')
        .eq('effective_date', effectiveDate);
      if (todayError) throw todayError;

      const { data: history, error: histError } = await supabase
        .from('daily_share_prices')
        .select('share_id, share_price, effective_date')
        .lt('effective_date', effectiveDate)
        .order('effective_date', { ascending: false });
      if (histError) throw histError;

      const previousByShare = new Map<string, number>();
      (history || []).forEach((r: any) => {
        if (!previousByShare.has(r.share_id)) {
          previousByShare.set(r.share_id, Number(r.share_price));
        }
      });

      const existingByShare = new Map<string, { id: string; price: number }>();
      (todaysPrices || []).forEach((r: any) => {
        existingByShare.set(r.share_id, { id: r.id, price: Number(r.share_price) });
      });

      const nextRows: PriceRow[] = activeShares.map((s) => {
        const existing = existingByShare.get(s.id);
        return {
          share_id: s.id,
          ticker: s.ticker,
          name: s.name,
          previousPrice: previousByShare.get(s.id) ?? null,
          existingId: existing?.id ?? null,
          newPrice: existing ? String(existing.price) : '',
        };
      });

      setRows(nextRows);
    } catch (error) {
      console.error('Error loading daily prices:', error);
      setFeedback({ type: 'error', message: 'Failed to load prices' });
    } finally {
      setLoading(false);
    }
  }

  function updateRow(share_id: string, value: string) {
    setRows((prev) => prev.map((r) => (r.share_id === share_id ? { ...r, newPrice: value } : r)));
  }

  async function handleSaveAll() {
    const createdBy = appUser?.full_name || appUser?.email || user?.email || 'Unknown';
    const toUpsert = rows
      .filter((r) => r.newPrice.trim() !== '' && !Number.isNaN(parseFloat(r.newPrice)))
      .map((r) => ({
        id: r.existingId || undefined,
        share_id: r.share_id,
        effective_date: effectiveDate,
        share_price: parseFloat(r.newPrice),
        entered_by: createdBy,
        status: 'Approved' as const,
      }));

    if (toUpsert.length === 0) {
      setFeedback({ type: 'error', message: 'Enter at least one price before saving' });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      const newRecords = toUpsert.filter((r) => !r.id).map(({ id: _id, ...rest }) => rest);
      const updates = toUpsert.filter((r) => r.id);

      if (newRecords.length > 0) {
        const { error } = await supabase.from('daily_share_prices').insert(newRecords);
        if (error) throw error;
      }

      for (const u of updates) {
        const { id, ...rest } = u;
        const { error } = await supabase.from('daily_share_prices').update(rest).eq('id', id);
        if (error) throw error;
      }

      setFeedback({ type: 'success', message: `Saved ${toUpsert.length} price${toUpsert.length > 1 ? 's' : ''}` });
      await loadData();
    } catch (error) {
      console.error('Error saving prices:', error);
      setFeedback({ type: 'error', message: 'Failed to save prices' });
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.ticker.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const enteredCount = rows.filter((r) => r.newPrice.trim() !== '').length;
  const savedCount = rows.filter((r) => r.existingId !== null).length;
  const pendingCount = rows.length - savedCount;

  function changeIndicator(row: PriceRow) {
    const newVal = parseFloat(row.newPrice);
    if (Number.isNaN(newVal) || row.previousPrice === null) return null;
    const diff = newVal - row.previousPrice;
    if (diff === 0) return { Icon: Minus, color: 'text-gray-500', label: '0.00%' };
    const pct = (diff / row.previousPrice) * 100;
    const up = diff > 0;
    return {
      Icon: up ? TrendingUp : TrendingDown,
      color: up ? 'text-green-600' : 'text-red-600',
      label: `${up ? '+' : ''}${pct.toFixed(2)}%`,
    };
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daily Share Prices</h1>
          <p className="text-gray-500 mt-1">Bulk update prices for all active shares</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg">
            <Calendar className="w-5 h-5 text-gray-500" />
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="outline-none text-sm font-medium text-gray-900"
            />
          </div>
          <button
            onClick={handleSaveAll}
            disabled={saving || loading || enteredCount === 0}
            className="flex items-center space-x-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            <span className="font-medium">{saving ? 'Saving...' : `Save ${enteredCount || ''}`.trim()}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Active Shares" value={rows.length} sub="Tracked symbols" icon={TrendingUp} tone="blue" />
        <StatCard label="Prices Set Today" value={savedCount} sub="Already saved" icon={CheckCircle2} tone="green" />
        <StatCard label="Awaiting Entry" value={pendingCount} sub="No price for this date" icon={Calendar} tone="yellow" />
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticker or share name..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticker</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share Name</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Previous Price</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-56">New Price (LKR)</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    Loading shares...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    No shares found
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const change = changeIndicator(row);
                  return (
                    <tr key={row.share_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="text-sm font-bold text-blue-600">{row.ticker}</span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{row.name || '-'}</span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-700">
                          {row.previousPrice !== null
                            ? `Rs. ${row.previousPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.newPrice}
                          onChange={(e) => updateRow(row.share_id, e.target.value)}
                          placeholder="0.00"
                          className="w-40 px-3 py-1.5 border border-gray-300 rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        {change ? (
                          <span className={`inline-flex items-center text-sm font-semibold ${change.color}`}>
                            <change.Icon className="w-4 h-4 mr-1" />
                            {change.label}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-center">
                        {row.existingId ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Saved
                          </span>
                        ) : row.newPrice.trim() !== '' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            Unsaved
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            Empty
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'blue' | 'green' | 'yellow';
}) {
  const tones = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          <p className="text-sm text-gray-500 mt-2">{sub}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
