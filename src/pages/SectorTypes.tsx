import { Plus, Search, CreditCard as Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, fetchRecordForAudit } from '../lib/auditLog';

interface SectorType {
  id: string;
  sector_id: string;
  sector_name: string;
  industry_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  industry_types?: {
    industry_name: string;
  };
}

export function SectorTypes() {
  const { user } = useAuth();
  const [sectors, setSectors] = useState<SectorType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSector, setEditingSector] = useState<SectorType | null>(null);
  const [formData, setFormData] = useState({
    sector_name: '',
    industry_id: '',
    is_active: true
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSectors();
  }, []);

  async function fetchSectors() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sector_types')
        .select('*, industry_types(industry_name)')
        .order('sector_id');

      if (error) throw error;
      setSectors(data || []);
    } catch (error) {
      console.error('Error fetching sectors:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenModal(sector?: SectorType) {
    if (sector) {
      setEditingSector(sector);
      setFormData({
        sector_name: sector.sector_name,
        industry_id: sector.industry_id || '',
        is_active: sector.is_active
      });
    } else {
      setEditingSector(null);
      setFormData({
        sector_name: '',
        industry_id: '',
        is_active: true
      });
    }
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingSector(null);
    setFormData({
      sector_name: '',
      industry_id: '',
      is_active: true
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const dataToSubmit = {
        sector_name: formData.sector_name,
        industry_id: formData.industry_id || null,
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      };

      if (editingSector) {
        const oldRecord = await fetchRecordForAudit('sector_types', editingSector.id);
        const { error } = await supabase
          .from('sector_types')
          .update(dataToSubmit)
          .eq('id', editingSector.id);

        if (error) throw error;
        logAudit({ tableName: 'sector_types', recordId: editingSector.id, action: 'UPDATE', performedBy: user?.email || 'system', oldValues: oldRecord, newValues: { ...oldRecord, ...dataToSubmit } });
      } else {
        const { data: inserted, error } = await supabase
          .from('sector_types')
          .insert([dataToSubmit])
          .select('id')
          .maybeSingle();

        if (error) throw error;
        logAudit({ tableName: 'sector_types', recordId: inserted?.id || 'new', action: 'CREATE', performedBy: user?.email || 'system', newValues: dataToSubmit });
      }

      await fetchSectors();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving sector:', error);
      alert('Error saving sector. Please try again.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this sector? This may affect related shares.')) return;

    try {
      const oldRecord = await fetchRecordForAudit('sector_types', id);
      const { error } = await supabase
        .from('sector_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
      logAudit({ tableName: 'sector_types', recordId: id, action: 'DELETE', performedBy: user?.email || 'system', oldValues: oldRecord });
      await fetchSectors();
    } catch (error) {
      console.error('Error deleting sector:', error);
      alert('Error deleting sector. It may be in use by existing shares.');
    }
  }

  const filteredSectors = sectors.filter(sector =>
    sector.sector_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sector.sector_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sector Types</h1>
          <p className="text-gray-500 mt-1">Manage sector classifications</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Sector</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search sectors..."
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sector ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sector Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSectors.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No sectors found
                    </td>
                  </tr>
                ) : (
                  filteredSectors.map((sector) => (
                    <tr key={sector.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-blue-600">{sector.sector_id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">{sector.sector_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          sector.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {sector.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleOpenModal(sector)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(sector.id)}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingSector ? 'Edit Sector' : 'Add New Sector'}
              </h2>
              {!editingSector && (
                <p className="text-sm text-gray-500 mt-1">Sector ID will be generated automatically</p>
              )}
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {editingSector && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sector ID</label>
                  <input
                    type="text"
                    value={editingSector.sector_id}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sector Name *</label>
                <input
                  type="text"
                  required
                  value={formData.sector_name}
                  onChange={(e) => setFormData({ ...formData, sector_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter sector name"
                />
              </div>
              <div className="flex items-center">
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
                  {editingSector ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
