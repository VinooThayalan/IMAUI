import { Plus, Search, Trash2, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Amalgamation {
  id: string;
  entity_id: string;
  share_id: string;
  announcement_date?: string;
  amalgamation_date?: string;
  shares_at_effective_date?: number;
  amalgamation_ratio?: string;
  new_total_shares?: number;
  share_decrease?: number;
  new_price_per_share?: number;
  created_at: string;
}

interface Entity {
  id: string;
  name: string;
}

interface Share {
  id: string;
  share_name: string;
  ticker: string;
}

export function Amalgamations() {
  const [showForm, setShowForm] = useState(false);
  const [amalgamations, setAmalgamations] = useState<Amalgamation[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    entity_id: '',
    share_id: '',
    announcement_date: '',
    amalgamation_date: '',
    shares_at_effective_date: '',
    amalgamation_ratio: '',
    new_total_shares: '',
    share_decrease: '',
    new_price_per_share: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [amalgamationsRes, entitiesRes, sharesRes] = await Promise.all([
        supabase
          .from('scrip_entries')
          .select('*')
          .eq('transaction_type', 'Amalgamation')
          .order('amalgamation_date', { ascending: false }),
        supabase.from('entities').select('id, name').order('name'),
        supabase.from('shares').select('id, share_name, ticker').order('share_name')
      ]);

      if (amalgamationsRes.error) throw amalgamationsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;

      setAmalgamations(amalgamationsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function getEntityName(entityId: string) {
    return entities.find(e => e.id === entityId)?.name || 'Unknown';
  }

  function getShareInfo(shareId: string) {
    const share = shares.find(s => s.id === shareId);
    return share ? `${share.ticker} - ${share.share_name}` : 'Unknown';
  }

  function resetForm() {
    setFormData({
      entity_id: '',
      share_id: '',
      announcement_date: '',
      amalgamation_date: '',
      shares_at_effective_date: '',
      amalgamation_ratio: '',
      new_total_shares: '',
      share_decrease: '',
      new_price_per_share: ''
    });
  }

  async function handleCreateAmalgamation(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.entity_id || !formData.share_id) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from('scrip_entries').insert({
        entity_id: formData.entity_id,
        share_id: formData.share_id,
        transaction_type: 'Amalgamation',
        announcement_date: formData.announcement_date || null,
        amalgamation_date: formData.amalgamation_date || null,
        shares_at_effective_date: parseFloat(formData.shares_at_effective_date) || null,
        amalgamation_ratio: formData.amalgamation_ratio || null,
        new_total_shares: parseFloat(formData.new_total_shares) || null,
        share_decrease: parseFloat(formData.share_decrease) || null,
        new_price_per_share: parseFloat(formData.new_price_per_share) || null
      });

      if (error) throw error;

      alert('Amalgamation created successfully');
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating amalgamation:', error);
      alert('Failed to create amalgamation');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this amalgamation?')) return;

    try {
      const { error } = await supabase.from('scrip_entries').delete().eq('id', id);

      if (error) throw error;

      alert('Amalgamation deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting amalgamation:', error);
      alert('Failed to delete amalgamation');
    }
  }

  const filteredAmalgamations = amalgamations.filter(am => {
    const entityName = getEntityName(am.entity_id).toLowerCase();
    const shareInfo = getShareInfo(am.share_id).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return entityName.includes(searchLower) || shareInfo.includes(searchLower);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Amalgamations</h1>
          <p className="text-gray-600 mt-1">Manage company amalgamations and mergers</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span>{showForm ? 'Cancel' : 'New Amalgamation'}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">New Amalgamation</h2>
          <form onSubmit={handleCreateAmalgamation} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entity <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.entity_id}
                  onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Entity</option>
                  {entities.map(entity => (
                    <option key={entity.id} value={entity.id}>{entity.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transaction Type
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium">
                  Amalgamation
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Share <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.share_id}
                  onChange={(e) => setFormData({ ...formData, share_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Share</option>
                  {shares.map(share => (
                    <option key={share.id} value={share.id}>
                      {share.ticker} - {share.share_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Share Balance
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  -
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Cost Per Share
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  -
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Announcement Date
                </label>
                <input
                  type="date"
                  value={formData.announcement_date}
                  onChange={(e) => setFormData({ ...formData, announcement_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amalgamation Date
                </label>
                <input
                  type="date"
                  value={formData.amalgamation_date}
                  onChange={(e) => setFormData({ ...formData, amalgamation_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Share Balance as at Effective Date
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.shares_at_effective_date}
                  onChange={(e) => setFormData({ ...formData, shares_at_effective_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amalgamation Ratio
                </label>
                <input
                  type="text"
                  value={formData.amalgamation_ratio}
                  onChange={(e) => setFormData({ ...formData, amalgamation_ratio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 1:5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Total Shares
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.new_total_shares}
                  onChange={(e) => setFormData({ ...formData, new_total_shares: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Share Decrease
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.share_decrease}
                  onChange={(e) => setFormData({ ...formData, share_decrease: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Price Per Share (Rs.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.new_price_per_share}
                  onChange={(e) => setFormData({ ...formData, new_price_per_share: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 150.00"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                disabled={submitting}
              >
                <Save className="w-4 h-4" />
                <span>{submitting ? 'Creating...' : 'Create Amalgamation'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search amalgamations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Share</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Announcement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amalgamation Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ratio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Shares</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decrease</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAmalgamations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No amalgamations found. Click "New Amalgamation" to create one.
                  </td>
                </tr>
              ) : (
                filteredAmalgamations.map((am) => (
                  <tr key={am.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {getEntityName(am.entity_id)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getShareInfo(am.share_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {am.announcement_date ? new Date(am.announcement_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {am.amalgamation_date ? new Date(am.amalgamation_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {am.amalgamation_ratio || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {am.new_total_shares !== null && am.new_total_shares !== undefined ? am.new_total_shares.toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {am.share_decrease !== null && am.share_decrease !== undefined ? am.share_decrease.toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {am.new_price_per_share ? `Rs. ${Number(am.new_price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(am.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
