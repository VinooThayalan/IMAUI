import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Save, X, Building2, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, fetchRecordForAudit } from '../lib/auditLog';

interface Entity {
  id: string;
  entity_id: string;
  name: string;
}

interface Share {
  id: string;
  ticker: string;
  share_name: string | null;
}

interface OpeningBalance {
  id: string;
  entity_id: string;
  share_id: string;
  opening_shares: number;
  effective_date: string;
  average_purchase_cost: number;
  notes: string | null;
  entities?: { name: string; entity_id: string } | null;
  shares?: { ticker: string; share_name: string | null } | null;
}

interface FormState {
  entity_id: string;
  share_id: string;
  opening_shares: string;
  effective_date: string;
  total_portfolio_value: string;
  notes: string;
}

const emptyForm: FormState = {
  entity_id: '',
  share_id: '',
  opening_shares: '',
  effective_date: new Date().toISOString().split('T')[0],
  total_portfolio_value: '',
  notes: '',
};

function computeAvgCost(shares: string, total: string): number {
  const s = parseFloat(shares);
  const t = parseFloat(total);
  if (!s || Number.isNaN(s) || Number.isNaN(t)) return 0;
  return t / s;
}

export function OpeningBalances() {
  const { user } = useAuth();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [balances, setBalances] = useState<OpeningBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [entitiesRes, sharesRes, balancesRes] = await Promise.all([
        supabase.from('entities').select('id, entity_id, name').order('name'),
        supabase.from('shares').select('id, ticker, share_name, is_active').order('ticker'),
        supabase
          .from('entity_share_opening_balances')
          .select('*, entities(name, entity_id), shares(ticker, share_name)')
          .order('effective_date', { ascending: false }),
      ]);

      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      if (balancesRes.error) throw balancesRes.error;

      setEntities((entitiesRes.data || []) as Entity[]);
      setShares(((sharesRes.data || []) as any[]).filter((s) => s.is_active !== false));
      setBalances((balancesRes.data || []) as OpeningBalance[]);
    } catch (e) {
      console.error(e);
      setError('Failed to load opening balances');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  }

  function openEdit(b: OpeningBalance) {
    setEditingId(b.id);
    const total = Number(b.opening_shares) * Number(b.average_purchase_cost);
    setForm({
      entity_id: b.entity_id,
      share_id: b.share_id,
      opening_shares: String(b.opening_shares),
      effective_date: b.effective_date,
      total_portfolio_value: total ? String(total) : '',
      notes: b.notes || '',
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.entity_id || !form.share_id) {
      setError('Entity and share are required');
      return;
    }
    const shares_num = parseFloat(form.opening_shares);
    const total_num = parseFloat(form.total_portfolio_value);
    if (Number.isNaN(shares_num) || shares_num <= 0) {
      setError('Opening shares must be greater than zero');
      return;
    }
    if (Number.isNaN(total_num) || total_num < 0) {
      setError('Total portfolio value must be a non-negative number');
      return;
    }
    const cost_num = total_num / shares_num;
    if (!form.effective_date) {
      setError('Effective date is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        entity_id: form.entity_id,
        share_id: form.share_id,
        opening_shares: shares_num,
        effective_date: form.effective_date,
        average_purchase_cost: cost_num,
        notes: form.notes.trim() || null,
      };

      if (editingId) {
        const oldRecord = await fetchRecordForAudit('entity_share_opening_balances', editingId);
        const { error } = await supabase
          .from('entity_share_opening_balances')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        logAudit({ tableName: 'entity_share_opening_balances', recordId: editingId, action: 'UPDATE', performedBy: user?.email || 'system', oldValues: oldRecord, newValues: { ...oldRecord, ...payload } });
      } else {
        const { data: inserted } = await supabase
          .from('entity_share_opening_balances')
          .insert({ ...payload, created_by: user?.id || null })
          .select('id').maybeSingle();
        if (!inserted) throw new Error('No data returned from insert');
        logAudit({ tableName: 'entity_share_opening_balances', recordId: inserted?.id || 'new', action: 'CREATE', performedBy: user?.email || 'system', newValues: payload });
      }

      setShowModal(false);
      await loadAll();
    } catch (e: any) {
      console.error(e);
      if (e?.code === '23505') {
        setError('An opening balance for this entity and share already exists. Edit the existing entry instead.');
      } else {
        setError('Failed to save opening balance');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this opening balance?')) return;
    try {
      const oldRecord = await fetchRecordForAudit('entity_share_opening_balances', id);
      const { error } = await supabase.from('entity_share_opening_balances').delete().eq('id', id);
      if (error) throw error;
      logAudit({ tableName: 'entity_share_opening_balances', recordId: id, action: 'DELETE', performedBy: user?.email || 'system', oldValues: oldRecord });
      await loadAll();
    } catch (e) {
      console.error(e);
      setError('Failed to delete opening balance');
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return balances;
    return balances.filter((b) => {
      const e = b.entities?.name?.toLowerCase() || '';
      const s = (b.shares?.ticker || '').toLowerCase() + ' ' + (b.shares?.share_name || '').toLowerCase();
      return e.includes(q) || s.includes(q);
    });
  }, [balances, search]);

  const totalValue = useMemo(
    () => balances.reduce((sum, b) => sum + Number(b.opening_shares) * Number(b.average_purchase_cost), 0),
    [balances]
  );
  const uniqueEntities = useMemo(() => new Set(balances.map((b) => b.entity_id)).size, [balances]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Opening Balances</h1>
          <p className="text-gray-500 mt-1">Enter the starting share holdings for each entity</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Opening Balance</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Opening Records" value={balances.length.toString()} sub="Across all entities" icon={TrendingUp} tone="blue" />
        <StatCard label="Entities With Holdings" value={uniqueEntities.toString()} sub="Unique entities" icon={Building2} tone="green" />
        <StatCard
          label="Total Opening Value"
          value={`Rs. ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Shares x Avg cost"
          icon={Calendar}
          tone="yellow"
        />
      </div>

      {error && !showModal && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-medium">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by entity or share..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Opening Shares</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Effective Date</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Purchase Cost</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Opening Value</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">Loading...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    No opening balances recorded yet
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const openingValue = Number(b.opening_shares) * Number(b.average_purchase_cost);
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{b.entities?.name || '-'}</div>
                        <div className="text-xs text-gray-500">{b.entities?.entity_id}</div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="text-sm font-bold text-blue-600">{b.shares?.ticker}</div>
                        <div className="text-xs text-gray-500">{b.shares?.share_name}</div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                        {Number(b.opening_shares).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">{b.effective_date}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                        Rs. {Number(b.average_purchase_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                        Rs. {openingValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openEdit(b)}
                            className="p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(b.id)}
                            className="p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <div className="min-h-full flex items-start sm:items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8 flex flex-col max-h-[calc(100vh-4rem)]">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? 'Edit Opening Balance' : 'Add Opening Balance'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-medium">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Entity</label>
                  <select
                    value={form.entity_id}
                    onChange={(e) => setForm({ ...form, entity_id: e.target.value })}
                    disabled={!!editingId}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Select entity</option>
                    {entities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Share</label>
                  <select
                    value={form.share_id}
                    onChange={(e) => setForm({ ...form, share_id: e.target.value })}
                    disabled={!!editingId}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Select share</option>
                    {shares.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.ticker} {s.share_name ? `- ${s.share_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Opening No. of Shares</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={form.opening_shares}
                    onChange={(e) => setForm({ ...form, opening_shares: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Effective Date</label>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Total Portfolio Value (LKR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.total_portfolio_value}
                    onChange={(e) => setForm({ ...form, total_portfolio_value: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">The total amount paid for all opening shares. Average cost is calculated from this.</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Average Purchase Cost (Calculated)</label>
                  <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-900 font-semibold">
                    Rs. {computeAvgCost(form.opening_shares, form.total_portfolio_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    <span className="text-gray-500 font-normal ml-2 text-xs">per share</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add any additional notes..."
                  />
                </div>
              </div>

              {form.opening_shares && form.total_portfolio_value && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm flex items-center justify-between">
                  <div>
                    <span className="text-gray-600">Total Value: </span>
                    <span className="font-bold text-blue-700">
                      Rs. {(parseFloat(form.total_portfolio_value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Avg Cost: </span>
                    <span className="font-bold text-blue-700">
                      Rs. {computeAvgCost(form.opening_shares, form.total_portfolio_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 flex-shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center space-x-2 px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : editingId ? 'Update' : 'Save'}</span>
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
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
  value: string;
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
