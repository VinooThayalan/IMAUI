import { Plus, Edit, Trash2, Percent } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface BrokerageFeeType {
  id: string;
  name: string;
  min_price: number | null;
  max_price: number | null;
  rate: number;
  description: string;
  is_active: boolean;
  created_at: string;
}

export function BrokerageFeeTypes() {
  const [feeTypes, setFeeTypes] = useState<BrokerageFeeType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState<BrokerageFeeType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    min_price: '',
    max_price: '',
    rate: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchFeeTypes();
  }, []);

  const fetchFeeTypes = async () => {
    const { data, error } = await supabase
      .from('brokerage_fee_types')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching fee types:', error);
      return;
    }

    setFeeTypes(data || []);
  };

  const handleAddFeeType = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingFeeType) {
      const { error } = await supabase
        .from('brokerage_fee_types')
        .update({
          name: formData.name,
          min_price: formData.min_price ? parseFloat(formData.min_price) : null,
          max_price: formData.max_price ? parseFloat(formData.max_price) : null,
          rate: parseFloat(formData.rate),
          description: formData.description,
          is_active: formData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingFeeType.id);

      if (error) {
        console.error('Error updating fee type:', error);
        alert('Failed to update fee type');
        return;
      }
    } else {
      const { error } = await supabase
        .from('brokerage_fee_types')
        .insert({
          name: formData.name,
          min_price: formData.min_price ? parseFloat(formData.min_price) : null,
          max_price: formData.max_price ? parseFloat(formData.max_price) : null,
          rate: parseFloat(formData.rate),
          description: formData.description,
          is_active: formData.is_active
        });

      if (error) {
        console.error('Error adding fee type:', error);
        alert('Failed to add fee type');
        return;
      }
    }

    setShowModal(false);
    setEditingFeeType(null);
    setFormData({
      name: '',
      min_price: '',
      max_price: '',
      rate: '',
      description: '',
      is_active: true
    });
    fetchFeeTypes();
  };

  const handleEdit = (feeType: BrokerageFeeType) => {
    setEditingFeeType(feeType);
    setFormData({
      name: feeType.name,
      min_price: feeType.min_price ? feeType.min_price.toString() : '',
      max_price: feeType.max_price ? feeType.max_price.toString() : '',
      rate: feeType.rate.toString(),
      description: feeType.description,
      is_active: feeType.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fee type?')) {
      return;
    }

    const { error } = await supabase
      .from('brokerage_fee_types')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting fee type:', error);
      alert('Failed to delete fee type');
      return;
    }

    fetchFeeTypes();
  };

  const handleToggleActive = async (feeType: BrokerageFeeType) => {
    const { error } = await supabase
      .from('brokerage_fee_types')
      .update({
        is_active: !feeType.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', feeType.id);

    if (error) {
      console.error('Error toggling fee type status:', error);
      alert('Failed to update fee type status');
      return;
    }

    fetchFeeTypes();
  };

  const activeFeeTypes = feeTypes.filter(ft => ft.is_active);
  const avgRate = activeFeeTypes.length > 0
    ? activeFeeTypes.reduce((sum, ft) => sum + ft.rate, 0) / activeFeeTypes.length
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Brokerage Fee Types</h1>
          <p className="text-gray-500 mt-1">Manage brokerage fee types and rates</p>
        </div>
        <button
          onClick={() => {
            setEditingFeeType(null);
            setFormData({
              name: '',
              min_price: '',
              max_price: '',
              rate: '',
              description: '',
              is_active: true
            });
            setShowModal(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Fee Type</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Fee Types</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{feeTypes.length}</p>
              <p className="text-sm text-gray-500 mt-2">{activeFeeTypes.length} active</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Percent className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Fee Types</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{activeFeeTypes.length}</p>
              <p className="text-sm text-gray-500 mt-2">Currently in use</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Min Price</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Max Price</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {feeTypes.map((feeType) => (
                <tr key={feeType.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{feeType.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {feeType.min_price ? `LKR ${feeType.min_price.toLocaleString()}` : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {feeType.max_price ? `LKR ${feeType.max_price.toLocaleString()}` : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-blue-600">{feeType.rate}%</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{feeType.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(feeType)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                        feeType.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {feeType.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(feeType)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(feeType.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingFeeType ? 'Edit Fee Type' : 'Add Fee Type'}
              </h2>
            </div>
            <form onSubmit={handleAddFeeType} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-6 overflow-y-auto">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Standard, Premium, VIP"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Min Price (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.min_price}
                      onChange={(e) => setFormData({ ...formData, min_price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Max Price (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.max_price}
                      onChange={(e) => setFormData({ ...formData, max_price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 100000.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rate (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 0.30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Description of this fee type"
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                    Active
                  </label>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-4 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingFeeType(null);
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {editingFeeType ? 'Update Fee Type' : 'Add Fee Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
