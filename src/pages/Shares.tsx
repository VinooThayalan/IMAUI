import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Share {
  id: string;
  ticker: string;
  share_name: string | null;
  gis_code: string | null;
  industry_id: string | null;
  sector_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  industry_types?: {
    industry_name: string;
  };
  sector_types?: {
    sector_name: string;
  };
}

interface IndustryType {
  id: string;
  industry_id: string;
  industry_name: string;
  is_active: boolean;
}

interface SectorType {
  id: string;
  sector_id: string;
  sector_name: string;
  is_active: boolean;
}

export function Shares() {
  const [shares, setShares] = useState<Share[]>([]);
  const [industries, setIndustries] = useState<IndustryType[]>([]);
  const [sectors, setSectors] = useState<SectorType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingShare, setEditingShare] = useState<Share | null>(null);
  const [formData, setFormData] = useState({
    ticker: '',
    share_name: '',
    gis_code: '',
    industry_id: '',
    sector_id: '',
    is_active: true
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchShares();
    fetchIndustries();
    fetchSectors();
  }, []);

  async function fetchShares() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shares')
        .select('*, industry_types(industry_name), sector_types(sector_name)')
        .order('ticker');

      if (error) throw error;
      setShares(data || []);
    } catch (error) {
      console.error('Error fetching shares:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchIndustries() {
    try {
      const { data, error } = await supabase
        .from('industry_types')
        .select('*')
        .eq('is_active', true)
        .order('industry_name');

      if (error) throw error;
      setIndustries(data || []);
    } catch (error) {
      console.error('Error fetching industries:', error);
    }
  }

  async function fetchSectors() {
    try {
      const { data, error } = await supabase
        .from('sector_types')
        .select('*')
        .eq('is_active', true)
        .order('sector_name');

      if (error) throw error;
      setSectors(data || []);
    } catch (error) {
      console.error('Error fetching sectors:', error);
    }
  }

  function handleOpenModal(share?: Share) {
    if (share) {
      setEditingShare(share);
      setFormData({
        ticker: share.ticker,
        share_name: share.share_name || '',
        gis_code: share.gis_code || '',
        industry_id: share.industry_id || '',
        sector_id: share.sector_id || '',
        is_active: share.is_active
      });
    } else {
      setEditingShare(null);
      setFormData({
        ticker: '',
        share_name: '',
        gis_code: '',
        industry_id: '',
        sector_id: '',
        is_active: true
      });
    }
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingShare(null);
    setFormData({
      ticker: '',
      share_name: '',
      gis_code: '',
      industry_id: '',
      sector_id: '',
      is_active: true
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const dataToSubmit = {
        ticker: formData.ticker.toUpperCase(),
        share_name: formData.share_name || null,
        gis_code: formData.gis_code || null,
        industry_id: formData.industry_id || null,
        sector_id: formData.sector_id || null,
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      };

      if (editingShare) {
        const { error } = await supabase
          .from('shares')
          .update(dataToSubmit)
          .eq('id', editingShare.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shares')
          .insert([dataToSubmit]);

        if (error) throw error;
      }

      await fetchShares();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving share:', error);
      alert('Error saving share. Please try again.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this share? This may affect related transactions.')) return;

    try {
      const { error } = await supabase
        .from('shares')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchShares();
    } catch (error) {
      console.error('Error deleting share:', error);
      alert('Error deleting share. It may be in use by existing transactions.');
    }
  }

  const filteredShares = shares.filter(share =>
    share.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (share.share_name && share.share_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shares</h1>
          <p className="text-gray-500 mt-1">Manage share information and classifications</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Share</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search shares by ticker or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticker Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">GICS Industry Group</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Industry</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sector</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredShares.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No shares found
                    </td>
                  </tr>
                ) : (
                  filteredShares.map((share) => (
                    <tr key={share.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-blue-600">{share.ticker}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">{share.share_name || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{share.gis_code || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600">
                          {share.industry_types?.industry_name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600">
                          {share.sector_types?.sector_name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          share.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {share.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleOpenModal(share)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(share.id)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingShare ? 'Edit Share' : 'Add New Share'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Share Name</label>
                  <input
                    type="text"
                    value={formData.share_name}
                    onChange={(e) => setFormData({ ...formData, share_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., John Keells Holdings PLC"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ticker Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.ticker}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., JKH"
                  />
                  <p className="text-xs text-gray-500 mt-1">Stock exchange ticker symbol</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">GICS Industry Group</label>
                  <input
                    type="text"
                    value={formData.gis_code}
                    onChange={(e) => setFormData({ ...formData, gis_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Automobiles & Components"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Industry</label>
                  <select
                    value={formData.industry_id}
                    onChange={(e) => setFormData({ ...formData, industry_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an industry (optional)</option>
                    {industries.map((industry) => (
                      <option key={industry.id} value={industry.id}>
                        {industry.industry_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sector</label>
                  <select
                    value={formData.sector_id}
                    onChange={(e) => setFormData({ ...formData, sector_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a sector (optional)</option>
                    {sectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.sector_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700">
                    Active
                  </label>
                </div>
              </div>
              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {editingShare ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
