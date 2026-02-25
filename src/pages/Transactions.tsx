import { Plus, Search, Filter, TrendingUp, TrendingDown, XCircle, Eye, Printer, Clock } from 'lucide-react';
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
  approval_status: string;
  submitted_for_approval_at: string | null;
  approval_validity_hours: number | null;
  approval_expires_at: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  approval_date: string | null;
  approval_notes: string | null;
  rejection_reason: string | null;
  approval_document_url: string | null;
  approval_document_name: string | null;
  approval_document_uploaded_at: string | null;
  approval_document_uploaded_by: string | null;
  offline_approval: boolean | null;
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
  broker_name: string;
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

interface EntityBroker {
  id: string;
  entity_id: string;
  broker_id: string;
  relationship_type: string;
  custodian_account_number: string | null;
  broker_account_number: string | null;
  broker_name_id: string | null;
  bank_id: string | null;
  bank_account_number: string | null;
  facility_limit: number | null;
  bank?: {
    name: string;
    balance: number;
  } | null;
}

export function Transactions() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [brokerageFeeTypes, setBrokerageFeeTypes] = useState<BrokerageFeeType[]>([]);
  const [entityBrokers, setEntityBrokers] = useState<EntityBroker[]>([]);
  const [shareBalances, setShareBalances] = useState<Map<string, ShareBalance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const [formData, setFormData] = useState({
    entity_id: '',
    relationship_type: 'Broker',
    entity_broker_id: '',
    selected_broker_name_id: '',
    share_id: '',
    transaction_type: 'BUY',
    order_type: 'DAY',
    transaction_date: new Date().toISOString().split('T')[0],
    no_of_shares: '',
    price_per_share: '',
    brokerage_fee_type_id: '',
    brokerage_fee_rate: '',
    fees: '',
    use_negotiated_fee: false
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
    if (formData.no_of_shares && formData.price_per_share) {
      const totalAmount = parseFloat(formData.no_of_shares) * parseFloat(formData.price_per_share);

      if (!formData.use_negotiated_fee) {
        const matchingFeeType = brokerageFeeTypes.find(ft => {
          const minOk = ft.min_price === null || totalAmount >= ft.min_price;
          const maxOk = ft.max_price === null || totalAmount <= ft.max_price;
          return minOk && maxOk;
        });

        if (matchingFeeType) {
          setFormData(prev => ({
            ...prev,
            brokerage_fee_type_id: matchingFeeType.id,
            brokerage_fee_rate: matchingFeeType.rate.toString()
          }));
          calculateFees(matchingFeeType.rate);
        }
      } else if (formData.brokerage_fee_rate) {
        calculateFees(parseFloat(formData.brokerage_fee_rate));
      }
    }
  }, [formData.no_of_shares, formData.price_per_share, formData.use_negotiated_fee, brokerageFeeTypes]);

  async function loadData() {
    try {
      setLoading(true);

      const [transactionsRes, entitiesRes, sharesRes, banksRes, brokersRes, brokerageRes, entityBrokersRes] = await Promise.all([
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('entities').select('id, name, current_balance').order('name'),
        supabase.from('shares').select('id, name, ticker').order('name'),
        supabase.from('banks').select('id, name, account_number, balance').order('name'),
        supabase.from('brokers').select('id, broker_name').eq('is_active', true).order('broker_name'),
        supabase.from('brokerage_fee_types').select('*').eq('is_active', true).order('min_price'),
        supabase.from('entity_brokers').select('*, bank:banks(name, balance)').eq('is_active', true)
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      if (banksRes.error) throw banksRes.error;
      if (brokersRes.error) throw brokersRes.error;
      if (brokerageRes.error) throw brokerageRes.error;
      if (entityBrokersRes.error) throw entityBrokersRes.error;

      setTransactions(transactionsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
      setBanks(banksRes.data || []);
      setBrokers(brokersRes.data || []);
      setBrokerageFeeTypes(brokerageRes.data || []);
      setEntityBrokers(entityBrokersRes.data || []);
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

  function getEntityBalance(entityId: string) {
    return entities.find(e => e.id === entityId)?.current_balance || 0;
  }

  function getBalanceColor(balance: number, requiredAmount: number) {
    if (balance >= requiredAmount * 1.5) return 'text-green-600';
    if (balance >= requiredAmount) return 'text-yellow-600';
    return 'text-red-600';
  }

  function getBalanceStatus(balance: number, requiredAmount: number) {
    if (balance >= requiredAmount * 1.5) return 'Excellent';
    if (balance >= requiredAmount) return 'Sufficient';
    return 'Insufficient';
  }

  function getBrokerName(brokerId: string | null) {
    if (!brokerId) return '-';
    return brokers.find(b => b.id === brokerId)?.broker_name || 'Unknown';
  }

  function getShareInfo(shareId: string) {
    const share = shares.find(s => s.id === shareId);
    return share ? `${share.ticker} - ${share.name}` : 'Unknown';
  }

  function resetForm() {
    setFormData({
      entity_id: '',
      relationship_type: 'Broker',
      entity_broker_id: '',
      selected_broker_name_id: '',
      share_id: '',
      transaction_type: 'BUY',
      order_type: 'DAY',
      transaction_date: new Date().toISOString().split('T')[0],
      no_of_shares: '',
      price_per_share: '',
      brokerage_fee_type_id: '',
      brokerage_fee_rate: '',
      fees: '',
      use_negotiated_fee: false
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

      const selectedEntityBroker = entityBrokers.find(eb => eb.id === formData.entity_broker_id);

      const { error } = await supabase.from('transactions').insert({
        entity_id: formData.entity_id,
        broker_id: selectedEntityBroker?.broker_id || null,
        bank_id: null,
        cds_account_id: selectedEntityBroker?.relationship_type === 'Custodian'
          ? selectedEntityBroker?.custodian_account_number
          : selectedEntityBroker?.broker_account_number,
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
        total_amount: totalAmountNet,
        approval_status: 'DRAFT'
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

  async function handleCancelTransaction(transaction: Transaction) {
    if (!confirm('Are you sure you want to cancel this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id);

      if (error) throw error;

      alert('Transaction cancelled successfully');
      loadData();
    } catch (error) {
      console.error('Error cancelling transaction:', error);
      alert('Failed to cancel transaction');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrintTransaction(transaction: Transaction) {
    const entityName = getEntityName(transaction.entity_id);
    const shareInfo = getShareInfo(transaction.share_id);
    const brokerName = transaction.broker_id ? getBrokerName(transaction.broker_id) : 'N/A';
    const cdsAccount = transaction.cds_account_id || '...';
    const currentDate = new Date().toLocaleDateString();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Transaction Approval - ${transaction.id}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              margin: 0 auto;
              max-width: 1200px;
            }
            .header {
              margin-bottom: 30px;
            }
            .info-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .info-table td {
              padding: 4px 8px;
              vertical-align: top;
            }
            .info-table td:first-child {
              font-weight: bold;
              width: 200px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: left;
              font-size: 13px;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            .green-bg {
              background-color: #90EE90 !important;
              color: #006400;
              font-weight: bold;
            }
            .total-row {
              font-weight: bold;
              background-color: #f5f5f5;
            }
            .total-row td:first-child {
              color: #006400;
            }
            .total-row .green-text {
              color: #006400;
              font-style: italic;
            }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0 0 20px 0;">Transaction Approval Details</h2>
          </div>

          <table class="info-table">
            <tr>
              <td>Entity:</td>
              <td>${entityName}</td>
            </tr>
            <tr>
              <td>Investment</td>
              <td>${transaction.transaction_type === 'BUY' ? 'Purchase' : 'Sale'}</td>
            </tr>
            <tr>
              <td>Name of the Investment</td>
              <td>${shareInfo}</td>
            </tr>
          </table>

          <table>
            <thead>
              <tr>
                <th rowspan="2">Date of Transaction</th>
                <th rowspan="2">Share</th>
                <th rowspan="2">Buy/Sell</th>
                <th rowspan="2">Number of Shares</th>
                <th colspan="2" class="green-bg">Per Share Sales Price / Purchase Cost (Gross)</th>
                <th rowspan="2" class="green-bg">Per Share Sales Price / Purchase Cost (Net)</th>
                <th rowspan="2">Purchase/ Sale Value</th>
                <th rowspan="2">CDS Acc. No</th>
                <th rowspan="2">Broker Name</th>
              </tr>
              <tr>
                <th class="green-bg" colspan="2"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${new Date(transaction.transaction_date).toLocaleDateString()}</td>
                <td>${shareInfo}</td>
                <td>${transaction.transaction_type}</td>
                <td>${Number(transaction.no_of_shares).toLocaleString()}</td>
                <td class="green-bg" colspan="2">${Number(transaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="green-bg">${Number(transaction.net_price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>${Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>${cdsAccount}</td>
                <td>${brokerName}</td>
              </tr>
              <tr class="total-row">
                <td colspan="2">Total Sales Values /Purchase Values</td>
                <td>${transaction.transaction_type}</td>
                <td colspan="3" class="green-text">${Number(transaction.no_of_shares).toLocaleString()} shares</td>
                <td colspan="4" class="green-text">LKR ${Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td colspan="10" style="border: none; padding: 20px 8px;"></td>
              </tr>
              <tr>
                <td colspan="3" style="border-right: none; font-weight: normal;">Authorized by</td>
                <td colspan="7" style="border-left: none;">..........................</td>
              </tr>
              <tr>
                <td colspan="3" style="border-right: none; font-weight: normal;">Authorized date</td>
                <td colspan="7" style="border-left: none;">..........................</td>
              </tr>
              <tr>
                <td colspan="3" style="border-right: none; font-weight: normal;">Generate Date</td>
                <td colspan="7" style="border-left: none;">${currentDate}</td>
              </tr>
            </tbody>
          </table>

          <script>
            setTimeout(function() {
              window.print();
            }, 500);
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the document');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  function getTimeRemaining(transaction: Transaction): string {
    if (!transaction.approval_expires_at) return '';

    const now = new Date();
    const expiresAt = new Date(transaction.approval_expires_at);
    const diffMs = expiresAt.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      return `${days}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  }

  const filteredTransactions = transactions.filter(txn => {
    const entityName = getEntityName(txn.entity_id).toLowerCase();
    const shareInfo = getShareInfo(txn.share_id).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = entityName.includes(searchLower) || shareInfo.includes(searchLower);

    if (activeTab === 'pending') {
      return matchesSearch && txn.approval_status === 'PENDING_APPROVAL';
    }
    return matchesSearch;
  });

  const key = `${formData.entity_id}-${formData.share_id}`;
  const currentBalance = shareBalances.get(key);
  const entityBalance = formData.entity_id ? getEntityBalance(formData.entity_id) : 0;
  const requiredAmount = calculateTotalAmountNet();

  const availableEntityBrokers = formData.entity_id
    ? entityBrokers.filter(eb =>
        eb.entity_id === formData.entity_id &&
        eb.relationship_type === formData.relationship_type
      )
    : [];

  const selectedEntityBroker = entityBrokers.find(eb => eb.id === formData.entity_broker_id);

  const availableBrokerNames = formData.relationship_type === 'Custodian' ? brokers : [];

  const pendingCount = transactions.filter(t => t.approval_status === 'PENDING_APPROVAL').length;

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
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">New Transaction</span>
          </button>
        </div>
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
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 p-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Transactions
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                activeTab === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Pending Approvals</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Total</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                    LKR {Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        transaction.approval_status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        transaction.approval_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        transaction.approval_status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {transaction.approval_status === 'PENDING_APPROVAL' ? 'PENDING' : transaction.approval_status}
                      </span>
                      {transaction.offline_approval && (
                        <span className="text-xs text-blue-600 font-medium">Offline</span>
                      )}
                      {transaction.approval_status === 'PENDING_APPROVAL' && getTimeRemaining(transaction) && (
                        <span className={`text-xs font-medium ${
                          getTimeRemaining(transaction) === 'Expired' ? 'text-red-600' : 'text-orange-600'
                        }`}>
                          {getTimeRemaining(transaction)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedTransaction(transaction);
                          setShowViewModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handlePrintTransaction(transaction)}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Print Transaction"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleCancelTransaction(transaction)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Cancel Transaction"
                        disabled={submitting}
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
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
          <div className={`rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col transition-colors ${
            formData.transaction_type === 'BUY' ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <div className={`p-6 border-b ${
              formData.transaction_type === 'BUY' ? 'border-green-200 bg-green-100' : 'border-red-200 bg-red-100'
            }`}>
              <h2 className="text-2xl font-bold text-gray-900">
                New {formData.transaction_type === 'BUY' ? 'Buy' : 'Sell'} Transaction
              </h2>
            </div>
            <form onSubmit={handleCreateTransaction} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-6 overflow-y-auto bg-white">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Entity <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={formData.entity_id}
                      onChange={(e) => setFormData({ ...formData, entity_id: e.target.value, entity_broker_id: '' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Entity</option>
                      {entities.map(entity => (
                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Type <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.relationship_type}
                        onChange={(e) => setFormData({ ...formData, relationship_type: e.target.value, entity_broker_id: '', selected_broker_name_id: '' })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="Broker">Broker</option>
                        <option value="Custodian">Custodian</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {formData.relationship_type === 'Custodian' ? 'CDS Account ID' : 'Broker Account ID'} <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.entity_broker_id}
                        onChange={(e) => setFormData({ ...formData, entity_broker_id: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        disabled={!formData.entity_id}
                      >
                        <option value="">Select Account</option>
                        {availableEntityBrokers.map(eb => (
                          <option key={eb.id} value={eb.id}>
                            {eb.relationship_type === 'Custodian' ? eb.custodian_account_number : eb.broker_account_number}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Broker Name {formData.relationship_type === 'Custodian' && <span className="text-red-600">*</span>}
                      </label>
                      {formData.relationship_type === 'Custodian' ? (
                        <select
                          value={formData.selected_broker_name_id}
                          onChange={(e) => setFormData({ ...formData, selected_broker_name_id: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select Broker</option>
                          {availableBrokerNames.map(broker => (
                            <option key={broker.id} value={broker.id}>{broker.broker_name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={selectedEntityBroker ? getBrokerName(selectedEntityBroker.broker_id) : ''}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                          disabled
                        />
                      )}
                    </div>
                  </div>

                  {selectedEntityBroker && selectedEntityBroker.bank && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h3 className="text-sm font-bold text-blue-900 mb-3">Bank Account Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-600">Bank Name</p>
                          <p className="text-sm font-semibold text-gray-900">{selectedEntityBroker.bank.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Account Number</p>
                          <p className="text-sm font-semibold text-gray-900">{selectedEntityBroker.bank_account_number || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Facility Limit</p>
                          <p className="text-sm font-semibold text-gray-900">
                            LKR {selectedEntityBroker.facility_limit ? Number(selectedEntityBroker.facility_limit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Available Balance</p>
                          <p className="text-sm font-bold text-green-700">
                            LKR {selectedEntityBroker.bank.balance ? Number(selectedEntityBroker.bank.balance).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {entityBalance > 0 && requiredAmount > 0 && formData.transaction_type === 'BUY' && (
                    <div className={`p-4 rounded-lg border-2 ${
                      entityBalance >= requiredAmount * 1.5 ? 'bg-green-50 border-green-300' :
                      entityBalance >= requiredAmount ? 'bg-yellow-50 border-yellow-300' :
                      'bg-red-50 border-red-300'
                    }`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Available Balance</p>
                          <p className={`text-2xl font-bold ${getBalanceColor(entityBalance, requiredAmount)}`}>
                            LKR {entityBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-700">Required</p>
                          <p className="text-lg font-bold text-gray-900">
                            LKR {requiredAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className={`text-xs font-semibold mt-1 ${getBalanceColor(entityBalance, requiredAmount)}`}>
                            {getBalanceStatus(entityBalance, requiredAmount)}
                          </p>
                        </div>
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
                        <option value="DAY">Day Order</option>
                        <option value="GTC">GTC (Good Till Cancelled)</option>
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

                    <div className="col-span-2">
                      <div className="flex items-center space-x-4 mb-2">
                        <label className="block text-sm font-semibold text-gray-700">
                          Brokerage Fee Type
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.use_negotiated_fee}
                            onChange={(e) => setFormData({ ...formData, use_negotiated_fee: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Use Negotiated Fee</span>
                        </label>
                      </div>
                      <select
                        value={formData.brokerage_fee_type_id}
                        onChange={(e) => {
                          const feeType = brokerageFeeTypes.find(ft => ft.id === e.target.value);
                          if (feeType) {
                            setFormData({ ...formData, brokerage_fee_type_id: e.target.value, brokerage_fee_rate: feeType.rate.toString() });
                            calculateFees(feeType.rate);
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={formData.use_negotiated_fee}
                      >
                        <option value="">Auto-select based on amount</option>
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
                        disabled={!formData.use_negotiated_fee}
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

      {showViewModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Transaction Details</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Entity</p>
                  <p className="text-base font-bold text-gray-900 mt-1">{getEntityName(selectedTransaction.entity_id)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Transaction Date</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    {new Date(selectedTransaction.transaction_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Transaction Type</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      selectedTransaction.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedTransaction.transaction_type}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Order Type</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">{selectedTransaction.order_type}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Share</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">{getShareInfo(selectedTransaction.share_id)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Number of Shares</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    {Number(selectedTransaction.no_of_shares).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Price Per Share</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    LKR {Number(selectedTransaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Amount (Gross)</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    LKR {Number(selectedTransaction.total_amount_gross).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Brokerage Fee</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    LKR {Number(selectedTransaction.fees).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    {selectedTransaction.brokerage_fee_rate && (
                      <span className="text-sm text-gray-600 ml-2">
                        ({selectedTransaction.brokerage_fee_rate}%)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Net Price Per Share</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    LKR {Number(selectedTransaction.net_price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Amount (Net)</p>
                  <p className="text-lg font-bold text-blue-900 mt-1">
                    LKR {Number(selectedTransaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">CDS/Broker Account</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">{selectedTransaction.cds_account_id || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Approval Status</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      selectedTransaction.approval_status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      selectedTransaction.approval_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      selectedTransaction.approval_status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedTransaction.approval_status}
                    </span>
                    {selectedTransaction.offline_approval && (
                      <span className="ml-2 text-sm text-blue-600 font-medium">(Offline Approval)</span>
                    )}
                  </p>
                </div>
                {selectedTransaction.approval_document_name && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-500">Approval Document</p>
                    <a
                      href={selectedTransaction.approval_document_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-semibold text-blue-600 hover:text-blue-800 mt-1 inline-block"
                    >
                      {selectedTransaction.approval_document_name}
                    </a>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedTransaction(null);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
