import { Plus, Search, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Transaction {
  id: string;
  entity_id: string;
  broker_id: string | null;
  bank_id: string | null;
  share_id: string;
  cds_account_id: string | null;
  transaction_type: string;
  order_type: string;
  transaction_date: string;
  no_of_shares: number;
  price_per_share: number;
  total_amount_gross: number;
  brokerage_fee_type_id: string | null;
  brokerage_fee_rate: number | null;
  fees: number;
  net_price_per_share: number;
  total_amount: number;
  created_at: string;
}

interface Entity {
  id: string;
  name: string;
  current_balance: number;
}

interface Share {
  id: string;
  name: string;
  ticker: string;
}

interface Bank {
  id: string;
  name: string;
  account_number: string;
  balance: number;
}

interface Broker {
  id: string;
  name: string;
  contact_person: string;
}

interface BrokerageFeeType {
  id: string;
  name: string;
  rate: number;
  min_price: number | null;
  max_price: number | null;
}

interface ShareBalance {
  share_id: string;
  total_shares: number;
  avg_cost: number;
}

export function Transactions() {
  const [showModal, setShowModal] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [brokerageFeeTypes, setBrokerageFeeTypes] = useState<BrokerageFeeType[]>([]);
  const [shareBalances, setShareBalances] = useState<Map<string, ShareBalance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    entity_id: '',
    broker_id: '',
    bank_id: '',
    cds_account_id: '',
    share_id: '',
    transaction_type: 'BUY',
    order_type: 'MARKET',
    transaction_date: new Date().toISOString().split('T')[0],
    no_of_shares: '',
    price_per_share: '',
    brokerage_fee_type_id: '',
    brokerage_fee_rate: '',
    fees: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.entity_id && formData.share_id) {
      calculateShareBalance(formData.entity_id, formData.share_id);
    }
  }, [formData.entity_id, formData.share_id]);

  useEffect(() => {
    if (formData.brokerage_fee_type_id) {
      const feeType = brokerageFeeTypes.find(ft => ft.id === formData.brokerage_fee_type_id);
      if (feeType) {
        setFormData(prev => ({ ...prev, brokerage_fee_rate: feeType.rate.toString() }));
        calculateFees(feeType.rate);
      }
    }
  }, [formData.brokerage_fee_type_id, formData.no_of_shares, formData.price_per_share]);

  async function loadData() {
    try {
      setLoading(true);

      const [transactionsRes, entitiesRes, sharesRes, banksRes, brokersRes, brokerageRes] = await Promise.all([
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('entities').select('id, name, current_balance').order('name'),
        supabase.from('shares').select('id, name, ticker').order('name'),
        supabase.from('banks').select('id, name, account_number, balance').order('name'),
        supabase.from('brokers').select('id, name, contact_person').order('name'),
        supabase.from('brokerage_fee_types').select('*').eq('is_active', true).order('name')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      if (banksRes.error) throw banksRes.error;
      if (brokersRes.error) throw brokersRes.error;
      if (brokerageRes.error) throw brokerageRes.error;

      setTransactions(transactionsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
      setBanks(banksRes.data || []);
      setBrokers(brokersRes.data || []);
      setBrokerageFeeTypes(brokerageRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function calculateShareBalance(entityId: string, shareId: string) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('transaction_type, no_of_shares, price_per_share')
        .eq('entity_id', entityId)
        .eq('share_id', shareId);

      if (error) throw error;

      let totalShares = 0;
      let totalCost = 0;

      (data || []).forEach(txn => {
        const shares = Number(txn.no_of_shares) || 0;
        const price = Number(txn.price_per_share) || 0;

        if (txn.transaction_type === 'BUY') {
          totalShares += shares;
          totalCost += shares * price;
        } else if (txn.transaction_type === 'SELL') {
          totalShares -= shares;
        }
      });

      const avgCost = totalShares > 0 ? totalCost / totalShares : 0;

      setShareBalances(prev => new Map(prev).set(`${entityId}-${shareId}`, {
        share_id: shareId,
        total_shares: totalShares,
        avg_cost: avgCost
      }));
    } catch (error) {
      console.error('Error calculating share balance:', error);
    }
  }

  function calculateFees(rate: number) {
    const shares = parseFloat(formData.no_of_shares) || 0;
    const price = parseFloat(formData.price_per_share) || 0;
    const grossAmount = shares * price;
    const fees = (grossAmount * rate) / 100;
    setFormData(prev => ({ ...prev, fees: fees.toFixed(2) }));
  }

  function calculateTotalAmountGross() {
    const shares = parseFloat(formData.no_of_shares) || 0;
    const price = parseFloat(formData.price_per_share) || 0;
    return shares * price;
  }

  function calculateNetPricePerShare() {
    const shares = parseFloat(formData.no_of_shares) || 0;
    const price = parseFloat(formData.price_per_share) || 0;
    const fees = parseFloat(formData.fees) || 0;
    if (shares === 0) return 0;

    const grossAmount = shares * price;
    const netAmount = formData.transaction_type === 'BUY' ? grossAmount + fees : grossAmount - fees;
    return netAmount / shares;
  }

  function calculateTotalAmountNet() {
    const grossAmount = calculateTotalAmountGross();
    const fees = parseFloat(formData.fees) || 0;
    return formData.transaction_type === 'BUY' ? grossAmount + fees : grossAmount - fees;
  }

  function calculateAverageCostWithPurchase() {
    const key = `${formData.entity_id}-${formData.share_id}`;
    const balance = shareBalances.get(key);

    if (!balance) return 0;

    const newShares = parseFloat(formData.no_of_shares) || 0;
    const newPrice = parseFloat(formData.price_per_share) || 0;

    if (formData.transaction_type === 'BUY') {
      const totalShares = balance.total_shares + newShares;
      const totalCost = (balance.total_shares * balance.avg_cost) + (newShares * newPrice);
      return totalShares > 0 ? totalCost / totalShares : 0;
    } else {
      return balance.avg_cost;
    }
  }

  function getEntityName(entityId: string) {
    return entities.find(e => e.id === entityId)?.name || 'Unknown';
  }

  function getBankInfo(bankId: string | null) {
    if (!bankId) return { name: '-', account: '-', balance: 0 };
    const bank = banks.find(b => b.id === bankId);
    if (!bank) return { name: '-', account: '-', balance: 0 };
    return {
      name: bank.name,
      account: bank.account_number,
      balance: bank.balance
    };
  }

  function getBrokerName(brokerId: string | null) {
    if (!brokerId) return '-';
    return brokers.find(b => b.id === brokerId)?.name || 'Unknown';
  }

  function getShareInfo(shareId: string) {
    const share = shares.find(s => s.id === shareId);
    return share ? `${share.ticker} - ${share.name}` : 'Unknown';
  }

  function resetForm() {
    setFormData({
      entity_id: '',
      broker_id: '',
      bank_id: '',
      cds_account_id: '',
      share_id: '',
      transaction_type: 'BUY',
      order_type: 'MARKET',
      transaction_date: new Date().toISOString().split('T')[0],
      no_of_shares: '',
      price_per_share: '',
      brokerage_fee_type_id: '',
      brokerage_fee_rate: '',
      fees: ''
    });
  }

  async function handleCreateTransaction(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.entity_id || !formData.share_id || !formData.no_of_shares || !formData.price_per_share) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const totalAmountGross = calculateTotalAmountGross();
      const netPricePerShare = calculateNetPricePerShare();
      const totalAmountNet = calculateTotalAmountNet();

      const { error } = await supabase.from('transactions').insert({
        entity_id: formData.entity_id,
        broker_id: formData.broker_id || null,
        bank_id: formData.bank_id || null,
        cds_account_id: formData.cds_account_id || null,
        share_id: formData.share_id,
        transaction_type: formData.transaction_type,
        order_type: formData.order_type,
        transaction_date: formData.transaction_date,
        no_of_shares: parseFloat(formData.no_of_shares),
        price_per_share: parseFloat(formData.price_per_share),
        total_amount_gross: totalAmountGross,
        brokerage_fee_type_id: formData.brokerage_fee_type_id || null,
        brokerage_fee_rate: formData.brokerage_fee_rate ? parseFloat(formData.brokerage_fee_rate) : null,
        fees: parseFloat(formData.fees) || 0,
        net_price_per_share: netPricePerShare,
        total_amount: totalAmountNet
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

  const filteredTransactions = transactions.filter(txn => {
    const entityName = getEntityName(txn.entity_id).toLowerCase();
    const shareInfo = getShareInfo(txn.share_id).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return entityName.includes(searchLower) || shareInfo.includes(searchLower);
  });

  const key = `${formData.entity_id}-${formData.share_id}`;
  const currentBalance = shareBalances.get(key);
  const selectedBank = formData.bank_id ? getBankInfo(formData.bank_id) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
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
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">New Transaction</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Transactions</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{transactions.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Buy Transactions</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {transactions.filter(t => t.transaction_type === 'BUY').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Sell Transactions</p>
              <p className="text-2xl font-bold text-red-600 mt-2">
                {transactions.filter(t => t.transaction_type === 'SELL').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Volume</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                LKR {transactions.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Broker</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Fee</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(transaction.transaction_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-900">{getEntityName(transaction.entity_id)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{getBrokerName(transaction.broker_id)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      transaction.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.transaction_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{getShareInfo(transaction.share_id)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {Number(transaction.no_of_shares).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    LKR {Number(transaction.total_amount_gross || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                    LKR {Number(transaction.fees || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                    LKR {Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">New Transaction</h2>
            </div>
            <form onSubmit={handleCreateTransaction} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-3">
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
                      Broker/Custodian
                    </label>
                    <select
                      value={formData.broker_id}
                      onChange={(e) => setFormData({ ...formData, broker_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Broker</option>
                      {brokers.map(broker => (
                        <option key={broker.id} value={broker.id}>{broker.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      CDS Account ID / Broker Account ID
                    </label>
                    <input
                      type="text"
                      value={formData.cds_account_id}
                      onChange={(e) => setFormData({ ...formData, cds_account_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., CDS12345"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Bank
                    </label>
                    <select
                      value={formData.bank_id}
                      onChange={(e) => setFormData({ ...formData, bank_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Bank</option>
                      {banks.map(bank => (
                        <option key={bank.id} value={bank.id}>{bank.name} - {bank.account_number}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedBank && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500">Account Balance</p>
                      <p className="text-lg font-semibold text-gray-900">LKR {selectedBank.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-6">
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
                      Order Type <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={formData.order_type}
                      onChange={(e) => setFormData({ ...formData, order_type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="MARKET">MARKET</option>
                      <option value="LIMIT">LIMIT</option>
                      <option value="STOP">STOP</option>
                      <option value="STOP_LIMIT">STOP LIMIT</option>
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

                  <div className="col-span-3">
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
                          {share.ticker} - {share.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {currentBalance && (
                  <div className="bg-blue-50 p-4 rounded-lg grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Current Share Balance</p>
                      <p className="text-sm font-semibold text-gray-900">{currentBalance.total_shares.toLocaleString()} shares</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Current Average Cost Per Share</p>
                      <p className="text-sm font-semibold text-gray-900">LKR {currentBalance.avg_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
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
                      Price Per Share (LKR) <span className="text-red-600">*</span>
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
                      Total Amount (Gross)
                    </label>
                    <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                      LKR {calculateTotalAmountGross().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {formData.transaction_type === 'BUY' && currentBalance && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Average Cost After Purchase
                      </label>
                      <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                        LKR {calculateAverageCostWithPurchase().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Brokerage Fee Type
                    </label>
                    <select
                      value={formData.brokerage_fee_type_id}
                      onChange={(e) => setFormData({ ...formData, brokerage_fee_type_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Fee Type</option>
                      {brokerageFeeTypes.map(type => (
                        <option key={type.id} value={type.id}>
                          {type.name} ({type.rate}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Brokerage Fee Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.brokerage_fee_rate}
                      onChange={(e) => {
                        setFormData({ ...formData, brokerage_fee_rate: e.target.value });
                        const rate = parseFloat(e.target.value) || 0;
                        calculateFees(rate);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 0.30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Brokerage Fee (LKR)
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
                      Net Price Per Share
                    </label>
                    <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                      LKR {calculateNetPricePerShare().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Total Amount (Net)
                    </label>
                    <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-blue-50 text-blue-900 font-bold text-lg">
                      LKR {calculateTotalAmountNet().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-4 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
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
