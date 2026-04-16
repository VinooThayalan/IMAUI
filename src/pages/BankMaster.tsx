import { Plus, Search, Pencil, X, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface BankMasterItem {
  id: string;
  bank_name: string;
  bank_code: string | null;
  is_active: boolean;
  created_at: string;
}

interface BankBranch {
  id: string;
  bank_master_id: string;
  branch_name: string;
  branch_code: string | null;
  is_active: boolean;
}

interface BankFormData {
  bank_name: string;
  bank_code: string;
  is_active: boolean;
}

interface BranchFormData {
  branch_name: string;
  branch_code: string;
  is_active: boolean;
}

const defaultBankForm: BankFormData = { bank_name: '', bank_code: '', is_active: true };
const defaultBranchForm: BranchFormData = { branch_name: '', branch_code: '', is_active: true };

export function BankMaster() {
  const [banks, setBanks] = useState<BankMasterItem[]>([]);
  const [branches, setBranches] = useState<BankBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBankId, setExpandedBankId] = useState<string | null>(null);

  const [showBankModal, setShowBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<BankMasterItem | null>(null);
  const [bankForm, setBankForm] = useState<BankFormData>(defaultBankForm);

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BankBranch | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedBankName, setSelectedBankName] = useState('');
  const [branchForm, setBranchForm] = useState<BranchFormData>(defaultBranchForm);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [banksRes, branchRes] = await Promise.all([
        supabase.from('bank_master').select('*').order('bank_name'),
        supabase.from('bank_branches').select('*').order('branch_name')
      ]);
      if (banksRes.error) throw banksRes.error;
      if (branchRes.error) throw branchRes.error;
      setBanks(banksRes.data || []);
      setBranches(branchRes.data || []);
    } catch (error) {
      console.error('Error loading bank data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openAddBankModal() {
    setEditingBank(null);
    setBankForm(defaultBankForm);
    setShowBankModal(true);
  }

  function openEditBankModal(bank: BankMasterItem) {
    setEditingBank(bank);
    setBankForm({ bank_name: bank.bank_name, bank_code: bank.bank_code || '', is_active: bank.is_active });
    setShowBankModal(true);
  }

  async function handleSaveBank() {
    if (!bankForm.bank_name.trim()) {
      alert('Bank name is required');
      return;
    }
    try {
      setSaving(true);
      const payload = { bank_name: bankForm.bank_name.trim(), bank_code: bankForm.bank_code || null, is_active: bankForm.is_active };
      if (editingBank) {
        const { error } = await supabase.from('bank_master').update(payload).eq('id', editingBank.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bank_master').insert(payload);
        if (error) throw error;
      }
      await loadData();
      setShowBankModal(false);
    } catch (error) {
      console.error('Error saving bank:', error);
      alert('Failed to save bank');
    } finally {
      setSaving(false);
    }
  }

  function openAddBranchModal(bankId: string, bankName: string) {
    setSelectedBankId(bankId);
    setSelectedBankName(bankName);
    setEditingBranch(null);
    setBranchForm(defaultBranchForm);
    setShowBranchModal(true);
  }

  function openEditBranchModal(branch: BankBranch, bankName: string) {
    setSelectedBankId(branch.bank_master_id);
    setSelectedBankName(bankName);
    setEditingBranch(branch);
    setBranchForm({ branch_name: branch.branch_name, branch_code: branch.branch_code || '', is_active: branch.is_active });
    setShowBranchModal(true);
  }

  async function handleSaveBranch() {
    if (!branchForm.branch_name.trim() || !selectedBankId) {
      alert('Branch name is required');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        bank_master_id: selectedBankId,
        branch_name: branchForm.branch_name.trim(),
        branch_code: branchForm.branch_code || null,
        is_active: branchForm.is_active
      };
      if (editingBranch) {
        const { error } = await supabase.from('bank_branches').update(payload).eq('id', editingBranch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bank_branches').insert(payload);
        if (error) throw error;
      }
      await loadData();
      setShowBranchModal(false);
    } catch (error) {
      console.error('Error saving branch:', error);
      alert('Failed to save branch');
    } finally {
      setSaving(false);
    }
  }

  const filteredBanks = banks.filter(b => {
    const q = searchQuery.toLowerCase();
    return b.bank_name.toLowerCase().includes(q) || (b.bank_code || '').toLowerCase().includes(q);
  });

  const getBranches = (bankId: string) => branches.filter(b => b.bank_master_id === bankId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Banks</h1>
          <p className="text-gray-500 mt-1">Manage bank master list and branch network</p>
        </div>
        <button
          onClick={openAddBankModal}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Bank</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Total Banks</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{banks.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Active Banks</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{banks.filter(b => b.is_active).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Total Branches</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{branches.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search banks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredBanks.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No banks found</div>
            ) : (
              filteredBanks.map(bank => {
                const bankBranches = getBranches(bank.id);
                const isExpanded = expandedBankId === bank.id;
                return (
                  <div key={bank.id}>
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setExpandedBankId(isExpanded ? null : bank.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{bank.bank_name}</div>
                          {bank.bank_code && <div className="text-xs text-gray-500">Code: {bank.bank_code}</div>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-xs text-gray-500">{bankBranches.length} branch{bankBranches.length !== 1 ? 'es' : ''}</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${bank.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {bank.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => openEditBankModal(bank)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          title="Edit bank"
                        >
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => openAddBranchModal(bank.id, bank.bank_name)}
                          className="flex items-center space-x-1 px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Branch</span>
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-gray-50 border-t border-gray-100">
                        {bankBranches.length === 0 ? (
                          <div className="px-16 py-4 text-sm text-gray-400">No branches configured for this bank.</div>
                        ) : (
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="px-16 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Branch Name</th>
                                <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Branch Code</th>
                                <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {bankBranches.map(branch => (
                                <tr key={branch.id} className="hover:bg-white">
                                  <td className="px-16 py-3 text-sm font-medium text-gray-900">{branch.branch_name}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{branch.branch_code || '-'}</td>
                                  <td className="px-6 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${branch.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                      {branch.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3">
                                    <button
                                      onClick={() => openEditBranchModal(branch, bank.bank_name)}
                                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                                      title="Edit branch"
                                    >
                                      <Pencil className="w-4 h-4 text-gray-500" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {showBankModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingBank ? 'Edit Bank' : 'Add Bank'}</h2>
              <button onClick={() => setShowBankModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={bankForm.bank_name}
                  onChange={e => setBankForm(prev => ({ ...prev, bank_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Commercial Bank of Ceylon"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Code</label>
                <input
                  type="text"
                  value={bankForm.bank_code}
                  onChange={e => setBankForm(prev => ({ ...prev, bank_code: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. CBC"
                />
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="bank-active"
                  checked={bankForm.is_active}
                  onChange={e => setBankForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="bank-active" className="text-sm font-medium text-gray-700">Active</label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button onClick={() => setShowBankModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSaveBank}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingBank ? 'Update Bank' : 'Add Bank'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBranchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{editingBranch ? 'Edit Branch' : 'Add Branch'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{selectedBankName}</p>
              </div>
              <button onClick={() => setShowBranchModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Branch Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={branchForm.branch_name}
                  onChange={e => setBranchForm(prev => ({ ...prev, branch_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Colombo Main Branch"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Branch Code</label>
                <input
                  type="text"
                  value={branchForm.branch_code}
                  onChange={e => setBranchForm(prev => ({ ...prev, branch_code: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. CMB001"
                />
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="branch-active"
                  checked={branchForm.is_active}
                  onChange={e => setBranchForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="branch-active" className="text-sm font-medium text-gray-700">Active</label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button onClick={() => setShowBranchModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSaveBranch}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingBranch ? 'Update Branch' : 'Add Branch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
