import { Plus, Search, BookOpen, Wallet, TrendingUp, TrendingDown, Building2 } from 'lucide-react';
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

export function CashBalance() {
  const [showModal, setShowModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [cashBookEntity, setCashBookEntity] = useState<string>('');
  const [transactionType, setTransactionType] = useState<'Addition' | 'Deduction'>('Addition');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    entityId: '',
    code: '',
    amount: '',
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

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('cash_balance_ledger')
        .select('*')
        .order('timestamp', { ascending: false });

      if (transactionsError) throw transactionsError;

      setEntities(entitiesData || []);
      setTransactions(transactionsData || []);
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
      const entity = entities.find(e => e.entity_id === formData.entityId);
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

      const { error } = await supabase
        .from('cash_balance_ledger')
        .insert({
          type: transactionType,
          description: formData.description,
          code: formData.code || null,
          amount: amount,
          date: formData.date,
          running_balance: newBalance,
          entity_id: formData.entityId,
          created_by: formData.createdBy
        });

      if (error) throw error;

      await supabase
        .from('entities')
        .update({ current_balance: newBalance })
        .eq('entity_id', formData.entityId);

      await loadData();

      setShowModal(false);
      setFormData({
        entityId: '',
        code: '',
        amount: '',
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

  const filteredTransactions = selectedEntity === 'all'
    ? transactions
    : transactions.filter(t => t.entity_id === selectedEntity);

  const cashBookTransactions = transactions.filter(t => t.entity_id === cashBookEntity);
  const amountInTransactions = cashBookTransactions.filter(t => t.type === 'Addition');
  const amountOutTransactions = cashBookTransactions.filter(t => t.type === 'Deduction');

  const totalAmountIn = amountInTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalAmountOut = amountOutTransactions.reduce((sum, t) => sum + t.amount, 0);
  const cashBookBalance = totalAmountIn - totalAmountOut;

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
          <h2 className="text-lg font-bold text-gray-900 mb-4">Entity Cash Balances</h2>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entities.map((entity) => {
                const availableCredit = entity.current_balance + entity.od_limit;
                return (
                  <tr key={entity.id} className="hover:bg-gray-50">
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Transaction Ledger</h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Entities</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.entity_id}>
                  {entity.entity_id} - {entity.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Running Balance</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => {
                const entity = entities.find(e => e.entity_id === transaction.entity_id);
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
                      <div className="text-sm font-bold text-blue-600">{transaction.entity_id || '-'}</div>
                      <div className="text-xs text-gray-500">{entity?.name || 'N/A'}</div>
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
                      <div className="text-sm text-gray-900">{transaction.created_by}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Cash Transaction</h2>
            </div>
            <form onSubmit={handleAddTransaction} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Entity *</label>
                  <select
                    value={formData.entityId}
                    onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select entity</option>
                    {entities.map((entity) => (
                      <option key={entity.id} value={entity.entity_id}>
                        {entity.entity_id} - {entity.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Type</label>
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
                      Addition
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
                      Deduction
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
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
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
