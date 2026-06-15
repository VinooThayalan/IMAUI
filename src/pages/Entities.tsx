import { Plus, Search, Filter, CreditCard as Edit, Trash2, Eye, UserPlus, Building2, X, Pencil } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, fetchRecordForAudit } from '../lib/auditLog';

interface Entity {
  id: string;
  entity_id: string;
  name: string;
  entity_type_id: string | null;
  tax_name: string | null;
  nic_company_id: string | null;
  key_contact_name: string | null;
  company_individual_address: string | null;
  contact_email_company_individual: string | null;
  cc_email: string | null;
  contact_phone: string | null;
  contact_mobile: string | null;
  contact_mobile_number_2: string | null;
  current_balance: number;
  created_at: string;
  entity_types: {
    name: string;
  } | null;
}

interface EntityType {
  id: string;
  name: string;
}

interface BankMasterItem {
  id: string;
  bank_name: string;
  bank_code: string | null;
}

interface BankBranchItem {
  id: string;
  bank_master_id: string;
  branch_name: string;
}

interface Broker {
  id: string;
  broker_id: string;
  broker_name: string;
  is_active: boolean;
  settlement_bank_account: string | null;
}

interface Currency {
  id: string;
  currency_id: string;
  currency_symbol: string;
  currency_name: string;
  is_active: boolean;
}

interface EntityBroker {
  id: string;
  broker_id: string;
  relationship_type: string;
  is_active: boolean;
  assigned_date: string;
  custodian_account_number?: string;
  custodian_account_name?: string;
  custodian_account_fee?: number;
  broker_account_number?: string;
  bank_account_number?: string;
  bank_name?: string;
  currency?: string;
  broker_text?: string;
  brokers: Broker;
  broker_name?: Broker;
}

