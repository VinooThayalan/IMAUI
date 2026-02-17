import { Plus, Search, Trash2, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ShareBuyback {
  id: string;
  entity_id: string;
  share_id: string;
  broker_id?: string;
  cds_account_id?: string;
  bank_id?: string;
  announcement_date?: string;
  buyback_date?: string;
  buyback_ratio?: string;
  shares_at_buyback?: number;
  shares_accepted?: string;
  additional_shares?: string;
  buyback_rate?: number;
  total_amount?: number;
  created_at: string;
}

interface Entity {
  id: string;
  name: string;
}

interface Share {
  id: string;
  name: string;
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

export function ShareBuybacks() {
  const [showForm, setShowForm] = useState(false);
  const [buybacks, setBuybacks] = useState<ShareBuyback[]>([]);
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
    buyback_date: '',
    buyback_ratio: '',
    shares_at_buyback: '',
    shares_accepted: '',
    additional_shares: '',
    buyback_rate: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [buybacksRes, entitiesRes, sharesRes, entityBrokersRes, brokersRes, banksRes] = await Promise.all([
        supabase
          .from('scrip_entries')
          .select('*')
          .eq('transaction_type', 'Share Buyback')
          .order('announcement_date', { ascending: false }),
        supabase.from('entities').select('id, name').order('name'),
        supabase.from('shares').select('id, name, ticker').order('name'),
        supabase.from('entity_brokers').select('*'),
        supabase.from('brokers').select('id, broker_name').order('broker_name'),
        supabase.from('banks').select('id, name, account_number, balance').order('name')
      ]);

      if (buybacksRes.error) throw buybacksRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      if (entityBrokersRes.error) throw entityBrokersRes.error;
      if (brokersRes.error) throw brokersRes.error;
      if (banksRes.error) throw banksRes.error;

      setBuybacks(buybacksRes.data || []);
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
    return share ? `${share.ticker} - ${share.name}` : 'Unknown';
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
      buyback_date: '',
      buyback_ratio: '',
      shares_at_buyback: '',
      shares_accepted: '',
      additional_shares: '',
      buyback_rate: '',
      notes: ''
    });
  }

  function calculateTotalBuybackShares() {
    const accepted = parseFloat(formData.shares_accepted) || 0;
    const additional = parseFloat(formData.additional_shares) || 0;
    return accepted + additional;
  }

  function calculateTotalAmount() {
    const totalShares = calculateTotalBuybackShares();
    const rate = parseFloat(formData.buyback_rate) || 0;
    return totalShares * rate;
  }

  async function handleCreateBuyback(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.entity_id || !formData.share_id || !formData.entity_broker_id) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const totalAmount = calculateTotalAmount();
      const selectedEB = entityBrokers.find(eb => eb.id === formData.entity_broker_id);

      const { error } = await supabase.from('scrip_entries').insert({
        entity_id: formData.entity_id,
        share_id: formData.share_id,
        transaction_type: 'Share Buyback',
        broker_id: selectedEB?.broker_id,
        cds_account_id: formData.relationship_type === 'Custodian' ? selectedEB?.custodian_account_number : selectedEB?.broker_account_number,
        bank_id: selectedEB?.bank_id,
        announcement_date: formData.announcement_date || null,
        buyback_date: formData.buyback_date || null,
        buyback_ratio: formData.buyback_ratio || null,
        shares_at_buyback: parseFloat(formData.shares_at_buyback) || null,
        shares_accepted: formData.shares_accepted || null,
        additional_shares: formData.additional_shares || null,
        buyback_rate: parseFloat(formData.buyback_rate) || null,
        total_amount: totalAmount
      });

      if (error) throw error;

      alert('Share buyback created successfully');
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating buyback:', error);
      alert('Failed to create buyback');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this buyback?')) return;

    try {
      const { error } = await supabase.from('scrip_entries').delete().eq('id', id);

      if (error) throw error;

      alert('Buyback deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting buyback:', error);
      alert('Failed to delete buyback');
    }
  }

  const filteredBuybacks = buybacks.filter(bb => {
    const entityName = getEntityName(bb.entity_id).toLowerCase();
    const shareInfo = getShareInfo(bb.share_id).toLowerCase();
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
          <h1 className="text-3xl font-bold text-gray-900">Share Buybacks</h1>
          <p className="text-gray-600 mt-1">Manage share buyback programs and tender offers</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span>{showForm ? 'Cancel' : 'New Buyback'}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">New Share Buyback</h2>
          <form onSubmit={handleCreateBuyback} className="space-y-4">
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
                  Available Balance
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  {selectedBank?.balance !== undefined ? `Rs. ${Number(selectedBank.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                </div>
              </div>

              <div className="col-span-2 border-t border-gray-200 pt-4 mt-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Buyback Details</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transaction Type
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium">
                  Share Buyback
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
                      {share.ticker} - {share.name}
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
                  Buyback Date
                </label>
                <input
                  type="date"
                  value={formData.buyback_date}
                  onChange={(e) => setFormData({ ...formData, buyback_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buy Back Rate (e.g., 1:10)
                </label>
                <input
                  type="text"
                  value={formData.buyback_ratio}
                  onChange={(e) => setFormData({ ...formData, buyback_ratio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 1:10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No of Shares as at Buyback Date
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.shares_at_buyback}
                  onChange={(e) => setFormData({ ...formData, shares_at_buyback: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shares Accepted
                </label>
                <input
                  type="text"
                  value={formData.shares_accepted}
                  onChange={(e) => setFormData({ ...formData, shares_accepted: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Shares
                </label>
                <input
                  type="text"
                  value={formData.additional_shares}
                  onChange={(e) => setFormData({ ...formData, additional_shares: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Buy Back Shares
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-semibold">
                  {calculateTotalBuybackShares().toLocaleString()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buyback Rate (Rs. per share)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.buyback_rate}
                  onChange={(e) => setFormData({ ...formData, buyback_rate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 50.00"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Amount (Rs.)
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-green-50 text-green-900 font-bold text-lg">
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
                <span>{submitting ? 'Creating...' : 'Create Buyback'}</span>
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
              placeholder="Search buybacks..."
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buyback Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accepted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buyback Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBuybacks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No buybacks found. Click "New Buyback" to create one.
                  </td>
                </tr>
              ) : (
                filteredBuybacks.map((bb) => (
                  <tr key={bb.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {getEntityName(bb.entity_id)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getShareInfo(bb.share_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {bb.announcement_date ? new Date(bb.announcement_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {bb.buyback_date ? new Date(bb.buyback_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {bb.buyback_ratio || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {bb.shares_accepted || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {bb.buyback_rate ? `Rs. ${Number(bb.buyback_rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {bb.total_amount ? `Rs. ${Number(bb.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(bb.id)}
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
