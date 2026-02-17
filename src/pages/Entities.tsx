import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Eye, UserPlus, Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const entities = [
  {
    id: 1,
    entityId: 'E001',
    name: 'Johnson Family Trust',
    type: 'Trust',
    taxId: '***-**-1234',
    totalValue: 'Rs. 5,234,000',
    shares: 12,
    odLimit: 'Rs. 500,000',
    status: 'Active',
    manager: 'Sarah Johnson',
    created: '2023-01-15'
  },
  {
    id: 2,
    entityId: 'E002',
    name: 'Smith Holdings LLC',
    type: 'LLC',
    taxId: '***-**-5678',
    totalValue: 'Rs. 8,456,700',
    shares: 18,
    odLimit: 'Rs. 1,000,000',
    status: 'Active',
    manager: 'Michael Smith',
    created: '2022-11-20'
  },
  {
    id: 3,
    entityId: 'E003',
    name: 'Brown Investment Group',
    type: 'Corporation',
    taxId: '***-**-9012',
    totalValue: 'Rs. 3,876,200',
    shares: 9,
    odLimit: 'Rs. 750,000',
    status: 'Active',
    manager: 'Emily Brown',
    created: '2023-03-08'
  },
  {
    id: 4,
    entityId: 'E004',
    name: 'Davis Capital Partners',
    type: 'Partnership',
    taxId: '***-**-3456',
    totalValue: 'Rs. 6,123,450',
    shares: 15,
    odLimit: 'Rs. 800,000',
    status: 'Active',
    manager: 'Robert Davis',
    created: '2022-09-14'
  },
  {
    id: 5,
    entityId: 'E005',
    name: 'Wilson Retirement Fund',
    type: 'Trust',
    taxId: '***-**-7890',
    totalValue: 'Rs. 2,456,800',
    shares: 7,
    odLimit: 'Rs. 300,000',
    status: 'Inactive',
    manager: 'Jennifer Wilson',
    created: '2023-05-22'
  },
];

interface EntityType {
  id: string;
  name: string;
}

interface Broker {
  id: string;
  broker_id: string;
  broker_name: string;
  is_active: boolean;
}

interface EntityBroker {
  id: string;
  broker_id: string;
  relationship_type: string;
  is_active: boolean;
  assigned_date: string;
  brokers: Broker;
}

