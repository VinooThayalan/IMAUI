import { Plus, Search, Trash2, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface IpoTransaction {
  id: string;
  entity_id: string;
  share_id: string;
  transaction_date: string;
  no_of_shares: number;
  price_per_share: number;
  total_amount: number;
  fees?: number;
  broker_id?: string;
  cds_account_id?: string;
  bank_id?: string;
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

export function IpoTransactions() {
  const [showForm, setShowForm] = useState(false);
  const [transactions, setTransactions] = useState<IpoTransaction[]>([]);
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
    transaction_date: new Date().toISOString().split('T')[0],
    no_of_shares: '',
    price_per_share: '',
    fees: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [transactionsRes, entitiesRes, sharesRes, entityBrokersRes, brokersRes, banksRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('transaction_type', 'IPO')
          .order('transaction_date', { ascending: false }),
        supabase.from('entities').select('id, name').order('name'),
        supabase.from('shares').select('id, share_name, ticker').order('share_name'),
        supabase.from('entity_brokers').select('*'),
        supabase.from('brokers').select('id, broker_name').order('broker_name'),
        supabase.from('banks').select('id, name, account_number, balance').order('name')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      if (entityBrokersRes.error) throw entityBrokersRes.error;
      if (brokersRes.error) throw brokersRes.error;
      if (banksRes.error) throw banksRes.error;

      const parsedTransactions = (transactionsRes.data || []).map(txn => ({
        ...txn,
        no_of_shares: Number(txn.no_of_shares) || 0,
        price_per_share: Number(txn.price_per_share) || 0,
        total_amount: Number(txn.total_amount) || 0,
        fees: Number(txn.fees) || 0
      }));

      setTransactions(parsedTransactions);
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
      transaction_date: new Date().toISOString().split('T')[0],
      no_of_shares: '',
      price_per_share: '',
      fees: '',
      notes: ''
    });
  }

  function calculateTotalAmount() {
    const shares = parseFloat(formData.no_of_shares) || 0;
    const price = parseFloat(formData.price_per_share) || 0;
    const fees = parseFloat(formData.fees) || 0;
    return (shares * price) + fees;
  }

  async function handleCreateTransaction(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.entity_id || !formData.share_id || !formData.no_of_shares || !formData.price_per_share || !formData.entity_broker_id) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const totalAmount = calculateTotalAmount();
      const selectedEB = entityBrokers.find(eb => eb.id === formData.entity_broker_id);

      const { error } = await supabase.from('transactions').insert({
        entity_id: formData.entity_id,
        share_id: formData.share_id,
        transaction_type: 'IPO',
        transaction_date: formData.transaction_date,
        no_of_shares: parseFloat(formData.no_of_shares),
        price_per_share: parseFloat(formData.price_per_share),
        total_amount: totalAmount,
        fees: parseFloat(formData.fees) || 0,
        broker_id: selectedEB?.broker_id,
        cds_account_id: formData.relationship_type === 'Custodian' ? selectedEB?.custodian_account_number : selectedEB?.broker_account_number,
        bank_id: selectedEB?.bank_id
      });

      if (error) throw error;

      alert('IPO transaction created successfully');
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating IPO transaction:', error);
      alert('Failed to create IPO transaction');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this IPO transaction?')) return;

    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);

      if (error) throw error;

      alert('IPO transaction deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting IPO transaction:', error);
      alert('Failed to delete IPO transaction');
    }
  }

  const filteredTransactions = transactions.filter(txn => {
    const entityName = getEntityName(txn.entity_id).toLowerCase();
    const shareInfo = getShareInfo(txn.share_id).toLowerCase();
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
          <h1 className="text-3xl font-bold text-gray-900">IPO Transactions</h1>
          <p className="text-gray-600 mt-1">Manage Initial Public Offering share purchases</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span>{showForm ? 'Cancel' : 'New IPO Transaction'}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">New IPO Transaction</h2>
          <form onSubmit={handleCreateTransaction} className="space-y-4">
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
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Transaction Details</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transaction Type
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium">
                  IPO
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
                  No. of Shares <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={formData.no_of_shares}
                  onChange={(e) => setFormData({ ...formData, no_of_shares: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price Per Share (Rs.) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.price_per_share}
                  onChange={(e) => setFormData({ ...formData, price_per_share: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 50.00"
                  required
                />
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
                <span>{submitting ? 'Creating...' : 'Create IPO Transaction'}</span>
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
              placeholder="Search IPO transactions..."
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Share</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IPO Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fees</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No IPO transactions found. Click "New IPO Transaction" to create one.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transaction.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {getEntityName(transaction.entity_id)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getShareInfo(transaction.share_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.no_of_shares.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      Rs. {Number(transaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      Rs. {Number(transaction.fees).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      Rs. {Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(transaction.id)}
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
