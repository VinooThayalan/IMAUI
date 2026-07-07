import { Plus, Search, Filter, Trash2, Pencil } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, fetchRecordForAudit } from '../lib/auditLog';

interface ScripEntry {
  id: string;
  entity_id: string;
  share_id: string;
  entry_date: string;
  announcement_date: string | null;
  effective_date: string | null;
  xd_date: string | null;
  status: string;
  no_of_shares: number;
  script_dividend_ratio: string | null;
  cds_account: string | null;
  notes: string | null;
  created_at: string;
}

interface Entity {
  id: string;
  name: string;
}

interface Share {
  id: string;
  ticker: string;
  share_name: string;
}

const STATUSES = ['AWAITING', 'RECEIVED', 'CANCELLED'] as const;
type Status = typeof STATUSES[number];

const statusColors: Record<Status, string> = {
  AWAITING: 'bg-amber-100 text-amber-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const statusLabels: Record<Status, string> = {
  AWAITING: 'Awaiting',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

const EMPTY_FORM = {
  entity_id: '',
  share_id: '',
  entry_date: new Date().toISOString().split('T')[0],
  announcement_date: '',
  effective_date: '',
  xd_date: '',
  no_of_shares: '',
  script_dividend_ratio: '',
  cds_account: '',
  status: 'AWAITING',
  notes: '',
};

export function ScripEntry() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ScripEntry[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [entriesRes, entitiesRes, sharesRes] = await Promise.all([
        supabase.from('scrip_entries').select('*').order('entry_date', { ascending: false }),
        supabase.from('entities').select('id, name').order('name'),
        supabase.from('shares').select('id, ticker, share_name').order('ticker'),
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;

      setEntries(entriesRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getEntityName(entityId: string) {
    return entities.find(e => e.id === entityId)?.name || 'Unknown';
  }

  function getShareTicker(shareId: string) {
    return shares.find(s => s.id === shareId)?.ticker || 'Unknown';
  }

  function openNew() {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEdit(entry: ScripEntry) {
    setEditingId(entry.id);
    setFormData({
      entity_id: entry.entity_id,
      share_id: entry.share_id,
      entry_date: entry.entry_date,
      announcement_date: entry.announcement_date || '',
      effective_date: entry.effective_date || '',
      xd_date: entry.xd_date || '',
      no_of_shares: String(entry.no_of_shares ?? ''),
      script_dividend_ratio: entry.script_dividend_ratio || '',
      cds_account: entry.cds_account || '',
      status: entry.status,
      notes: entry.notes || '',
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      entity_id: formData.entity_id,
      share_id: formData.share_id,
      entry_date: formData.entry_date,
      announcement_date: formData.announcement_date || null,
      effective_date: formData.effective_date || null,
      xd_date: formData.xd_date || null,
      no_of_shares: Number(formData.no_of_shares),
      script_dividend_ratio: formData.script_dividend_ratio || null,
      cds_account: formData.cds_account || null,
      status: formData.status,
      notes: formData.notes || null,
    };

    try {
      if (editingId) {
        const oldRecord = await fetchRecordForAudit('scrip_entries', editingId);
        const { error } = await supabase.from('scrip_entries').update(payload).eq('id', editingId);
        if (error) throw error;
        logAudit({ tableName: 'scrip_entries', recordId: editingId, action: 'UPDATE', performedBy: user?.email || 'system', oldValues: oldRecord, newValues: { ...oldRecord, ...payload } });
      } else {
        const { data: inserted } = await supabase.from('scrip_entries').insert(payload).select('id').maybeSingle();
        if (!inserted) throw new Error('No data returned from insert');
        logAudit({ tableName: 'scrip_entries', recordId: inserted?.id || 'new', action: 'CREATE', performedBy: user?.email || 'system', newValues: payload });
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error saving scrip entry:', error);
      alert('Failed to save scrip entry');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this scrip entry?')) return;
    try {
      const oldRecord = await fetchRecordForAudit('scrip_entries', id);
      const { error } = await supabase.from('scrip_entries').delete().eq('id', id);
      if (error) throw error;
      logAudit({ tableName: 'scrip_entries', recordId: id, action: 'DELETE', performedBy: user?.email || 'system', oldValues: oldRecord });
      loadData();
    } catch (error) {
      console.error('Error deleting scrip entry:', error);
      alert('Failed to delete scrip entry');
    }
  }

  const filtered = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      getEntityName(e.entity_id).toLowerCase().includes(q) ||
      getShareTicker(e.share_id).toLowerCase().includes(q) ||
      e.status.toLowerCase().includes(q)
    );
  });

  const awaitingCount = entries.filter(e => e.status === 'AWAITING').length;
  const receivedCount = entries.filter(e => e.status === 'RECEIVED').length;
  const cancelledCount = entries.filter(e => e.status === 'CANCELLED').length;

  const statusColor = (s: string) =>
    statusColors[s as Status] ?? 'bg-gray-100 text-gray-600';
  const statusLabel = (s: string) =>
    statusLabels[s as Status] ?? s;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scrip Entry</h1>
          <p className="text-gray-500 mt-1">Manage script dividend entries</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">New Entry</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Total Entries</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{entries.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Awaiting</p>
          <p className="text-2xl font-bold text-amber-600 mt-2">{awaitingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Received</p>
          <p className="text-2xl font-bold text-green-600 mt-2">{receivedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Cancelled</p>
          <p className="text-2xl font-bold text-red-600 mt-2">{cancelledCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search scrip entries..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-700">Filter</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticker</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">No. of Shares</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Script Ratio</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CDS Account</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    {search ? 'No entries match your search.' : 'No scrip entries found. Add your first entry to get started.'}
                  </td>
                </tr>
              ) : (
                filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{getEntityName(entry.entity_id)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">{getShareTicker(entry.share_id)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{entry.no_of_shares?.toLocaleString() || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.script_dividend_ratio || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs space-y-0.5 text-gray-500">
                        {entry.announcement_date && <div>Ann: {entry.announcement_date}</div>}
                        {entry.xd_date && <div className="text-purple-600 font-medium">XD: {entry.xd_date}</div>}
                        {entry.effective_date && <div>Eff: {entry.effective_date}</div>}
                        <div>Entry: {entry.entry_date}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{entry.cds_account || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor(entry.status)}`}>
                        {statusLabel(entry.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{entry.notes || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => openEdit(entry)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Scrip Entry' : 'New Scrip Entry'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Entity <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={formData.entity_id}
                    onChange={e => setFormData({ ...formData, entity_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select Entity</option>
                    {entities.map(entity => (
                      <option key={entity.id} value={entity.id}>{entity.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ticker <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={formData.share_id}
                    onChange={e => setFormData({ ...formData, share_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select Ticker</option>
                    {shares.map(share => (
                      <option key={share.id} value={share.id}>{share.ticker} — {share.share_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Entry Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={formData.entry_date}
                    onChange={e => setFormData({ ...formData, entry_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Announcement Date</label>
                  <input
                    type="date"
                    value={formData.announcement_date}
                    onChange={e => setFormData({ ...formData, announcement_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Effective Date</label>
                  <input
                    type="date"
                    value={formData.effective_date}
                    onChange={e => setFormData({ ...formData, effective_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-purple-700 mb-1.5">XD Date</label>
                  <input
                    type="date"
                    value={formData.xd_date}
                    onChange={e => setFormData({ ...formData, xd_date: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">Ex-dividend date</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">CDS Account</label>
                  <input
                    type="text"
                    value={formData.cds_account}
                    onChange={e => setFormData({ ...formData, cds_account: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g., CMB / SBL"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">No. of Shares <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.no_of_shares}
                    onChange={e => setFormData({ ...formData, no_of_shares: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Script Dividend Ratio</label>
                  <input
                    type="text"
                    value={formData.script_dividend_ratio}
                    onChange={e => setFormData({ ...formData, script_dividend_ratio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g., 1:10"
                  />
                  <p className="text-xs text-gray-400 mt-1">Format: X:Y (e.g., 1:10 means 1 share per 10 held)</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="AWAITING">Awaiting</option>
                    <option value="RECEIVED">Received</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                >
                  {editingId ? 'Save Changes' : 'Create Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
