import { Plus, Search, BookOpen, Wallet, TrendingUp, TrendingDown, Building2, ChevronRight, Landmark } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase, type CashTransaction } from '../lib/supabase';

interface Entity {
  id: string;
  entity_id: string;
  name: string;
  type: string;
  current_balance: number;
  od_limit: number;
}

interface Bank {
  id: string;
  entity_id: string;
  name: string;
  account_number: string;
  branch: string;
  balance: number;
}

type FilterView = 'all' | 'entity' | 'entity-bank';

export function CashBalance() {
  const [showModal, setShowModal] = useState(false);
  const [filterView, setFilterView] = useState<FilterView>('all');
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [cashBookEntity, setCashBookEntity] = useState<string>('');
  const [transactionType, setTransactionType] = useState<'Addition' | 'Deduction'>('Addition');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    entityId: '',
    bankId: '',
    code: '',
    amount: '',
    onHoldAmount: '0',
    description: '',
    date: new Date().toISOString().split('T')[0],
    createdBy: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (entities.length > 0 && !cashBookEntity) {
      setCashBookEntity(entities[0].entity_id);
    }
  }, [entities]);

  async function loadData() {
    try {
      setLoading(true);

      const { data: entitiesData, error: entitiesError } = await supabase
        .from('entities')
        .select('*')
        .order('name');

      if (entitiesError) throw entitiesError;

      const { data: banksData, error: banksError } = await supabase
        .from('banks')
        .select('*')
        .order('name');

      if (banksError) throw banksError;

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('cash_balance_ledger')
        .select('*')
        .order('timestamp', { ascending: false });

      if (transactionsError) throw transactionsError;

      const parsedEntities = (entitiesData || []).map(entity => ({
        ...entity,
        current_balance: Number(entity.current_balance) || 0,
        od_limit: Number(entity.od_limit) || 0
      }));

      const parsedBanks = (banksData || []).map(bank => ({
        ...bank,
        balance: Number(bank.balance) || 0
      }));

      const parsedTransactions = (transactionsData || []).map(txn => ({
        ...txn,
        amount: Number(txn.amount) || 0,
        running_balance: Number(txn.running_balance) || 0
      }));

      setEntities(parsedEntities);
      setBanks(parsedBanks);
      setTransactions(parsedTransactions);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.entityId || !formData.amount || !formData.description || !formData.createdBy) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const entity = entities.find(e => e.id === formData.entityId);
      if (!entity) return;

      const entityTransactions = transactions
        .filter(t => t.entity_id === formData.entityId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const lastBalance = entityTransactions.length > 0
        ? entityTransactions[entityTransactions.length - 1].running_balance
        : 0;

      const amount = parseFloat(formData.amount);
      const newBalance = transactionType === 'Addition'
        ? lastBalance + amount
        : lastBalance - amount;

      const onHoldAmount = parseFloat(formData.onHoldAmount) || 0;

      const { error } = await supabase
        .from('cash_balance_ledger')
        .insert({
          type: transactionType,
          description: formData.description,
          code: formData.code || null,
          amount: amount,
          date: formData.date,
          running_balance: newBalance,
          on_hold_amount: onHoldAmount,
          entity_id: formData.entityId,
          bank_id: formData.bankId || null,
          created_by: formData.createdBy
        });

      if (error) throw error;

      await supabase
        .from('entities')
        .update({ current_balance: newBalance })
        .eq('id', formData.entityId);

      await loadData();

      setShowModal(false);
      setFormData({
        entityId: '',
        bankId: '',
        code: '',
        amount: '',
        onHoldAmount: '0',
        description: '',
        date: new Date().toISOString().split('T')[0],
        createdBy: ''
      });
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Failed to add transaction');
    }
  }

  const totalBalance = entities.reduce((sum, entity) => sum + entity.current_balance, 0);
  const totalODLimit = entities.reduce((sum, entity) => sum + entity.od_limit, 0);

  const filteredTransactions = (() => {
    let filtered = transactions;

    if (selectedEntity) {
      filtered = filtered.filter(t => t.entity_id === selectedEntity.id);
    }

    if (selectedBank) {
      filtered = filtered.filter(t => t.bank_id === selectedBank.id);
    }

    return filtered;
  })();

  function handleEntityClick(entity: Entity) {
    setSelectedEntity(entity);
    setSelectedBank(null);
    setFilterView('entity');
  }

  function handleBankClick(bank: Bank) {
    setSelectedBank(bank);
    setFilterView('entity-bank');
  }

  function handleClearFilters() {
    setSelectedEntity(null);
    setSelectedBank(null);
    setFilterView('all');
  }

  function getBankById(bankId: string | null): Bank | null {
    if (!bankId) return null;
    return banks.find(b => b.id === bankId) || null;
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cash Balance by Entity</h1>
          <p className="text-gray-500 mt-1">Track and manage cash balance for each entity</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Transaction</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm">
          <button
            onClick={handleClearFilters}
            className={`${filterView === 'all' ? 'text-blue-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            All Entities
          </button>

          {selectedEntity && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <button
                onClick={() => {
                  setSelectedBank(null);
                  setFilterView('entity');
                }}
                className={`${filterView === 'entity' || filterView === 'entity-bank' ? 'text-blue-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {selectedEntity.name}
              </button>
            </>
          )}

          {selectedBank && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <span className="text-blue-600 font-semibold">
                {selectedBank.name}
              </span>
            </>
          )}
        </div>

        {(selectedEntity || selectedBank) && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Cash Balance</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                Rs. {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-500 mt-2">Across all entities</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Entities</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{entities.length}</p>
              <p className="text-sm text-gray-500 mt-2">Active entities</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Entity Cash Balances</h2>
              <p className="text-sm text-gray-500">Click on an entity to view their transactions</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Balance</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">OD Limit</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Available Credit</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entities.map((entity) => {
                const availableCredit = entity.current_balance + entity.od_limit;
                return (
                  <tr
                    key={entity.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleEntityClick(entity)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-blue-600">{entity.entity_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">{entity.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                        {entity.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        Rs. {entity.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        Rs. {entity.od_limit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600">
                        Rs. {availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEntityClick(entity);
                          setTimeout(() => {
                            document.getElementById('transaction-ledger')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 50);
                        }}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center space-x-1"
                      >
                        <span>View Transactions</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div id="transaction-ledger" className="bg-white rounded-xl border border-gray-200 scroll-mt-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Transaction Ledger</h2>
            <div className="text-sm text-gray-500">
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bank</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Account Number</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Facility Limit</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Opening Balance</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Closing Balance [Current]</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Closing Balance [Available]</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((transaction, index) => {
                const entity = entities.find(e => e.id === transaction.entity_id);
                const bank = getBankById(transaction.bank_id);

                const sortedTransactions = [...filteredTransactions].sort((a, b) =>
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
                const currentIndex = sortedTransactions.findIndex(t => t.id === transaction.id);
                const openingBalance = currentIndex > 0
                  ? sortedTransactions[currentIndex - 1].running_balance
                  : 0;

                const onHoldAmount = transaction.on_hold_amount || 0;
                const availableBalance = transaction.running_balance + (entity?.od_limit || 0) - onHoldAmount;

                return (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(transaction.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => entity && handleEntityClick(entity)}
                        className="text-left hover:underline"
                      >
                        <div className="text-sm font-bold text-blue-600">{entity?.entity_id || '-'}</div>
                        <div className="text-xs text-gray-500">{entity?.name || 'N/A'}</div>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {bank ? (
                        <button
                          onClick={() => handleBankClick(bank)}
                          className="text-left hover:underline"
                        >
                          <div className="text-sm font-medium text-blue-600 flex items-center space-x-1">
                            <Landmark className="w-3 h-3" />
                            <span>{bank.name}</span>
                          </div>
                        </button>
                      ) : (
                        <div className="text-sm text-gray-400">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{bank?.account_number || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {entity ? `Rs. ${entity.od_limit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        transaction.type === 'Addition' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type === 'Addition' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{transaction.code || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{transaction.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        Rs. {openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-semibold ${transaction.type === 'Addition' ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.type === 'Addition' ? '+' : '-'}Rs. {transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        Rs. {transaction.running_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-bold ${availableBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Rs. {availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{transaction.created_by}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No transactions found</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Cash Transaction</h2>
            </div>
            <form onSubmit={handleAddTransaction} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Entity *</label>
                  <select
                    value={formData.entityId}
                    onChange={(e) => setFormData({ ...formData, entityId: e.target.value, bankId: '' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select entity</option>
                    {entities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.entity_id} - {entity.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Bank</label>
                  <select
                    value={formData.bankId}
                    onChange={(e) => setFormData({ ...formData, bankId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!formData.entityId}
                  >
                    <option value="">Select bank account (optional)</option>
                    {banks
                      .filter((bank) => {
                        if (!formData.entityId) return false;
                        return bank.entity_id === formData.entityId;
                      })
                      .map((bank) => (
                        <option key={bank.id} value={bank.id}>
                          {bank.name} - {bank.branch}
                        </option>
                      ))}
                  </select>
                </div>

                {formData.bankId && (() => {
                  const selectedBank = banks.find(b => b.id === formData.bankId);
                  return selectedBank ? (
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Account Number</label>
                      <input
                        type="text"
                        value={selectedBank.account_number}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                        disabled
                      />
                    </div>
                  ) : null;
                })()}

                {formData.entityId && (() => {
                  const selectedEntity = entities.find(e => e.id === formData.entityId);
                  return selectedEntity ? (
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Facility Limit (OD Limit)</label>
                      <input
                        type="text"
                        value={`Rs. ${selectedEntity.od_limit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        className="w-full px-4 py-2 border border-green-300 bg-green-50 rounded-lg text-green-700 font-semibold"
                        disabled
                      />
                    </div>
                  ) : null;
                })()}

                {formData.entityId && (() => {
                  const entity = entities.find(e => e.id === formData.entityId);
                  if (!entity) return null;

                  const entityTransactions = transactions
                    .filter(t => t.entity_id === formData.entityId)
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                  const openingBalance = entityTransactions.length > 0
                    ? entityTransactions[entityTransactions.length - 1].running_balance
                    : 0;

                  return (
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Opening Balance</label>
                      <input
                        type="text"
                        value={`Rs. ${openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        className="w-full px-4 py-2 border border-green-300 bg-green-50 rounded-lg text-green-700 font-semibold"
                        disabled
                      />
                    </div>
                  );
                })()}

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Type *</label>
                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setTransactionType('Addition')}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                        transactionType === 'Addition'
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <TrendingUp className="w-5 h-5 mx-auto mb-1" />
                      Cash Add / Sell
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransactionType('Deduction')}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                        transactionType === 'Deduction'
                          ? 'border-red-600 bg-red-50 text-red-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <TrendingDown className="w-5 h-5 mx-auto mb-1" />
                      Buy
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 001, 002, 900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (LKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                {formData.entityId && formData.amount && (() => {
                  const entity = entities.find(e => e.entity_id === formData.entityId);
                  if (!entity) return null;

                  const entityTransactions = transactions
                    .filter(t => t.entity_id === formData.entityId)
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                  const lastBalance = entityTransactions.length > 0
                    ? entityTransactions[entityTransactions.length - 1].running_balance
                    : 0;

                  const amount = parseFloat(formData.amount) || 0;
                  const closingBalance = transactionType === 'Addition'
                    ? lastBalance + amount
                    : lastBalance - amount;

                  return (
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Closing Balance [Current]</label>
                      <input
                        type="text"
                        value={`Rs. ${closingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        className="w-full px-4 py-2 border border-green-300 bg-green-50 rounded-lg text-green-700 font-bold"
                        disabled
                      />
                    </div>
                  );
                })()}

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">On Hold Amount (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.onHoldAmount}
                    onChange={(e) => setFormData({ ...formData, onHoldAmount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                {formData.entityId && formData.amount && (() => {
                  const entity = entities.find(e => e.entity_id === formData.entityId);
                  if (!entity) return null;

                  const entityTransactions = transactions
                    .filter(t => t.entity_id === formData.entityId)
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                  const lastBalance = entityTransactions.length > 0
                    ? entityTransactions[entityTransactions.length - 1].running_balance
                    : 0;

                  const amount = parseFloat(formData.amount) || 0;
                  const closingBalance = transactionType === 'Addition'
                    ? lastBalance + amount
                    : lastBalance - amount;

                  const onHoldAmount = parseFloat(formData.onHoldAmount) || 0;
                  const availableBalance = closingBalance + entity.od_limit - onHoldAmount;

                  return (
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Closing Balance [Available]</label>
                      <input
                        type="text"
                        value={`Rs. ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        className={`w-full px-4 py-2 border rounded-lg font-bold ${
                          availableBalance >= 0
                            ? 'border-green-300 bg-green-50 text-green-700'
                            : 'border-red-300 bg-red-50 text-red-700'
                        }`}
                        disabled
                      />
                    </div>
                  );
                })()}

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Manual deposit, Shares bought/sold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Created By *</label>
                  <input
                    type="text"
                    value={formData.createdBy}
                    onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your name"
                    required
                  />
                </div>
              </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-4 bg-white">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