export function Entities() {
  const { user, refreshPermissions } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [editingBrokerId, setEditingBrokerId] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedEntityName, setSelectedEntityName] = useState<string>('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [bankMasters, setBankMasters] = useState<BankMasterItem[]>([]);
  const [bankBranches, setBankBranches] = useState<BankBranchItem[]>([]);
  const [entityBrokers, setEntityBrokers] = useState<EntityBroker[]>([]);
  const [entityFormData, setEntityFormData] = useState({
    name: '',
    entity_type_id: '',
    tax_name: '',
    nic_company_id: '',
    key_contact_name: '',
    company_individual_address: '',
    contact_email_company_individual: '',
    cc_email: '',
    contact_phone: '',
    contact_mobile: '',
    contact_mobile_number_2: ''
  });
  const [brokerFormData, setBrokerFormData] = useState({
    broker_id: '',
    relationship_type: 'Custodian',
    assigned_date: new Date().toISOString().split('T')[0],
    notes: '',
    custodian_account_number: '',
    custodian_account_name: '',
    custodian_account_fee: '',
    broker_account_number: '',
    bank_name: '',
    bank_master_id: '',
    bank_branch_id: '',
    currency: 'LKR',
    bank_account_number: '',
    facility_limit: '',
    broker_name_id: '',
    broker_text: ''
  });

  useEffect(() => {
    fetchEntities();
    fetchEntityTypes();
    fetchBrokers();
    fetchCurrencies();
    fetchBankMasters();
    fetchBankBranches();
  }, []);

  async function fetchEntities() {
    try {
      const { data, error } = await supabase
        .from('entities')
        .select(`
          *,
          entity_types (
            name
          )
        `)
        .order('entity_id');

      if (error) throw error;
      setEntities(data || []);
    } catch (error) {
      console.error('Error fetching entities:', error);
    }
  }

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
        .select('id, broker_id, broker_name, is_active, settlement_bank_account')
        .eq('is_active', true)
        .order('broker_name');

      if (error) throw error;
      setBrokers(data || []);
    } catch (error) {
      console.error('Error fetching brokers:', error);
    }
  }

  async function fetchCurrencies() {
    try {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .eq('is_active', true)
        .order('currency_name');

      if (error) throw error;
      setCurrencies(data || []);
    } catch (error) {
      console.error('Error fetching currencies:', error);
    }
  }

  async function fetchBankMasters() {
    try {
      const { data, error } = await supabase
        .from('bank_master')
        .select('id, bank_name, bank_code')
        .eq('is_active', true)
        .order('bank_name');
      if (error) throw error;
      setBankMasters(data || []);
    } catch (error) {
      console.error('Error fetching bank masters:', error);
    }
  }

  async function fetchBankBranches() {
    try {
      const { data, error } = await supabase
        .from('bank_branches')
        .select('id, bank_master_id, branch_name')
        .eq('is_active', true)
        .order('branch_name');
      if (error) throw error;
      setBankBranches(data || []);
    } catch (error) {
      console.error('Error fetching bank branches:', error);
    }
  }

  async function fetchEntityBrokers(entityId: string) {
    try {
      const { data, error } = await supabase
        .from('entity_brokers')
        .select(`
          *,
          brokers:broker_id (
            id,
            broker_id,
            broker_name,
            is_active,
            settlement_bank_account
          ),
          broker_name:broker_name_id (
            id,
            broker_id,
            broker_name
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

  function handleOpenBrokerModal(entityId: string, entityName: string) {
    setSelectedEntityId(entityId);
    setSelectedEntityName(entityName);
    fetchEntityBrokers(entityId);
    setShowBrokerModal(true);
  }

  function handleViewEntity(entity: Entity) {
    setSelectedEntity(entity);
    setShowViewModal(true);
  }

  function handleEditEntity(entity: Entity) {
    setSelectedEntity(entity);
    setEntityFormData({
      name: entity.name,
      entity_type_id: entity.entity_type_id || '',
      tax_name: entity.tax_name || '',
      nic_company_id: entity.nic_company_id || '',
      key_contact_name: entity.key_contact_name || '',
      company_individual_address: entity.company_individual_address || '',
      contact_email_company_individual: entity.contact_email_company_individual || '',
      cc_email: entity.cc_email || '',
      contact_phone: entity.contact_phone || '',
      contact_mobile: entity.contact_mobile || '',
      contact_mobile_number_2: entity.contact_mobile_number_2 || ''
    });
    setShowEditModal(true);
  }

  function handleEditBroker(eb: EntityBroker) {
    setEditingBrokerId(eb.id);
    setBrokerFormData({
      broker_id: eb.broker_id || '',
      relationship_type: eb.relationship_type,
      assigned_date: eb.assigned_date || new Date().toISOString().split('T')[0],
      notes: (eb as any).notes || '',
      custodian_account_number: eb.custodian_account_number || '',
      custodian_account_name: eb.custodian_account_name || '',
      custodian_account_fee: eb.custodian_account_fee != null ? String(eb.custodian_account_fee) : '',
      broker_account_number: eb.broker_account_number || '',
      bank_name: eb.bank_name || '',
      bank_master_id: '',
      bank_branch_id: '',
      currency: eb.currency || 'LKR',
      bank_account_number: eb.bank_account_number || '',
      facility_limit: '',
      broker_name_id: '',
      broker_text: eb.broker_text || ''
    });
    const target = document.getElementById('broker-form-top');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleCancelEditBroker() {
    setEditingBrokerId(null);
    setBrokerFormData({
      broker_id: '',
      relationship_type: 'Custodian',
      assigned_date: new Date().toISOString().split('T')[0],
      notes: '',
      custodian_account_number: '',
      custodian_account_name: '',
      custodian_account_fee: '',
      broker_account_number: '',
      bank_name: '',
      bank_master_id: '',
      bank_branch_id: '',
      currency: 'LKR',
      bank_account_number: '',
      facility_limit: '',
      broker_name_id: '',
      broker_text: ''
    });
  }

  function handleCloseBrokerModal() {
    setShowBrokerModal(false);
    setSelectedEntityId(null);
    setSelectedEntityName('');
    setEntityBrokers([]);
    setEditingBrokerId(null);
    setBrokerFormData({
      broker_id: '',
      relationship_type: 'Custodian',
      assigned_date: new Date().toISOString().split('T')[0],
      notes: '',
      custodian_account_number: '',
      custodian_account_name: '',
      custodian_account_fee: '',
      broker_account_number: '',
      bank_name: '',
      bank_master_id: '',
      bank_branch_id: '',
      currency: 'LKR',
      bank_account_number: '',
      facility_limit: '',
      broker_name_id: '',
      broker_text: ''
    });
  }

  function handleBrokerSelect(brokerId: string) {
    const selected = brokers.find(b => b.id === brokerId);
    setBrokerFormData(prev => ({
      ...prev,
      broker_id: brokerId,
      bank_name: selected?.settlement_bank_account || '',
      bank_master_id: '',
      bank_branch_id: ''
    }));
  }

  function handleBankMasterSelect(bankMasterId: string) {
    const selected = bankMasters.find(b => b.id === bankMasterId);
    setBrokerFormData(prev => ({
      ...prev,
      bank_master_id: bankMasterId,
      bank_branch_id: '',
      bank_name: selected?.bank_name || ''
    }));
  }

  async function handleAssignBroker(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEntityId) return;

    try {
      const insertData: any = {
        entity_id: selectedEntityId,
        broker_id: brokerFormData.relationship_type === 'Custodian' ? null : (brokerFormData.broker_id || null),
        relationship_type: brokerFormData.relationship_type,
        assigned_date: brokerFormData.assigned_date,
        notes: brokerFormData.notes || null,
        bank_name: brokerFormData.bank_name || null,
        bank_master_id: brokerFormData.bank_master_id || null,
        bank_branch_id: brokerFormData.bank_branch_id || null,
        currency: brokerFormData.currency,
        is_active: true
      };

      insertData.bank_account_number = brokerFormData.bank_account_number || null;

      if (brokerFormData.relationship_type === 'Custodian') {
        insertData.custodian_account_number = brokerFormData.custodian_account_number || null;
        insertData.custodian_account_name = brokerFormData.custodian_account_name || null;
        insertData.custodian_account_fee = brokerFormData.custodian_account_fee ? parseFloat(brokerFormData.custodian_account_fee) : null;
      } else {
        insertData.broker_account_number = brokerFormData.broker_account_number || null;
        insertData.broker_text = brokerFormData.broker_text || null;
      }

      let error, data;
      const wasEditing = !!editingBrokerId;
      if (editingBrokerId) {
        const oldRecord = await fetchRecordForAudit('entity_brokers', editingBrokerId);
        ({ error, data } = await supabase.from('entity_brokers').update(insertData).eq('id', editingBrokerId).select('id').maybeSingle());
        if (!error && user) {
          await logAudit({
            userId: user.id,
            action: 'UPDATE',
            tableName: 'entity_brokers',
            recordId: editingBrokerId,
            oldData: oldRecord,
            newData: insertData
          });
        }
      } else {
        ({ error, data } = await supabase.from('entity_brokers').insert(insertData).select('id').maybeSingle());
        if (!error && data && user) {
          await logAudit({
            userId: user.id,
            action: 'CREATE',
            tableName: 'entity_brokers',
            recordId: data.id,
            newData: insertData
          });
        }
      }

      if (error) throw error;

      setEditingBrokerId(null);
      await fetchEntityBrokers(selectedEntityId);
      setBrokerFormData({
        broker_id: '',
        relationship_type: 'Custodian',
        assigned_date: new Date().toISOString().split('T')[0],
        notes: '',
        custodian_account_number: '',
        custodian_account_name: '',
        custodian_account_fee: '',
        broker_account_number: '',
        bank_name: '',
        bank_master_id: '',
        bank_branch_id: '',
        currency: 'LKR',
        bank_account_number: '',
        facility_limit: '',
        broker_name_id: '',
        broker_text: ''
      });
      alert(wasEditing ? 'Broker/Custodian updated successfully!' : 'Broker/Custodian assigned successfully!');
    } catch (error: any) {
      console.error('Error assigning broker:', error);
      if (error.code === '23505') {
        alert('This broker is already assigned to this entity.');
      } else if (error.code === '42501') {
        alert('Permission denied. You do not have access to assign brokers to this entity.');
      } else {
        alert(`Failed to assign broker: ${error.message || 'Please try again.'}`);
      }
    }
  }

  async function handleRemoveBroker(relationshipId: string) {
    if (!confirm('Are you sure you want to remove this relationship?')) return;

    try {
      const oldRecord = await fetchRecordForAudit('entity_brokers', relationshipId);
      const { error } = await supabase
        .from('entity_brokers')
        .delete()
        .eq('id', relationshipId);

      if (error) throw error;

      if (user) {
        await logAudit({
          userId: user.id,
          action: 'DELETE',
          tableName: 'entity_brokers',
          recordId: relationshipId,
          oldData: oldRecord
        });
      }

      if (selectedEntityId) {
        await fetchEntityBrokers(selectedEntityId);
      }
      alert('Relationship removed successfully!');
    } catch (error) {
      console.error('Error removing broker:', error);
      alert('Failed to remove relationship.');
    }
  }

  const isCustodian = brokerFormData.relationship_type === 'Custodian';

  async function handleCreateEntity(e: React.FormEvent) {
    e.preventDefault();

    if (!entityFormData.name || !entityFormData.entity_type_id) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const newId = crypto.randomUUID();
      const newEntityData = {
        id: newId,
        name: entityFormData.name,
        entity_type_id: entityFormData.entity_type_id || null,
        tax_name: entityFormData.tax_name || null,
        nic_company_id: entityFormData.nic_company_id || null,
        key_contact_name: entityFormData.key_contact_name || null,
        company_individual_address: entityFormData.company_individual_address || null,
        contact_email_company_individual: entityFormData.contact_email_company_individual || null,
        cc_email: entityFormData.cc_email || null,
        contact_phone: entityFormData.contact_phone || null,
        contact_mobile: entityFormData.contact_mobile || null,
        contact_mobile_number_2: entityFormData.contact_mobile_number_2 || null,
        current_balance: 0
      };
      const { error } = await supabase.from('entities').insert(newEntityData);

      if (error) throw error;

      if (user) {
        await logAudit({
          userId: user.id,
          action: 'CREATE',
          tableName: 'entities',
          recordId: newId,
          newData: newEntityData
        });
        await supabase.from('user_entity_access').insert({
          user_id: user.id,
          entity_id: newId
        });
        await refreshPermissions();
      }

      alert('Entity created successfully!');
      setShowModal(false);
      setEntityFormData({
        name: '',
        entity_type_id: '',
        tax_name: '',
        nic_company_id: '',
        key_contact_name: '',
        company_individual_address: '',
        contact_email_company_individual: '',
        cc_email: '',
        contact_phone: '',
        contact_mobile: '',
        contact_mobile_number_2: ''
      });
      await fetchEntities();
    } catch (error) {
      console.error('Error creating entity:', error);
      alert('Failed to create entity. Please try again.');
    }
  }

  async function handleUpdateEntity(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedEntity || !entityFormData.name || !entityFormData.entity_type_id) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const oldRecord = await fetchRecordForAudit('entities', selectedEntity.id);
      const newData = {
        name: entityFormData.name,
        entity_type_id: entityFormData.entity_type_id || null,
        tax_name: entityFormData.tax_name || null,
        nic_company_id: entityFormData.nic_company_id || null,
        key_contact_name: entityFormData.key_contact_name || null,
        company_individual_address: entityFormData.company_individual_address || null,
        contact_email_company_individual: entityFormData.contact_email_company_individual || null,
        cc_email: entityFormData.cc_email || null,
        contact_phone: entityFormData.contact_phone || null,
        contact_mobile: entityFormData.contact_mobile || null,
        contact_mobile_number_2: entityFormData.contact_mobile_number_2 || null
      };
      const { error } = await supabase
        .from('entities')
        .update(newData)
        .eq('id', selectedEntity.id);

      if (error) throw error;

      if (user) {
        await logAudit({
          userId: user.id,
          action: 'UPDATE',
          tableName: 'entities',
          recordId: selectedEntity.id,
          oldData: oldRecord,
          newData: newData
        });
      }

      alert('Entity updated successfully!');
      setShowEditModal(false);
      setSelectedEntity(null);
      setEntityFormData({
        name: '',
        entity_type_id: '',
        tax_name: '',
        nic_company_id: '',
        key_contact_name: '',
        company_individual_address: '',
        contact_email_company_individual: '',
        cc_email: '',
        contact_phone: '',
        contact_mobile: '',
        contact_mobile_number_2: ''
      });
      await fetchEntities();
    } catch (error) {
      console.error('Error updating entity:', error);
      alert('Failed to update entity. Please try again.');
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No entities found. Click "Add Entity" to create one.
                  </td>
                </tr>
              ) : (
                entities.map((entity) => (
                  <tr key={entity.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-blue-600">{entity.entity_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{entity.name}</div>
                        <div className="text-xs text-gray-500">{entity.tax_name || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                        {entity.entity_types?.name || 'Not Set'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entity.key_contact_name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleOpenBrokerModal(entity.id, entity.name)}
                          className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                          title="Broker/Custodian"
                        >
                          Broker/Custodian
                        </button>
                        <button
                          onClick={() => handleViewEntity(entity)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleEditEntity(entity)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-gray-600" />
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
              <h2 className="text-2xl font-bold text-gray-900">Add New Entity</h2>
              <p className="text-sm text-gray-500 mt-1">Entity ID will be generated automatically</p>
            </div>
            <form onSubmit={handleCreateEntity}>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entity Name *</label>
                    <input
                      type="text"
                      required
                      value={entityFormData.name}
                      onChange={(e) => setEntityFormData({...entityFormData, name: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter entity name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entity Type *</label>
                    <select
                      required
                      value={entityFormData.entity_type_id}
                      onChange={(e) => setEntityFormData({...entityFormData, entity_type_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select entity type</option>
                      {entityTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">TIN Number</label>
                    <input
                      type="text"
                      value={entityFormData.tax_name}
                      onChange={(e) => setEntityFormData({...entityFormData, tax_name: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter TIN number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Company Reg ID / NIC</label>
                    <input
                      type="text"
                      value={entityFormData.nic_company_id}
                      onChange={(e) => setEntityFormData({...entityFormData, nic_company_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter Company Reg ID / NIC"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Key Contact Name</label>
                    <input
                      type="text"
                      value={entityFormData.key_contact_name}
                      onChange={(e) => setEntityFormData({...entityFormData, key_contact_name: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter key contact name"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Company / Individual Address</label>
                    <textarea
                      rows={3}
                      value={entityFormData.company_individual_address}
                      onChange={(e) => setEntityFormData({...entityFormData, company_individual_address: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter complete address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Email (Company / Individual)</label>
                    <input
                      type="email"
                      value={entityFormData.contact_email_company_individual}
                      onChange={(e) => setEntityFormData({...entityFormData, contact_email_company_individual: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">CC Email <span className="text-xs font-normal text-gray-500">(auto-loaded when sending emails)</span></label>
                    <input
                      type="email"
                      value={entityFormData.cc_email}
                      onChange={(e) => setEntityFormData({...entityFormData, cc_email: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="cc@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Phone</label>
                    <input
                      type="tel"
                      value={entityFormData.contact_phone}
                      onChange={(e) => setEntityFormData({...entityFormData, contact_phone: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Mobile Number 1</label>
                    <input
                      type="tel"
                      value={entityFormData.contact_mobile}
                      onChange={(e) => setEntityFormData({...entityFormData, contact_mobile: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+94 77 123 4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Mobile Number 2</label>
                    <input
                      type="tel"
                      value={entityFormData.contact_mobile_number_2}
                      onChange={(e) => setEntityFormData({...entityFormData, contact_mobile_number_2: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+94 77 123 4567"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Create Entity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBrokerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Manage Brokers & Custodians</h2>
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
              <form id="broker-form-top" onSubmit={handleAssignBroker} className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900">Assign New {isCustodian ? 'Custodian' : 'Broker'} Account</h3>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">CDS Account Type *</label>
                    <select
                      required
                      value={brokerFormData.relationship_type}
                      onChange={(e) => setBrokerFormData({...brokerFormData, relationship_type: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Custodian">Custodian Account</option>
                      <option value="Broker">Broker Account</option>
                    </select>
                  </div>

                  {isCustodian && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Custodian Account Number *</label>
                        <input
                          type="text"
                          required
                          value={brokerFormData.custodian_account_number}
                          onChange={(e) => setBrokerFormData({...brokerFormData, custodian_account_number: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter account number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Custodian Account Name *</label>
                        <input
                          type="text"
                          required
                          value={brokerFormData.custodian_account_name}
                          onChange={(e) => setBrokerFormData({...brokerFormData, custodian_account_name: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter account name"
                        />
                      </div>
                    </>
                  )}

                  {!isCustodian && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Broker Name *</label>
                        <select
                          required
                          value={brokerFormData.broker_id}
                          onChange={(e) => handleBrokerSelect(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select broker</option>
                          {brokers.map((broker) => (
                            <option key={broker.id} value={broker.id}>
                              {broker.broker_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Broker Account Number *</label>
                        <input
                          type="text"
                          required
                          value={brokerFormData.broker_account_number}
                          onChange={(e) => setBrokerFormData({...brokerFormData, broker_account_number: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter broker account number"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Name</label>
                    <select
                      value={brokerFormData.bank_master_id}
                      onChange={(e) => handleBankMasterSelect(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select bank</option>
                      {bankMasters.map(bm => (
                        <option key={bm.id} value={bm.id}>
                          {bm.bank_name}{bm.bank_code ? ` (${bm.bank_code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Branch</label>
                    <select
                      value={brokerFormData.bank_branch_id}
                      onChange={(e) => setBrokerFormData({...brokerFormData, bank_branch_id: e.target.value})}
                      disabled={!brokerFormData.bank_master_id}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">Select branch (optional)</option>
                      {bankBranches
                        .filter(b => b.bank_master_id === brokerFormData.bank_master_id)
                        .map(br => (
                          <option key={br.id} value={br.id}>{br.branch_name}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Currency *</label>
                    <select
                      required
                      value={brokerFormData.currency}
                      onChange={(e) => setBrokerFormData({...brokerFormData, currency: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select currency</option>
                      {currencies.map((currency) => (
                        <option key={currency.id} value={currency.currency_id}>
                          {currency.currency_symbol} - {currency.currency_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Account Number</label>
                    <input
                      type="text"
                      value={brokerFormData.bank_account_number}
                      onChange={(e) => setBrokerFormData({...brokerFormData, bank_account_number: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter bank account number"
                    />
                  </div>

                  {isCustodian && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Custodian Account Fee %</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={brokerFormData.custodian_account_fee}
                        onChange={(e) => setBrokerFormData({...brokerFormData, custodian_account_fee: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter fee percentage"
                      />
                    </div>
                  )}

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

                  <div className="col-span-2">
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

                <div className="flex justify-end space-x-2">
                  {editingBrokerId && (
                    <button
                      type="button"
                      onClick={handleCancelEditBroker}
                      className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel Edit</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingBrokerId ? <Pencil className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    <span>{editingBrokerId ? `Update ${isCustodian ? 'Custodian' : 'Broker'}` : `Assign ${isCustodian ? 'Custodian' : 'Broker'}`}</span>
                  </button>
                </div>
              </form>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Accounts</h3>
                {entityBrokers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No accounts assigned yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entityBrokers.map((eb) => (
                      <div key={eb.id} className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Building2 className="w-5 h-5 text-blue-600" />
                              <div>
                                <div className="font-semibold text-gray-900">
                                  {eb.brokers?.broker_name || eb.custodian_account_name || eb.bank_name || eb.relationship_type}
                                </div>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                  {eb.relationship_type}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 ml-8">
                              {eb.relationship_type === 'Custodian' && (
                                <>
                                  <div><span className="font-medium">Account Number:</span> {eb.custodian_account_number}</div>
                                  <div><span className="font-medium">Account Name:</span> {eb.custodian_account_name}</div>
                                  {eb.custodian_account_fee != null && <div><span className="font-medium">Account Fee:</span> {eb.custodian_account_fee}%</div>}
                                </>
                              )}
                              {eb.relationship_type !== 'Custodian' && eb.broker_account_number && (
                                <div><span className="font-medium">Broker Account:</span> {eb.broker_account_number}</div>
                              )}
                              {eb.bank_account_number && <div><span className="font-medium">Bank Acc No:</span> {eb.bank_account_number}</div>}
                              {eb.bank_name && <div><span className="font-medium">Bank:</span> {eb.bank_name}</div>}
                              {eb.currency && <div><span className="font-medium">Currency:</span> {eb.currency}</div>}
                              <div><span className="font-medium">Assigned:</span> {eb.assigned_date}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleEditBroker(eb)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                              type="button"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveBroker(eb.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove"
                              type="button"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
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

      {showViewModal && selectedEntity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Entity Details</h2>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedEntity(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Entity ID</label>
                  <p className="text-gray-900">{selectedEntity.entity_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Entity Name</label>
                  <p className="text-gray-900">{selectedEntity.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Entity Type</label>
                  <p className="text-gray-900">{selectedEntity.entity_types?.name || 'Not Set'}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">TIN Number</label>
                  <p className="text-gray-900">{selectedEntity.tax_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Company Reg ID / NIC</label>
                  <p className="text-gray-900">{selectedEntity.nic_company_id || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Key Contact Name</label>
                  <p className="text-gray-900">{selectedEntity.key_contact_name || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Address</label>
                  <p className="text-gray-900">{selectedEntity.company_individual_address || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Email</label>
                  <p className="text-gray-900">{selectedEntity.contact_email_company_individual || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">CC Email</label>
                  <p className="text-gray-900">{selectedEntity.cc_email || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Phone</label>
                  <p className="text-gray-900">{selectedEntity.contact_phone || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Mobile 1</label>
                  <p className="text-gray-900">{selectedEntity.contact_mobile || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Mobile 2</label>
                  <p className="text-gray-900">{selectedEntity.contact_mobile_number_2 || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Current Balance</label>
                  <p className="text-gray-900">Rs. {selectedEntity.current_balance?.toLocaleString() || '0.00'}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Status</label>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                    Active
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-500 mb-1">Created Date</label>
                  <p className="text-gray-900">{new Date(selectedEntity.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEditEntity(selectedEntity);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedEntity(null);
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedEntity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Edit Entity</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedEntity(null);
                  setEntityFormData({
                    name: '',
                    entity_type_id: '',
                    tax_name: '',
                    nic_company_id: '',
                    key_contact_name: '',
                    company_individual_address: '',
                    contact_email_company_individual: '',
                    cc_email: '',
                    contact_phone: '',
                    contact_mobile: '',
                    contact_mobile_number_2: ''
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdateEntity}>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entity Name *</label>
                    <input
                      type="text"
                      required
                      value={entityFormData.name}
                      onChange={(e) => setEntityFormData({...entityFormData, name: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter entity name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entity Type *</label>
                    <select
                      required
                      value={entityFormData.entity_type_id}
                      onChange={(e) => setEntityFormData({...entityFormData, entity_type_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select entity type</option>
                      {entityTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">TIN Number</label>
                    <input
                      type="text"
                      value={entityFormData.tax_name}
                      onChange={(e) => setEntityFormData({...entityFormData, tax_name: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter TIN number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Company Reg ID / NIC</label>
                    <input
                      type="text"
                      value={entityFormData.nic_company_id}
                      onChange={(e) => setEntityFormData({...entityFormData, nic_company_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter Company Reg ID / NIC"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Key Contact Name</label>
                    <input
                      type="text"
                      value={entityFormData.key_contact_name}
                      onChange={(e) => setEntityFormData({...entityFormData, key_contact_name: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter key contact name"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Company / Individual Address</label>
                    <textarea
                      rows={3}
                      value={entityFormData.company_individual_address}
                      onChange={(e) => setEntityFormData({...entityFormData, company_individual_address: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter complete address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Email</label>
                    <input
                      type="email"
                      value={entityFormData.contact_email_company_individual}
                      onChange={(e) => setEntityFormData({...entityFormData, contact_email_company_individual: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">CC Email <span className="text-xs font-normal text-gray-500">(auto-loaded when sending emails)</span></label>
                    <input
                      type="email"
                      value={entityFormData.cc_email}
                      onChange={(e) => setEntityFormData({...entityFormData, cc_email: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="cc@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Phone</label>
                    <input
                      type="tel"
                      value={entityFormData.contact_phone}
                      onChange={(e) => setEntityFormData({...entityFormData, contact_phone: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Mobile Number 1</label>
                    <input
                      type="tel"
                      value={entityFormData.contact_mobile}
                      onChange={(e) => setEntityFormData({...entityFormData, contact_mobile: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+94 77 123 4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Mobile Number 2</label>
                    <input
                      type="tel"
                      value={entityFormData.contact_mobile_number_2}
                      onChange={(e) => setEntityFormData({...entityFormData, contact_mobile_number_2: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+94 77 123 4567"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedEntity(null);
                    setEntityFormData({
                      name: '',
                      entity_type_id: '',
                      tax_name: '',
                      nic_company_id: '',
                      key_contact_name: '',
                      company_individual_address: '',
                      contact_email_company_individual: '',
                      contact_phone: '',
                      contact_mobile: '',
                      contact_mobile_number_2: ''
                    });
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Update Entity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