export function Entities() {
  const [showModal, setShowModal] = useState(false);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);
  const [selectedEntityName, setSelectedEntityName] = useState<string>('');
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [entityBrokers, setEntityBrokers] = useState<EntityBroker[]>([]);
  const [brokerFormData, setBrokerFormData] = useState({
    broker_id: '',
    relationship_type: 'Primary Broker',
    assigned_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    fetchEntityTypes();
    fetchBrokers();
  }, []);

  async function fetchEntityTypes() {
    try {
      const { data, error } = await supabase
        .from('entity_types')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setEntityTypes(data || []);
    } catch (error) {
      console.error('Error fetching entity types:', error);
    }
  }

  async function fetchBrokers() {
    try {
      const { data, error } = await supabase
        .from('brokers')
        .select('*')
        .eq('is_active', true)
        .order('broker_name');

      if (error) throw error;
      setBrokers(data || []);
    } catch (error) {
      console.error('Error fetching brokers:', error);
    }
  }

  async function fetchEntityBrokers(entityId: number) {
    try {
      const { data, error } = await supabase
        .from('entity_brokers')
        .select(`
          *,
          brokers (
            id,
            broker_id,
            broker_name,
            is_active
          )
        `)
        .eq('entity_id', entityId)
        .eq('is_active', true);

      if (error) throw error;
      setEntityBrokers(data || []);
    } catch (error) {
      console.error('Error fetching entity brokers:', error);
    }
  }

  function handleOpenBrokerModal(entityId: number, entityName: string) {
    setSelectedEntityId(entityId);
    setSelectedEntityName(entityName);
    fetchEntityBrokers(entityId);
    setShowBrokerModal(true);
  }

  function handleCloseBrokerModal() {
    setShowBrokerModal(false);
    setSelectedEntityId(null);
    setSelectedEntityName('');
    setEntityBrokers([]);
    setBrokerFormData({
      broker_id: '',
      relationship_type: 'Primary Broker',
      assigned_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
  }

  async function handleAssignBroker(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEntityId) return;

    try {
      const { error } = await supabase.from('entity_brokers').insert({
        entity_id: selectedEntityId,
        broker_id: brokerFormData.broker_id,
        relationship_type: brokerFormData.relationship_type,
        assigned_date: brokerFormData.assigned_date,
        notes: brokerFormData.notes || null,
        is_active: true
      });

      if (error) throw error;

      await fetchEntityBrokers(selectedEntityId);
      setBrokerFormData({
        broker_id: '',
        relationship_type: 'Primary Broker',
        assigned_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      alert('Broker assigned successfully!');
    } catch (error: any) {
      console.error('Error assigning broker:', error);
      if (error.code === '23505') {
        alert('This broker is already assigned to this entity.');
      } else {
        alert('Failed to assign broker. Please try again.');
      }
    }
  }

  async function handleRemoveBroker(relationshipId: string) {
    if (!confirm('Are you sure you want to remove this broker relationship?')) return;

    try {
      const { error } = await supabase
        .from('entity_brokers')
        .delete()
        .eq('id', relationshipId);

      if (error) throw error;

      if (selectedEntityId) {
        await fetchEntityBrokers(selectedEntityId);
      }
      alert('Broker relationship removed successfully!');
    } catch (error) {
      console.error('Error removing broker:', error);
      alert('Failed to remove broker relationship.');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Entities</h1>
          <p className="text-gray-500 mt-1">Manage investor entities and their information</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Entity</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search entities..."
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Key Contact</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Value</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entities.map((entity) => (
                <tr key={entity.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-blue-600">{entity.entityId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-bold text-gray-900">{entity.name}</div>
                      <div className="text-xs text-gray-500">{entity.taxId}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                      {entity.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entity.manager}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{entity.totalValue}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      entity.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {entity.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenBrokerModal(entity.id, entity.name)}
                        className="p-1 hover:bg-blue-50 rounded transition-colors"
                        title="Manage Brokers"
                      >
                        <Building2 className="w-4 h-4 text-blue-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="View">
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="Edit">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="More">
                        <MoreVertical className="w-4 h-4 text-gray-600" />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add New Entity</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Entity Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter entity name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Entity Type</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select entity type</option>
                    {entityTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tax Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter tax name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">NIC / PV Number</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter NIC or PV number"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Key Contact Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter key contact name"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Company / Individual Address</label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter complete address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Email (Company / Individual)</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Phone</label>
                  <input
                    type="tel"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Mobile Number 1</label>
                  <input
                    type="tel"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+94 77 123 4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Mobile Number 2</label>
                  <input
                    type="tel"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+94 77 123 4567"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Create Entity
              </button>
            </div>
          </div>
        </div>
      )}

      {showBrokerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Manage Brokers</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedEntityName}</p>
                </div>
                <button
                  onClick={handleCloseBrokerModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <form onSubmit={handleAssignBroker} className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900">Assign New Broker</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Broker *</label>
                    <select
                      required
                      value={brokerFormData.broker_id}
                      onChange={(e) => setBrokerFormData({...brokerFormData, broker_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a broker</option>
                      {brokers.map((broker) => (
                        <option key={broker.id} value={broker.id}>
                          {broker.broker_name} ({broker.broker_id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Relationship Type *</label>
                    <select
                      required
                      value={brokerFormData.relationship_type}
                      onChange={(e) => setBrokerFormData({...brokerFormData, relationship_type: e.target.value})}
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
                      value={brokerFormData.assigned_date}
                      onChange={(e) => setBrokerFormData({...brokerFormData, assigned_date: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                    <input
                      type="text"
                      value={brokerFormData.notes}
                      onChange={(e) => setBrokerFormData({...brokerFormData, notes: e.target.value})}
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
                    <span>Assign Broker</span>
                  </button>
                </div>
              </form>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Brokers</h3>
                {entityBrokers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No brokers assigned yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entityBrokers.map((eb) => (
                      <div key={eb.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <Building2 className="w-5 h-5 text-blue-600" />
                            <div>
                              <div className="font-semibold text-gray-900">{eb.brokers.broker_name}</div>
                              <div className="text-sm text-gray-500">ID: {eb.brokers.broker_id}</div>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              {eb.relationship_type}
                            </span>
                            <span>Assigned: {eb.assigned_date}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveBroker(eb.id)}
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
                onClick={handleCloseBrokerModal}
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
