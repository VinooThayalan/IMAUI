import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Broker {
  id: string;
  broker_id: string;
  broker_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function Brokers() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingBroker, setEditingBroker] = useState<Broker | null>(null);
  const [formData, setFormData] = useState({
    broker_name: '',
    is_active: true
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBrokers();
  }, []);

  async function fetchBrokers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('brokers')
        .select('*')
        .order('broker_id');

      if (error) throw error;
      setBrokers(data || []);
    } catch (error) {
      console.error('Error fetching brokers:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenModal(broker?: Broker) {
    if (broker) {
      setEditingBroker(broker);
      setFormData({
        broker_name: broker.broker_name,
        is_active: broker.is_active
      });
    } else {
      setEditingBroker(null);
      setFormData({
        broker_name: '',
        is_active: true
      });
    }
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingBroker(null);
    setFormData({
      broker_name: '',
      is_active: true
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingBroker) {
        const { error } = await supabase
          .from('brokers')
          .update({
            broker_name: formData.broker_name,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingBroker.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('brokers')
          .insert([formData]);

        if (error) throw error;
      }

      await fetchBrokers();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving broker:', error);
      alert('Error saving broker. Please try again.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this broker?')) return;

    try {
      const { error } = await supabase
        .from('brokers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchBrokers();
    } catch (error) {
      console.error('Error deleting broker:', error);
      alert('Error deleting broker. It may be in use by existing records.');
    }
  }

  const filteredBrokers = brokers.filter(broker =>
    broker.broker_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    broker.broker_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Brokers</h1>
          <p className="text-gray-500 mt-1">Manage broker information</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Broker</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search brokers..."
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Broker ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Broker Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBrokers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No brokers found
                    </td>
                  </tr>
                ) : (
                  filteredBrokers.map((broker) => (
                    <tr key={broker.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-blue-600">{broker.broker_id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">{broker.broker_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          broker.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {broker.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleOpenModal(broker)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(broker.id)}
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
                {editingBroker ? 'Edit Broker' : 'Add New Broker'}
              </h2>
              {!editingBroker && (
                <p className="text-sm text-gray-500 mt-1">Broker ID will be generated automatically</p>
              )}
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {editingBroker && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Broker ID</label>
                  <input
                    type="text"
                    value={editingBroker.broker_id}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Broker Name *</label>
                <input
                  type="text"
                  required
                  value={formData.broker_name}
                  onChange={(e) => setFormData({ ...formData, broker_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter broker name"
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
                  {editingBroker ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
