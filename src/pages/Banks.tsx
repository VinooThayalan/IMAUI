import { Plus, Search, DollarSign, Eye, CreditCard as Edit2, Building2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Bank {
  id: string;
  name: string;
  account_number: string | null;
  balance: number | null;
  currency: string | null;
  entity_id: string | null;
  share_id: string | null;
  facility_limit: number | null;
  interest_rate: number | null;
  charges_per_transaction: number | null;
  is_active: boolean | null;
  entity?: { name: string; entity_id: string } | null;
  share?: { ticker: string } | null;
}

interface Entity {
  id: string;
  name: string;
  entity_id: string;
}

interface Share {
  id: string;
  ticker: string;
  name: string;
}

interface BankFormData {
  entity_id: string;
  name: string;
  account_number: string;
  share_id: string;
  facility_limit: string;
  interest_rate: string;
  charges_per_transaction: string;
}

const defaultForm: BankFormData = {
  entity_id: '',
  name: '',
  account_number: '',
  share_id: '',
  facility_limit: '',
  interest_rate: '',
  charges_per_transaction: ''
};

export function Banks() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<BankFormData>(defaultForm);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [banksRes, entitiesRes, sharesRes] = await Promise.all([
        supabase
          .from('banks')
          .select('*, entity:entities(name, entity_id), share:shares(ticker)')
          .order('name'),
        supabase.from('entities').select('id, name, entity_id').order('name'),
        supabase.from('shares').select('id, ticker, name').order('name')
      ]);

      if (banksRes.error) throw banksRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;

      setBanks((banksRes.data as Bank[]) || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
    } catch (error) {
      console.error('Error loading banks:', error);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingBank(null);
    setFormData(defaultForm);
    setShowModal(true);
  }

  function openEditModal(bank: Bank) {
    setEditingBank(bank);
    setFormData({
      entity_id: bank.entity_id || '',
      name: bank.name,
      account_number: bank.account_number || '',
      share_id: bank.share_id || '',
      facility_limit: bank.facility_limit?.toString() || '',
      interest_rate: bank.interest_rate?.toString() || '',
      charges_per_transaction: bank.charges_per_transaction?.toString() || ''
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingBank(null);
    setFormData(defaultForm);
  }

  async function handleSave() {
    if (!formData.name || !formData.entity_id) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        entity_id: formData.entity_id || null,
        name: formData.name,
        account_number: formData.account_number || null,
        share_id: formData.share_id || null,
        currency: 'LKR',
        facility_limit: formData.facility_limit ? parseFloat(formData.facility_limit) : null,
        interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : null,
        charges_per_transaction: formData.charges_per_transaction ? parseFloat(formData.charges_per_transaction) : null,
        is_active: true
      };

      if (editingBank) {
        const { error } = await supabase.from('banks').update(payload).eq('id', editingBank.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('banks').insert(payload);
        if (error) throw error;
      }

      await loadData();
      closeModal();
    } catch (error) {
      console.error('Error saving bank:', error);
      alert('Failed to save bank account');
    } finally {
      setSaving(false);
    }
  }

  const filteredBanks = banks.filter(b => {
    const q = searchQuery.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.account_number || '').toLowerCase().includes(q) ||
      (b.entity?.name || '').toLowerCase().includes(q) ||
      (b.entity?.entity_id || '').toLowerCase().includes(q) ||
      (b.share?.ticker || '').toLowerCase().includes(q)
    );
  });

  const totalBalance = banks.reduce((sum, b) => sum + (b.balance || 0), 0);
  const activeCount = banks.filter(b => b.is_active !== false).length;
  const entityCount = new Set(banks.map(b => b.entity_id).filter(Boolean)).size;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bank Accounts</h1>
          <p className="text-gray-500 mt-1">Manage bank accounts and cash positions</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Bank Account</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Cash Balance</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                Rs. {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-500 mt-2">Across all accounts</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Accounts</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{activeCount}</p>
              <p className="text-sm text-gray-500 mt-2">All accounts operational</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Entities Connected</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{entityCount}</p>
              <p className="text-sm text-gray-500 mt-2">Unique entities using accounts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search bank accounts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bank Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Account Number</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Facility Limit</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Interest Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Charges/Txn</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBanks.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-gray-500">No bank accounts found</td>
                  </tr>
                ) : (
                  filteredBanks.map(bank => (
                    <tr key={bank.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-blue-600">{bank.entity?.entity_id || '-'}</div>
                        <div className="text-xs text-gray-500">{bank.entity?.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">{bank.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bank.account_number || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-gray-900">{bank.share?.ticker || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {bank.balance != null
                          ? `Rs. ${bank.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {bank.facility_limit != null
                          ? `Rs. ${bank.facility_limit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bank.interest_rate != null ? `${bank.interest_rate}%` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bank.charges_per_transaction != null
                          ? `Rs. ${bank.charges_per_transaction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${bank.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {bank.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openEditModal(bank)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="View">
                            <Eye className="w-4 h-4 text-gray-600" />
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingBank ? 'Edit Bank Account' : 'Add Bank Account'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Entity <span className="text-red-500">*</span></label>
                  <select
                    value={formData.entity_id}
                    onChange={e => setFormData(prev => ({ ...prev, entity_id: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select entity</option>
                    {entities.map(e => (
                      <option key={e.id} value={e.id}>{e.entity_id} - {e.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter bank name"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Account Number</label>
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={e => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter account number"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Share</label>
                  <select
                    value={formData.share_id}
                    onChange={e => setFormData(prev => ({ ...prev, share_id: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select share (optional)</option>
                    {shares.map(s => (
                      <option key={s.id} value={s.id}>{s.ticker} - {s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
                  <input
                    type="text"
                    value="LKR"
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Facility Limit</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.facility_limit}
                    onChange={e => setFormData(prev => ({ ...prev, facility_limit: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter facility limit"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.interest_rate}
                    onChange={e => setFormData(prev => ({ ...prev, interest_rate: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter interest rate"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Charges Per Transaction</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.charges_per_transaction}
                    onChange={e => setFormData(prev => ({ ...prev, charges_per_transaction: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter charges per transaction"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={closeModal}
                className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : editingBank ? 'Update Account' : 'Add Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
