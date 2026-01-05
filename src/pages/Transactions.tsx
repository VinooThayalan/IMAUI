import { Plus, Search, Filter, Printer, Send, CheckSquare, Square } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Transaction {
  id: string;
  entity_id: string;
  share_id: string;
  transaction_type: string;
  transaction_date: string;
  no_of_shares: number;
  price_per_share: number;
  total_amount: number;
  fees?: number;
  created_at: string;
  updated_at: string;
}

interface Entity {
  id: string;
  name: string;
}

interface Share {
  id: string;
  name: string;
  symbol: string;
}

export function Transactions() {
  const [showModal, setShowModal] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    entity_id: '',
    share_id: '',
    transaction_type: 'BUY',
    transaction_date: new Date().toISOString().split('T')[0],
    no_of_shares: '',
    price_per_share: '',
    fees: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [transactionsRes, entitiesRes, sharesRes] = await Promise.all([
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('entities').select('id, name').order('name'),
        supabase.from('shares').select('id, name, symbol').order('name')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;

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
    return share ? `${share.symbol} - ${share.name}` : 'Unknown';
  }

  function toggleSelectTransaction(id: string) {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTransactions(newSelected);
  }

  function toggleSelectAll() {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredTransactions.map(t => t.id)));
    }
  }

  function resetForm() {
    setFormData({
      entity_id: '',
      share_id: '',
      transaction_type: 'BUY',
      transaction_date: new Date().toISOString().split('T')[0],
      no_of_shares: '',
      price_per_share: '',
      fees: ''
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

    if (!formData.entity_id || !formData.share_id || !formData.no_of_shares || !formData.price_per_share) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const totalAmount = calculateTotalAmount();

      const { error } = await supabase.from('transactions').insert({
        entity_id: formData.entity_id,
        share_id: formData.share_id,
        transaction_type: formData.transaction_type,
        transaction_date: formData.transaction_date,
        no_of_shares: parseFloat(formData.no_of_shares),
        price_per_share: parseFloat(formData.price_per_share),
        total_amount: totalAmount,
        fees: parseFloat(formData.fees) || 0
      });

      if (error) throw error;

      alert('Transaction created successfully');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Failed to create transaction');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendForApproval() {
    if (selectedTransactions.size === 0) {
      alert('Please select at least one transaction to send for approval');
      return;
    }

    const selectedTxns = transactions.filter(t => selectedTransactions.has(t.id));

    try {
      const requestsToInsert = selectedTxns.map(txn => ({
        entity_id: txn.entity_id,
        share_id: txn.share_id,
        transaction_type: txn.transaction_type,
        no_of_shares: txn.no_of_shares,
        price_per_share: txn.price_per_share,
        total_amount: txn.total_amount,
        request_date: new Date().toISOString().split('T')[0],
        status: 'Pending',
        requested_by: 'Current User',
        notes: `Approval request for transaction on ${txn.transaction_date}`
      }));

      const { error } = await supabase
        .from('transaction_requests')
        .insert(requestsToInsert);

      if (error) throw error;

      alert(`Successfully sent ${selectedTransactions.size} transaction(s) for approval`);
      setSelectedTransactions(new Set());
    } catch (error) {
      console.error('Error sending for approval:', error);
      alert('Failed to send transactions for approval');
    }
  }

  function handlePrint() {
    if (selectedTransactions.size === 0) {
      alert('Please select at least one transaction to print');
      return;
    }
    setShowPrintView(true);
  }

  function printDocument() {
    window.print();
  }

  const filteredTransactions = transactions.filter(txn => {
    const entityName = getEntityName(txn.entity_id).toLowerCase();
    const shareInfo = getShareInfo(txn.share_id).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return entityName.includes(searchLower) || shareInfo.includes(searchLower);
  });

  const selectedTxnsData = transactions.filter(t => selectedTransactions.has(t.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (showPrintView) {
    return (
      <div className="p-8">
        <style>
          {`
            @media print {
              .no-print { display: none !important; }
              body { background: white; }
            }
          `}
        </style>

        <div className="no-print mb-6 flex items-center justify-between">
          <button
            onClick={() => setShowPrintView(false)}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Back
          </button>
          <button
            onClick={printDocument}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer className="w-5 h-5" />
            <span>Print</span>
          </button>
        </div>

        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Transaction Report</h1>
            <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
          </div>

          <table className="w-full mb-8">
            <thead className="border-b-2 border-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Date</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Entity</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Type</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Share</th>
                <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Quantity</th>
                <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Price</th>
                <th className="px-4 py-3 text-right text-sm font-bold text-gray-900">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {selectedTxnsData.map((txn) => (
                <tr key={txn.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(txn.transaction_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{getEntityName(txn.entity_id)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{txn.transaction_type}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{getShareInfo(txn.share_id)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {txn.no_of_shares.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    Rs. {Number(txn.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                    Rs. {Number(txn.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-900">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  Total:
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  Rs. {selectedTxnsData.reduce((sum, txn) => sum + Number(txn.total_amount), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-8 pt-8 border-t border-gray-300 text-sm text-gray-600">
            <p>Total Transactions: {selectedTxnsData.length}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500 mt-1">Manage buy and sell transactions</p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedTransactions.size > 0 && (
            <>
              <button
                onClick={handlePrint}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Printer className="w-5 h-5" />
                <span className="font-medium">Print ({selectedTransactions.size})</span>
              </button>
              <button
                onClick={handleSendForApproval}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Send className="w-5 h-5" />
                <span className="font-medium">Send for Approval ({selectedTransactions.size})</span>
              </button>
            </>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">New Transaction</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={toggleSelectAll}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {selectedTransactions.size === filteredTransactions.length && filteredTransactions.length > 0 ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className={`hover:bg-gray-50 cursor-pointer ${selectedTransactions.has(transaction.id) ? 'bg-blue-50' : ''}`}
                  onClick={() => toggleSelectTransaction(transaction.id)}
                >
                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectTransaction(transaction.id);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {selectedTransactions.has(transaction.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(transaction.transaction_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-900">{getEntityName(transaction.entity_id)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      transaction.transaction_type === 'BUY' || transaction.transaction_type === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.transaction_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{getShareInfo(transaction.share_id)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.no_of_shares.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    Rs. {Number(transaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    Rs. {Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTransactions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No transactions found</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">New Transaction</h2>
            </div>
            <form onSubmit={handleCreateTransaction}>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Entity <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={formData.entity_id}
                      onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Entity</option>
                      {entities.map(entity => (
                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Transaction Type <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={formData.transaction_type}
                      onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Transaction Date <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.transaction_date}
                      onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Share <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={formData.share_id}
                      onChange={(e) => setFormData({ ...formData, share_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Share</option>
                      {shares.map(share => (
                        <option key={share.id} value={share.id}>
                          {share.symbol} - {share.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Number of Shares <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={formData.no_of_shares}
                      onChange={(e) => setFormData({ ...formData, no_of_shares: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Price per Share (Rs.) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.price_per_share}
                      onChange={(e) => setFormData({ ...formData, price_per_share: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 150.50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Fees (Rs.)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.fees}
                      onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 50.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Total Amount (Rs.)
                    </label>
                    <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                      {calculateTotalAmount().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
