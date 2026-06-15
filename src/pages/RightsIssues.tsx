import { Plus, Search, Trash2, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, fetchRecordForAudit } from '../lib/auditLog';

interface RightsIssue {
  id: string;
  entity_id: string;
  share_id: string;
  broker_id?: string;
  cds_account_id?: string;
  bank_id?: string;
  announcement_date?: string;
  allotment_date?: string;
  rights_ratio?: string;
  rights_issue_price?: number;
  shares_at_announcement?: number;
  allotted_shares?: number;
  additional_requested?: string;
  total_amount?: number;
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

interface EntityBroker {
  id: string;
  entity_id: string;
  broker_id: string;
  relationship_type: string;
  custodian_account_number?: string;
  custodian_account_name?: string;
  broker_account_number?: string;
  broker_text?: string;
  bank_id?: string;
  bank_account_number?: string;
  facility_limit?: number;
  broker_name_id?: string;
}

interface Broker {
  id: string;
  broker_name: string;
}

interface Bank {
  id: string;
  name: string;
  account_number?: string;
  balance?: number;
}

export function RightsIssues() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [rightsIssues, setRightsIssues] = useState<RightsIssue[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [entityBrokers, setEntityBrokers] = useState<EntityBroker[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    entity_id: '',
    relationship_type: 'Broker' as 'Broker' | 'Custodian',
    entity_broker_id: '',
    share_id: '',
    announcement_date: '',
    allotment_date: '',
    rights_ratio: '',
    rights_issue_price: '',
    shares_at_announcement: '',
    allotted_shares: '',
    additional_requested: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [rightsRes, entitiesRes, sharesRes, entityBrokersRes, brokersRes, banksRes] = await Promise.all([
        supabase
          .from('scrip_entries')
          .select('*')
          .eq('transaction_type', 'Rights Issue')
          .order('announcement_date', { ascending: false }),
        supabase.from('entities').select('id, name').order('name'),
        supabase.from('shares').select('id, share_name, ticker').order('share_name'),
        supabase.from('entity_brokers').select('*'),
        supabase.from('brokers').select('id, broker_name').order('broker_name'),
        supabase.from('banks').select('id, name, account_number, balance').order('name')
      ]);

      if (rightsRes.error) throw rightsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      if (entityBrokersRes.error) throw entityBrokersRes.error;
      if (brokersRes.error) throw brokersRes.error;
      if (banksRes.error) throw banksRes.error;

      setRightsIssues(rightsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
      setEntityBrokers(entityBrokersRes.data || []);
      setBrokers(brokersRes.data || []);
      setBanks(banksRes.data || []);
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

  const filteredEntityBrokers = entityBrokers.filter(
    eb => eb.entity_id === formData.entity_id &&
    (formData.relationship_type === 'Custodian' ? eb.relationship_type === 'Custodian' : eb.relationship_type !== 'Custodian')
  );

  const selectedEntityBroker = entityBrokers.find(eb => eb.id === formData.entity_broker_id);
  const selectedBank = selectedEntityBroker?.bank_id ? banks.find(b => b.id === selectedEntityBroker.bank_id) : null;
  const selectedBrokerName = selectedEntityBroker?.broker_name_id ? brokers.find(b => b.id === selectedEntityBroker.broker_name_id) : null;

  function resetForm() {
    setFormData({
      entity_id: '',
      relationship_type: 'Broker',
      entity_broker_id: '',
      share_id: '',
      announcement_date: '',
      allotment_date: '',
      rights_ratio: '',
      rights_issue_price: '',
      shares_at_announcement: '',
      allotted_shares: '',
      additional_requested: '',
      notes: ''
    });
  }

  function calculateTotalShares() {
    const allotted = parseFloat(formData.allotted_shares) || 0;
    const additional = parseFloat(formData.additional_requested) || 0;
    return allotted + additional;
  }

  function calculateTotalAmount() {
    const totalShares = calculateTotalShares();
    const price = parseFloat(formData.rights_issue_price) || 0;
    return totalShares * price;
  }

  async function handleCreateRightsIssue(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.entity_id || !formData.share_id || !formData.entity_broker_id) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const totalAmount = calculateTotalAmount();
      const selectedEB = entityBrokers.find(eb => eb.id === formData.entity_broker_id);

      const payload = {
        entity_id: formData.entity_id,
        share_id: formData.share_id,
        transaction_type: 'Rights Issue',
        broker_id: selectedEB?.broker_id,
        cds_account_id: formData.relationship_type === 'Custodian' ? selectedEB?.custodian_account_number : selectedEB?.broker_account_number,
        bank_id: selectedEB?.bank_id,
        announcement_date: formData.announcement_date || null,
        allotment_date: formData.allotment_date || null,
        rights_ratio: formData.rights_ratio || null,
        rights_issue_price: parseFloat(formData.rights_issue_price) || null,
        shares_at_announcement: parseFloat(formData.shares_at_announcement) || null,
        allotted_shares: parseFloat(formData.allotted_shares) || null,
        additional_requested: formData.additional_requested || null,
        total_amount: totalAmount
      };

      const { data: inserted, error } = await supabase.from('scrip_entries').insert(payload).select('id').maybeSingle();

      if (error) throw error;

      logAudit({ tableName: 'scrip_entries', recordId: inserted?.id || 'new', action: 'CREATE', performedBy: user?.email || 'system', newValues: payload });

      alert('Rights issue created successfully');
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating rights issue:', error);
      alert('Failed to create rights issue');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this rights issue?')) return;

    try {
      const oldRecord = await fetchRecordForAudit('scrip_entries', id);

      const { error } = await supabase.from('scrip_entries').delete().eq('id', id);

      if (error) throw error;

      logAudit({ tableName: 'scrip_entries', recordId: id, action: 'DELETE', performedBy: user?.email || 'system', oldValues: oldRecord });

      alert('Rights issue deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting rights issue:', error);
      alert('Failed to delete rights issue');
    }
  }

  const filteredRightsIssues = rightsIssues.filter(ri => {
    const entityName = getEntityName(ri.entity_id).toLowerCase();
    const shareInfo = getShareInfo(ri.share_id).toLowerCase();
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
          <h1 className="text-3xl font-bold text-gray-900">Rights Issues</h1>
          <p className="text-gray-600 mt-1">Manage rights issue allocations and subscriptions</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span>{showForm ? 'Cancel' : 'New Rights Issue'}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">New Rights Issue</h2>
          <form onSubmit={handleCreateRightsIssue} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entity <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.entity_id}
                  onChange={(e) => setFormData({ ...formData, entity_id: e.target.value, entity_broker_id: '' })}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Broker/Custodian <span className="text-red-600">*</span>
                </label>
                <div className="flex space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="Broker"
                      checked={formData.relationship_type === 'Broker'}
                      onChange={(e) => setFormData({ ...formData, relationship_type: e.target.value as 'Broker' | 'Custodian', entity_broker_id: '' })}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Broker</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="Custodian"
                      checked={formData.relationship_type === 'Custodian'}
                      onChange={(e) => setFormData({ ...formData, relationship_type: e.target.value as 'Broker' | 'Custodian', entity_broker_id: '' })}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Custodian</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.relationship_type === 'Custodian' ? 'CDS Account ID' : 'Broker Account ID'} <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.entity_broker_id}
                  onChange={(e) => setFormData({ ...formData, entity_broker_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={!formData.entity_id}
                >
                  <option value="">Select Account</option>
                  {filteredEntityBrokers.map(eb => (
                    <option key={eb.id} value={eb.id}>
                      {formData.relationship_type === 'Custodian' ? eb.custodian_account_number : eb.broker_account_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Broker Name
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  {selectedBrokerName?.broker_name || selectedEntityBroker?.broker_text || '-'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  {selectedBank?.name || '-'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Number
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  {selectedEntityBroker?.bank_account_number || '-'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Facility Limit
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  {selectedEntityBroker?.facility_limit ? `Rs. ${Number(selectedEntityBroker.facility_limit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Available Balance
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  {selectedBank?.balance !== undefined ? `Rs. ${Number(selectedBank.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                </div>
              </div>

              <div className="col-span-2 border-t border-gray-200 pt-4 mt-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Rights Issue Details</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transaction Type
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium">
                  Rights Issue
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
                  Date of Announcement
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
                  Date of Allotment
                </label>
                <input
                  type="date"
                  value={formData.allotment_date}
                  onChange={(e) => setFormData({ ...formData, allotment_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rights Ratio (e.g., 1:5)
                </label>
                <input
                  type="text"
                  value={formData.rights_ratio}
                  onChange={(e) => setFormData({ ...formData, rights_ratio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 1:5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rights Issue Price (Rs.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rights_issue_price}
                  onChange={(e) => setFormData({ ...formData, rights_issue_price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 25.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No of Shares as at Date of Allotment
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.shares_at_announcement}
                  onChange={(e) => setFormData({ ...formData, shares_at_announcement: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allotted No of Shares
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.allotted_shares}
                  onChange={(e) => setFormData({ ...formData, allotted_shares: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Requested
                </label>
                <input
                  type="text"
                  value={formData.additional_requested}
                  onChange={(e) => setFormData({ ...formData, additional_requested: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 50 or text note"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Shares
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-semibold">
                  {calculateTotalShares().toLocaleString()}
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Amount (Rs.)
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-blue-50 text-blue-900 font-bold text-lg">
                  Rs. {calculateTotalAmount().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
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
                <span>{submitting ? 'Creating...' : 'Create Rights Issue'}</span>
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
              placeholder="Search rights issues..."
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allotment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ratio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allotted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRightsIssues.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No rights issues found. Click "New Rights Issue" to create one.
                  </td>
                </tr>
              ) : (
                filteredRightsIssues.map((ri) => (
                  <tr key={ri.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {getEntityName(ri.entity_id)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getShareInfo(ri.share_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ri.announcement_date ? new Date(ri.announcement_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ri.allotment_date ? new Date(ri.allotment_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ri.rights_ratio || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ri.rights_issue_price ? `Rs. ${Number(ri.rights_issue_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ri.allotted_shares ? Number(ri.allotted_shares).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {ri.total_amount ? `Rs. ${Number(ri.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(ri.id)}
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
