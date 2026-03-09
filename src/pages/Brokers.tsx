import { Plus, Search, Edit, Trash2, UserPlus, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Broker {
  id: string;
  broker_id: string;
  broker_name: string;
  contact_person_name: string | null;
  contact_person_email: string | null;
  contact_person_phone: string | null;
  contact_person_mobile: string | null;
  contact_person_designation: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Entity {
  id: string;
  entity_id: string;
  name: string;
}

interface BrokerEntity {
  id: string;
  entity_id: string;
  relationship_type: string;
  is_active: boolean;
  assigned_date: string;
  entities: Entity;
}

export function Brokers() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [editingBroker, setEditingBroker] = useState<Broker | null>(null);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);
  const [selectedBrokerName, setSelectedBrokerName] = useState<string>('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [brokerEntities, setBrokerEntities] = useState<BrokerEntity[]>([]);
  const [formData, setFormData] = useState({
    broker_name: '',
    contact_person_name: '',
    contact_person_email: '',
    contact_person_phone: '',
    contact_person_mobile: '',
    contact_person_designation: '',
    is_active: true
  });
  const [entityFormData, setEntityFormData] = useState({
    entity_id: '',
    relationship_type: 'Primary Broker',
    assigned_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBrokers();
    fetchEntities();
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

  async function fetchEntities() {
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('id, entity_id, name')
        .order('name');

      if (error) throw error;
      setEntities(data || []);
    } catch (error) {
      console.error('Error fetching entities:', error);
    }
  }

  async function fetchBrokerEntities(brokerId: string) {
    try {
      const { data, error } = await supabase
        .from('entity_brokers')
        .select(`
          *,
          entities (
            id,
            entity_id,
            name
          )
        `)
        .eq('broker_id', brokerId)
        .eq('is_active', true);

      if (error) throw error;
      setBrokerEntities(data || []);
    } catch (error) {
      console.error('Error fetching broker entities:', error);
    }
  }

  function handleOpenModal(broker?: Broker) {
    if (broker) {
      setEditingBroker(broker);
      setFormData({
        broker_name: broker.broker_name,
        contact_person_name: broker.contact_person_name || '',
        contact_person_email: broker.contact_person_email || '',
        contact_person_phone: broker.contact_person_phone || '',
        contact_person_mobile: broker.contact_person_mobile || '',
        contact_person_designation: broker.contact_person_designation || '',
        is_active: broker.is_active
      });
    } else {
      setEditingBroker(null);
      setFormData({
        broker_name: '',
        contact_person_name: '',
        contact_person_email: '',
        contact_person_phone: '',
        contact_person_mobile: '',
        contact_person_designation: '',
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
      contact_person_name: '',
      contact_person_email: '',
      contact_person_phone: '',
      contact_person_mobile: '',
      contact_person_designation: '',
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
            contact_person_name: formData.contact_person_name || null,
            contact_person_email: formData.contact_person_email || null,
            contact_person_phone: formData.contact_person_phone || null,
            contact_person_mobile: formData.contact_person_mobile || null,
            contact_person_designation: formData.contact_person_designation || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingBroker.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('brokers')
          .insert([{
            broker_name: formData.broker_name,
            contact_person_name: formData.contact_person_name || null,
            contact_person_email: formData.contact_person_email || null,
            contact_person_phone: formData.contact_person_phone || null,
            contact_person_mobile: formData.contact_person_mobile || null,
            contact_person_designation: formData.contact_person_designation || null,
            is_active: formData.is_active
          }]);

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

  function handleOpenEntityModal(brokerId: string, brokerName: string) {
    setSelectedBrokerId(brokerId);
    setSelectedBrokerName(brokerName);
    fetchBrokerEntities(brokerId);
    setShowEntityModal(true);
  }

  function handleCloseEntityModal() {
    setShowEntityModal(false);
    setSelectedBrokerId(null);
    setSelectedBrokerName('');
    setBrokerEntities([]);
    setEntityFormData({
      entity_id: '',
      relationship_type: 'Primary Broker',
      assigned_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
  }

  async function handleAssignEntity(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBrokerId) return;

    try {
      const { error } = await supabase.from('entity_brokers').insert({
        broker_id: selectedBrokerId,
        entity_id: entityFormData.entity_id,
        relationship_type: entityFormData.relationship_type,
        assigned_date: entityFormData.assigned_date,
        notes: entityFormData.notes || null,
        is_active: true
      });

      if (error) throw error;

      await fetchBrokerEntities(selectedBrokerId);
      setEntityFormData({
        entity_id: '',
        relationship_type: 'Primary Broker',
        assigned_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      alert('Entity assigned successfully!');
    } catch (error: any) {
      console.error('Error assigning entity:', error);
      if (error.code === '23505') {
        alert('This entity is already assigned to this broker.');
      } else {
        alert('Failed to assign entity. Please try again.');
      }
    }
  }

  async function handleRemoveEntity(relationshipId: string) {
    if (!confirm('Are you sure you want to remove this entity relationship?')) return;

    try {
      const { error } = await supabase
        .from('entity_brokers')
        .delete()
        .eq('id', relationshipId);

      if (error) throw error;

      if (selectedBrokerId) {
        await fetchBrokerEntities(selectedBrokerId);
      }
      alert('Entity relationship removed successfully!');
    } catch (error) {
      console.error('Error removing entity:', error);
      alert('Failed to remove entity relationship.');
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Person</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBrokers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
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
                      <td className="px-6 py-4">
                        {broker.contact_person_name ? (
                          <div className="text-sm">
                            <div className="font-semibold text-gray-900">{broker.contact_person_name}</div>
                            {broker.contact_person_designation && (
                              <div className="text-xs text-gray-500">{broker.contact_person_designation}</div>
                            )}
                            {broker.contact_person_email && (
                              <div className="text-xs text-blue-600">{broker.contact_person_email}</div>
                            )}
                            {(broker.contact_person_phone || broker.contact_person_mobile) && (
                              <div className="text-xs text-gray-500">
                                {broker.contact_person_phone || broker.contact_person_mobile}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">No contact person</div>
                        )}
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
                            onClick={() => handleOpenEntityModal(broker.id, broker.broker_name)}
                            className="p-1 hover:bg-blue-50 rounded transition-colors"
                            title="Manage Entities"
                          >
                            <Users className="w-4 h-4 text-blue-600" />
                          </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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

              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Person Details</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Person Name</label>
                    <input
                      type="text"
                      value={formData.contact_person_name}
                      onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter contact person name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Designation</label>
                    <input
                      type="text"
                      value={formData.contact_person_designation}
                      onChange={(e) => setFormData({ ...formData, contact_person_designation: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Senior Manager, Account Manager"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={formData.contact_person_email}
                        onChange={(e) => setFormData({ ...formData, contact_person_email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="email@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={formData.contact_person_phone}
                        onChange={(e) => setFormData({ ...formData, contact_person_phone: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="+94 11 234 5678"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile</label>
                    <input
                      type="tel"
                      value={formData.contact_person_mobile}
                      onChange={(e) => setFormData({ ...formData, contact_person_mobile: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+94 77 123 4567"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center pt-4 border-t border-gray-200">
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

      {showEntityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Manage Entities</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedBrokerName}</p>
                </div>
                <button
                  onClick={handleCloseEntityModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <form onSubmit={handleAssignEntity} className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900">Assign New Entity</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entity *</label>
                    <select
                      required
                      value={entityFormData.entity_id}
                      onChange={(e) => setEntityFormData({...entityFormData, entity_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select an entity</option>
                      {entities.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name} {entity.entity_id && `(${entity.entity_id})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Relationship Type *</label>
                    <select
                      required
                      value={entityFormData.relationship_type}
                      onChange={(e) => setEntityFormData({...entityFormData, relationship_type: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Primary Broker">Primary Broker</option>
                      <option value="Secondary Broker">Secondary Broker</option>
                      <option value="Custodian">Custodian</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned Date *</label>
                    <input
                      type="date"
                      required
                      value={entityFormData.assigned_date}
                      onChange={(e) => setEntityFormData({...entityFormData, assigned_date: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                    <input
                      type="text"
                      value={entityFormData.notes}
                      onChange={(e) => setEntityFormData({...entityFormData, notes: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Assign Entity</span>
                  </button>
                </div>
              </form>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Entities</h3>
                {brokerEntities.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No entities assigned yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {brokerEntities.map((be) => (
                      <div key={be.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <Users className="w-5 h-5 text-blue-600" />
                            <div>
                              <div className="font-semibold text-gray-900">{be.entities.name}</div>
                              <div className="text-sm text-gray-500">ID: {be.entities.entity_id || 'N/A'}</div>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              {be.relationship_type}
                            </span>
                            <span>Assigned: {be.assigned_date}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveEntity(be.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end sticky bottom-0 bg-white">
              <button
                onClick={handleCloseEntityModal}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
