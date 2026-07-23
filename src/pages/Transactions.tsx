import { Plus, Search, TrendingUp, TrendingDown, XCircle, Eye, Printer, Clock, Mail, Upload, FileText, X, Trash2, CheckCircle, Pencil } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, fetchRecordForAudit } from '../lib/auditLog';

const ALL_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'MANUAL_APPROVED', label: 'Manual Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

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
  day_trade: boolean | null;
  created_at: string;
}

interface Entity {
  id: string;
  name: string;
  current_balance: number;
  cc_email: string | null;
  cc_email_2: string | null;
  cc_email_3: string | null;
}

interface Share {
  id: string;
  share_name: string;
  ticker: string;
}

interface Bank {
  id: string;
  name: string;
  account_number: string;
  balance: number;
  entity_id: string | null;
  facility_limit: number | null;
}

interface Broker {
  id: string;
  broker_name: string;
  contact_person_email: string | null;
}

interface FeeBreakdownItem {
  name: string;
  rate: number;
}

interface BrokerageFeeType {
  id: string;
  name: string;
  rate: number;
  min_price: number | null;
  max_price: number | null;
  fee_breakdown_items: FeeBreakdownItem[];
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

interface BulkRow {
  transaction_id: string;
  entity_id: string;
  share_id: string;
  transaction_type: 'Buy' | 'Sell';
  settlement_date: string;
  no_of_shares: string;
  price_per_share: string;
  cds_account: string;
}

function emptyBulkRow(): BulkRow {
  return {
    transaction_id: '',
    entity_id: '',
    share_id: '',
    transaction_type: 'Buy',
    settlement_date: new Date().toISOString().split('T')[0],
    no_of_shares: '',
    price_per_share: '',
    cds_account: '',
  };
}

export function Transactions() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([emptyBulkRow()]);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [ccAddresses, setCcAddresses] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
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
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [feeBreakdownItems, setFeeBreakdownItems] = useState<FeeBreakdownItem[]>([]);
  // When amount straddles the 100M threshold, aboveTierItems holds the above-tier breakdown
  const [aboveTierItems, setAboveTierItems] = useState<FeeBreakdownItem[]>([]);
  const [sharesInputFocused, setSharesInputFocused] = useState(false);
  const [latestSharePrice, setLatestSharePrice] = useState<{ price: number; date: string } | null>(null);

  const [formData, setFormData] = useState({
    entity_id: '',
    relationship_type: 'Broker',
    entity_broker_id: '',
    selected_broker_name_id: '',
    selected_bank_id: '',
    share_id: '',
    transaction_type: 'BUY',
    order_type: 'DAY',
    transaction_date: new Date().toISOString().split('T')[0],
    no_of_shares: '',
    price_per_share: '',
    brokerage_fee_type_id: '',
    brokerage_fee_rate: '',
    fees: '',
    use_negotiated_fee: false,
    day_trade: false
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
    if (!formData.share_id) { setLatestSharePrice(null); return; }
    supabase
      .from('daily_share_prices')
      .select('share_price, effective_date')
      .eq('share_id', formData.share_id)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setLatestSharePrice(data ? { price: Number(data.share_price), date: data.effective_date } : null);
      });
  }, [formData.share_id]);

  useEffect(() => {
    if (formData.no_of_shares && formData.price_per_share) {
      const grossAmount = parseFloat(formData.no_of_shares) * parseFloat(formData.price_per_share);

      if (!formData.use_negotiated_fee) {
        // Sort active tiers by min_price to identify the lower and upper tiers
        const sortedTiers = [...brokerageFeeTypes].sort((a, b) => (a.min_price ?? 0) - (b.min_price ?? 0));
        const belowTier = sortedTiers[0] ?? null;
        const aboveTier = sortedTiers[1] ?? null;
        const threshold = belowTier?.max_price ?? null;

        if (belowTier && aboveTier && threshold !== null && grossAmount > threshold) {
          // Split: compute fees on the threshold amount at below-tier rates, rest at above-tier rates
          const belowBreakdown = Array.isArray(belowTier.fee_breakdown_items)
            ? belowTier.fee_breakdown_items.map(i => ({ ...i }))
            : [];
          const aboveBreakdown = Array.isArray(aboveTier.fee_breakdown_items)
            ? aboveTier.fee_breakdown_items.map(i => ({ ...i }))
            : [];

          setFeeBreakdownItems(belowBreakdown);
          setAboveTierItems(aboveBreakdown);

          const belowFees = belowBreakdown.reduce((sum, item) => sum + (threshold * item.rate) / 100, 0);
          const excess = grossAmount - threshold;
          const aboveFees = aboveBreakdown.reduce((sum, item) => sum + (excess * item.rate) / 100, 0);
          const totalFees = belowFees + aboveFees;
          const blendedRate = grossAmount > 0 ? (totalFees / grossAmount) * 100 : 0;

          setFormData(prev => ({
            ...prev,
            brokerage_fee_type_id: belowTier.id,
            brokerage_fee_rate: blendedRate.toFixed(6),
            fees: totalFees.toFixed(2),
          }));
        } else {
          // Single tier: find whichever tier matches the full gross amount
          const matchingFeeType = brokerageFeeTypes.find(ft => {
            const minOk = ft.min_price === null || grossAmount >= ft.min_price;
            const maxOk = ft.max_price === null || grossAmount <= ft.max_price;
            return minOk && maxOk;
          });

          if (matchingFeeType) {
            const breakdown = Array.isArray(matchingFeeType.fee_breakdown_items)
              ? matchingFeeType.fee_breakdown_items.map(i => ({ ...i }))
              : [];
            setFeeBreakdownItems(breakdown);
            setAboveTierItems([]);

            const fees = breakdown.reduce((sum, item) => sum + (grossAmount * item.rate) / 100, 0);
            setFormData(prev => ({
              ...prev,
              brokerage_fee_type_id: matchingFeeType.id,
              brokerage_fee_rate: matchingFeeType.rate.toString(),
              fees: fees.toFixed(2),
            }));
          }
        }
      } else if (formData.brokerage_fee_rate) {
        calculateFees(parseFloat(formData.brokerage_fee_rate));
      }
    }
  }, [formData.no_of_shares, formData.price_per_share, formData.use_negotiated_fee, brokerageFeeTypes]);

  async function loadData() {
    try {
      setLoading(true);

      const [transactionsRes, entitiesRes, sharesRes, banksRes, brokersRes, brokerageRes, entityBrokersRes, ledgerRes] = await Promise.all([
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('entities').select('id, name, current_balance, cc_email, cc_email_2, cc_email_3').order('name'),
        supabase.from('shares').select('id, share_name, ticker').order('share_name'),
        supabase.from('banks').select('id, name, account_number, balance, entity_id, facility_limit').order('name'),
        supabase.from('brokers').select('id, broker_name, contact_person_email').order('broker_name'),
        supabase.from('brokerage_fee_types').select('*').eq('is_active', true).order('min_price'),
        supabase.from('entity_brokers').select('*, bank:banks(id, name, balance)').eq('is_active', true),
        supabase.from('cash_balance_ledger').select('bank_id, type, amount')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      if (banksRes.error) throw banksRes.error;
      if (brokersRes.error) throw brokersRes.error;
      if (brokerageRes.error) throw brokerageRes.error;
      if (entityBrokersRes.error) throw entityBrokersRes.error;

      const bankBalanceMap = new Map<string, number>();
      (ledgerRes.data || []).forEach((entry: any) => {
        if (!entry.bank_id) return;
        const delta = entry.type === 'Addition' ? Number(entry.amount) : -Number(entry.amount);
        bankBalanceMap.set(entry.bank_id, (bankBalanceMap.get(entry.bank_id) || 0) + delta);
      });

      const banksWithBalance = (banksRes.data || []).map((b: any) => ({
        ...b,
        balance: bankBalanceMap.has(b.id) ? bankBalanceMap.get(b.id) : Number(b.balance || 0)
      }));

      const entityBrokersWithBalance = (entityBrokersRes.data || []).map((eb: any) => ({
        ...eb,
        bank: eb.bank ? {
          ...eb.bank,
          balance: eb.bank.id && bankBalanceMap.has(eb.bank.id) ? bankBalanceMap.get(eb.bank.id) : Number(eb.bank.balance || 0)
        } : eb.bank
      }));

      setTransactions(transactionsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
      setBanks(banksWithBalance);
      setBrokers(brokersRes.data || []);
      setBrokerageFeeTypes(brokerageRes.data || []);
      setEntityBrokers(entityBrokersWithBalance);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function calculateShareBalance(entityId: string, shareId: string) {
    try {
      const [txnRes, openingRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('transaction_type, no_of_shares, price_per_share, net_price_per_share')
          .eq('entity_id', entityId)
          .eq('share_id', shareId),
        supabase
          .from('entity_share_opening_balances')
          .select('opening_shares, average_purchase_cost')
          .eq('entity_id', entityId)
          .eq('share_id', shareId)
          .maybeSingle(),
      ]);

      if (txnRes.error) throw txnRes.error;

      let totalShares = 0;
      let totalCost = 0;

      if (openingRes.data) {
        const openShares = Number(openingRes.data.opening_shares) || 0;
        const openCost = Number(openingRes.data.average_purchase_cost) || 0;
        totalShares += openShares;
        totalCost += openShares * openCost;
      }

      (txnRes.data || []).forEach(txn => {
        const shares = Number(txn.no_of_shares) || 0;
        // Use net_price_per_share (includes fees) for true cost basis; fall back to gross if missing
        const price = Number(txn.net_price_per_share) || Number(txn.price_per_share) || 0;

        if (txn.transaction_type === 'BUY') {
          totalShares += shares;
          totalCost += shares * price;
        } else if (txn.transaction_type === 'SELL') {
          const avgBefore = totalShares > 0 ? totalCost / totalShares : 0;
          totalShares -= shares;
          totalCost -= shares * avgBefore;
          if (totalShares <= 0) {
            totalShares = Math.max(0, totalShares);
            totalCost = 0;
          }
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

  function calculateFeesFromBreakdown(items: FeeBreakdownItem[], aboveItems?: FeeBreakdownItem[]) {
    const shares = parseFloat(formData.no_of_shares) || 0;
    const price = parseFloat(formData.price_per_share) || 0;
    const grossAmount = shares * price;

    const sortedTiers = [...brokerageFeeTypes].sort((a, b) => (a.min_price ?? 0) - (b.min_price ?? 0));
    const threshold = sortedTiers[0]?.max_price ?? null;
    const currentAboveItems = aboveItems ?? aboveTierItems;

    let fees: number;
    if (threshold !== null && grossAmount > threshold && currentAboveItems.length > 0) {
      const belowFees = items.reduce((sum, item) => sum + (threshold * item.rate) / 100, 0);
      const excess = grossAmount - threshold;
      const aboveFees = currentAboveItems.reduce((sum, item) => sum + (excess * item.rate) / 100, 0);
      fees = belowFees + aboveFees;
    } else {
      fees = items.reduce((sum, item) => sum + (grossAmount * item.rate) / 100, 0);
    }

    setFormData(prev => ({ ...prev, fees: fees.toFixed(2) }));
  }

  function calculateFees(rate: number) {
    const shares = parseFloat(formData.no_of_shares) || 0;
    const price = parseFloat(formData.price_per_share) || 0;
    const grossAmount = shares * price;
    const fees = (grossAmount * rate) / 100;
    setFormData(prev => ({ ...prev, fees: fees.toFixed(2) }));
  }

  function handleDayTradeChange(checked: boolean) {
    setFormData(prev => ({ ...prev, day_trade: checked }));
    if (checked && feeBreakdownItems.length > 0) {
      const updatedBelow = feeBreakdownItems.map(item => ({
        ...item,
        rate: item.name.toLowerCase().includes('levy') ? item.rate : 0
      }));
      const updatedAbove = aboveTierItems.map(item => ({
        ...item,
        rate: item.name.toLowerCase().includes('levy') ? item.rate : 0
      }));
      setFeeBreakdownItems(updatedBelow);
      setAboveTierItems(updatedAbove);
      calculateFeesFromBreakdown(updatedBelow, updatedAbove);
    }
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
      const newNetPrice = calculateNetPricePerShare();
      const totalCost = (balance.total_shares * balance.avg_cost) + (newShares * newNetPrice);
      return totalShares > 0 ? totalCost / totalShares : 0;
    } else {
      return balance.avg_cost;
    }
  }

  function calculateSellPnL() {
    const key = `${formData.entity_id}-${formData.share_id}`;
    const balance = shareBalances.get(key);
    if (!balance || balance.avg_cost === 0) return null;
    // Net proceeds per share (sale price minus fees) vs avg cost basis
    const netSalePrice = calculateNetPricePerShare();
    const numShares = parseFloat(formData.no_of_shares) || 0;
    const pnlPerShare = netSalePrice - balance.avg_cost;
    const totalPnl = pnlPerShare * numShares;
    return { avgCost: balance.avg_cost, pnlPerShare, totalPnl };
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
    return share ? `${share.ticker} - ${share.share_name}` : 'Unknown';
  }

  function resetForm() {
    setFormData({
      entity_id: '',
      relationship_type: 'Broker',
      entity_broker_id: '',
      selected_broker_name_id: '',
      selected_bank_id: '',
      share_id: '',
      transaction_type: 'BUY',
      order_type: 'DAY',
      transaction_date: new Date().toISOString().split('T')[0],
      no_of_shares: '',
      price_per_share: '',
      brokerage_fee_type_id: '',
      brokerage_fee_rate: '',
      fees: '',
      use_negotiated_fee: false,
      day_trade: false
    });
    setFeeBreakdownItems([]);
    setAboveTierItems([]);
    setEditingDraftId(null);
    setLatestSharePrice(null);
  }

  function handleEditDraft(transaction: Transaction) {
    const eb = entityBrokers.find(eb =>
      eb.entity_id === transaction.entity_id && eb.broker_id === transaction.broker_id
    );
    setFormData({
      entity_id: transaction.entity_id,
      relationship_type: eb?.relationship_type || 'Broker',
      entity_broker_id: eb?.id || '',
      selected_broker_name_id: transaction.broker_id || '',
      selected_bank_id: transaction.bank_id || '',
      share_id: transaction.share_id,
      transaction_type: transaction.transaction_type,
      order_type: transaction.order_type || 'DAY',
      transaction_date: transaction.transaction_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      no_of_shares: String(transaction.no_of_shares),
      price_per_share: String(transaction.price_per_share),
      brokerage_fee_type_id: transaction.brokerage_fee_type_id || '',
      brokerage_fee_rate: transaction.brokerage_fee_rate != null ? String(transaction.brokerage_fee_rate) : '',
      fees: String(transaction.fees),
      use_negotiated_fee: false,
      day_trade: transaction.day_trade || false,
    });
    setFeeBreakdownItems([]);
    setEditingDraftId(transaction.id);
    setShowModal(true);
  }

  async function handleCreateTransaction(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.entity_id || !formData.share_id || !formData.no_of_shares || !formData.price_per_share) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.transaction_type === 'BUY') {
      const entity = entities.find(e => e.id === formData.entity_id);
      const totalRequired = calculateTotalAmountNet ? calculateTotalAmountNet() : 0;
      if (entity && totalRequired > 0 && entity.current_balance < totalRequired) {
        alert('Insufficient funds to create the transaction.');
        return;
      }
    }

    if (formData.transaction_type === 'SELL') {
      const balKey = `${formData.entity_id}-${formData.share_id}`;
      const bal = shareBalances.get(balKey);
      const available = bal?.total_shares ?? 0;
      const requested = parseFloat(formData.no_of_shares) || 0;
      if (requested > available) {
        alert(`Insufficient shares: you hold ${available.toLocaleString()} share${available !== 1 ? 's' : ''} but are trying to sell ${requested.toLocaleString()}.`);
        return;
      }
    }

    try {
      setSubmitting(true);

      const totalAmountGross = calculateTotalAmountGross();
      const netPricePerShare = calculateNetPricePerShare();
      const totalAmountNet = calculateTotalAmountNet();

      const selectedEntityBroker = entityBrokers.find(eb => eb.id === formData.entity_broker_id);

      const txnPayload = {
        entity_id: formData.entity_id,
        broker_id: selectedEntityBroker?.broker_id || null,
        bank_id: formData.selected_bank_id || null,
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
        approval_status: 'DRAFT',
        day_trade: formData.day_trade
      };

      let error;
      let oldRecord: Record<string, any> | null = null;
      if (editingDraftId) {
        oldRecord = await fetchRecordForAudit('transactions', editingDraftId);
        ({ error } = await supabase.from('transactions').update(txnPayload).eq('id', editingDraftId));
      } else {
        ({ error } = await supabase.from('transactions').insert(txnPayload).select('id').maybeSingle());
      }

      if (error) throw error;

      if (editingDraftId && oldRecord) {
        logAudit({ tableName: 'transactions', recordId: editingDraftId, action: 'UPDATE', performedBy: user?.email || 'system', oldValues: oldRecord, newValues: { ...oldRecord, ...txnPayload }, entityId: txnPayload.entity_id });
      } else {
        logAudit({ tableName: 'transactions', recordId: txnPayload.entity_id || 'new', action: 'CREATE', performedBy: user?.email || 'system', newValues: txnPayload, entityId: txnPayload.entity_id });
      }

      alert(editingDraftId ? 'Draft updated successfully' : 'Transaction created successfully');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      const msg: string = error?.message || error?.error_description || '';
      if (
        msg.toLowerCase().includes('insufficient') ||
        msg.toLowerCase().includes('balance') ||
        msg.toLowerCase().includes('fund')
      ) {
        alert('Insufficient funds to create the transaction.');
      } else {
        alert('Failed to create transaction');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelTransaction(transaction: Transaction) {
    const reason = prompt('Please enter a reason for cancellation:');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('A cancellation reason is required.');
      return;
    }
    if (!confirm('Are you sure you want to cancel this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('transactions')
        .update({
          approval_status: 'CANCELLED',
          rejection_reason: reason.trim(),
          approval_notes: `Cancelled by user on ${new Date().toLocaleDateString()}. Reason: ${reason.trim()}`,
        })
        .eq('id', transaction.id);

      if (error) throw error;

      // Send email notification to broker if one is assigned
      if (transaction.broker_id) {
        const broker = brokers.find(b => b.id === transaction.broker_id);
        if (broker?.contact_person_email) {
          const txnData = getTransactionEmailData(transaction);
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-transaction-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: broker.contact_person_email,
              transaction: { ...txnData, note: `CANCELLATION NOTICE — Reason: ${reason.trim()}` },
            }),
          }).catch(err => console.error('Broker email failed:', err));
        }
      }

      alert('Transaction cancelled successfully. Please notify the broker.');
      loadData();
    } catch (error) {
      console.error('Error cancelling transaction:', error);
      alert('Failed to cancel transaction');
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenUploadModal(transaction: Transaction) {
    setSelectedTransaction(transaction);
    setUploadFile(null);
    setShowUploadModal(true);
  }

  async function handleUploadDocument() {
    if (!selectedTransaction || !uploadFile) {
      alert('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);

      const fileExt = uploadFile.name.split('.').pop();
      const filePath = `${selectedTransaction.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('transaction-documents')
        .upload(filePath, uploadFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('transaction-documents')
        .getPublicUrl(filePath);

      const { data: signedData } = await supabase.storage
        .from('transaction-documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      const documentUrl = signedData?.signedUrl || publicUrl;

      const updates: Record<string, unknown> = {
        approval_document_url: documentUrl,
        approval_document_name: uploadFile.name,
        approval_document_uploaded_at: new Date().toISOString()
      };

      if (selectedTransaction.approval_status === 'PENDING_APPROVAL') {
        updates.approval_status = 'MANUAL_APPROVED';
        updates.approved_by = user?.email || 'system';
        updates.approval_date = new Date().toISOString();
        updates.approval_notes = 'Approved upon document upload';
      }

      const { error: updateError } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', selectedTransaction.id);

      if (updateError) throw updateError;

      alert(selectedTransaction.approval_status === 'PENDING_APPROVAL'
        ? 'Document uploaded and transaction approved successfully'
        : 'Document uploaded successfully'
      );
      setShowUploadModal(false);
      setUploadFile(null);
      setSelectedTransaction(null);
      loadData();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveDocument(transaction: Transaction) {
    if (!confirm('Are you sure you want to remove this document?')) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          approval_document_url: null,
          approval_document_name: null,
          approval_document_uploaded_at: null,
          approval_document_uploaded_by: null
        })
        .eq('id', transaction.id);

      if (error) throw error;

      loadData();
    } catch (error) {
      console.error('Error removing document:', error);
      alert('Failed to remove document');
    }
  }

  function updateBulkRow(idx: number, field: keyof BulkRow, value: string) {
    setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function addBulkRow() {
    setBulkRows(prev => [...prev, emptyBulkRow()]);
  }

  function removeBulkRow(idx: number) {
    setBulkRows(prev => prev.length === 1 ? [emptyBulkRow()] : prev.filter((_, i) => i !== idx));
  }

  async function handleSaveBulk() {
    const validRows = bulkRows.filter(r => r.entity_id && r.share_id && r.no_of_shares && r.price_per_share);
    if (validRows.length === 0) {
      alert('Please fill in at least one row with Entity, Share, Shares, and Price.');
      return;
    }

    setIsSavingBulk(true);
    try {
      for (const row of validRows) {
        const qty = parseFloat(row.no_of_shares) || 0;
        const price = parseFloat(row.price_per_share) || 0;
        const grossAmount = qty * price;

        const { error } = await supabase.from('transactions').insert({
          entity_id: row.entity_id,
          share_id: row.share_id,
          transaction_type: row.transaction_type,
          order_type: 'DAY',
          transaction_date: row.settlement_date,
          no_of_shares: qty,
          price_per_share: price,
          total_amount_gross: grossAmount,
          fees: 0,
          net_price_per_share: price,
          total_amount: grossAmount,
          approval_status: 'MANUAL_APPROVED',
          cds_account_id: row.cds_account || null,
          ...(row.transaction_id ? { id: undefined } : {}),
        });

        if (error) throw error;
      }

      await loadData();
      setShowBulkModal(false);
      setBulkRows([emptyBulkRow()]);
      alert(`${validRows.length} transaction${validRows.length === 1 ? '' : 's'} saved successfully.`);
    } catch (error) {
      console.error('Error saving bulk transactions:', error);
      alert('Failed to save transactions. Please try again.');
    } finally {
      setIsSavingBulk(false);
    }
  }

  function handlePrintTransaction(transaction: Transaction) {
    const entityName = getEntityName(transaction.entity_id);
    const shareInfo = getShareInfo(transaction.share_id);

    const entityBroker = entityBrokers.find(eb =>
      eb.entity_id === transaction.entity_id && (
        (transaction.broker_id && eb.broker_id === transaction.broker_id) ||
        (transaction.cds_account_id && (
          eb.broker_account_number === transaction.cds_account_id ||
          eb.custodian_account_number === transaction.cds_account_id
        ))
      )
    );
    const fallbackEntityBroker = !transaction.broker_id && !entityBroker?.broker_id
      ? entityBrokers.find(eb => eb.entity_id === transaction.entity_id && eb.broker_id)
      : null;
    const cdsAccount = transaction.cds_account_id || entityBroker?.custodian_account_number || 'N/A';
    const brokerName = transaction.broker_id
      ? getBrokerName(transaction.broker_id)
      : entityBroker?.broker_id
        ? getBrokerName(entityBroker.broker_id)
        : fallbackEntityBroker?.broker_id
          ? getBrokerName(fallbackEntityBroker.broker_id)
          : (entityBroker as any)?.broker_text || 'N/A';
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
              background-color: #f5f5f5;
              font-weight: bold;
            }
            .total-row {
              font-weight: bold;
              background-color: #f5f5f5;
            }
            .total-row .green-text {
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
                <th>Date of Transaction</th>
                <th>Share</th>
                <th>Buy/Sell</th>
                <th>Number of Shares</th>
                <th>Per Share Sales Price / Purchase Cost (Gross)</th>
                <th>Per Share Sales Price / Purchase Cost (Net)</th>
                <th>Purchase/ Sale Value</th>
                <th>CDS Acc. No</th>
                <th>Broker Name</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${new Date(transaction.transaction_date).toLocaleDateString()}</td>
                <td>${shareInfo}</td>
                <td>${transaction.transaction_type}</td>
                <td>${Number(transaction.no_of_shares).toLocaleString()}</td>
                <td>${Number(transaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                <td>${Number(transaction.net_price_per_share).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                <td>${Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>${cdsAccount}</td>
                <td>${brokerName}</td>
              </tr>
              <tr class="total-row">
                <td colspan="2">Total Sales Values /Purchase Values</td>
                <td>${transaction.transaction_type}</td>
                <td colspan="2" class="green-text">${Number(transaction.no_of_shares).toLocaleString()} shares</td>
                <td colspan="4" class="green-text">LKR ${Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td colspan="9" style="border: none; padding: 20px 8px;"></td>
              </tr>
              <tr>
                <td colspan="3" style="border-right: none; font-weight: normal;">Authorized by</td>
                <td colspan="6" style="border-left: none;">..........................</td>
              </tr>
              <tr>
                <td colspan="3" style="border-right: none; font-weight: normal;">Authorized date</td>
                <td colspan="6" style="border-left: none;">..........................</td>
              </tr>
              <tr>
                <td colspan="3" style="border-right: none; font-weight: normal;">Generate Date</td>
                <td colspan="6" style="border-left: none;">${currentDate}</td>
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

  function handleEmailTransaction(transaction: Transaction) {
    setSelectedTransaction(transaction);
    const broker = transaction.broker_id ? brokers.find(b => b.id === transaction.broker_id) : null;
    setEmailAddress(broker?.contact_person_email || '');
    setCcAddresses([]);
    setCcInput('');
    setEmailNote('');
    setShowEmailModal(true);
  }

  function handleCancelNotifyBroker(transaction: Transaction) {
    setSelectedTransaction(transaction);
    const broker = transaction.broker_id ? brokers.find(b => b.id === transaction.broker_id) : null;
    setEmailAddress(broker?.contact_person_email || '');
    const entity = entities.find(e => e.id === transaction.entity_id);
    const autoCc: string[] = [];
    if (entity?.cc_email) autoCc.push(entity.cc_email);
    if (entity?.cc_email_2) autoCc.push(entity.cc_email_2);
    if (entity?.cc_email_3) autoCc.push(entity.cc_email_3);
    setCcAddresses(autoCc);
    setCcInput('');
    setEmailNote('');
    setShowEmailModal(true);
  }

  async function sendEmail() {
    if (!selectedTransaction || !emailAddress.trim()) {
      alert('Please enter an email address');
      return;
    }

    if (!emailAddress.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      setSendingEmail(true);

      const entityName = getEntityName(selectedTransaction.entity_id);
      const share = shares.find(s => s.id === selectedTransaction.share_id);
      const bank = selectedTransaction.bank_id ? banks.find(b => b.id === selectedTransaction.bank_id) : null;
      const brokerageFeeType = selectedTransaction.brokerage_fee_type_id
        ? brokerageFeeTypes.find(ft => ft.id === selectedTransaction.brokerage_fee_type_id)
        : null;

      const entityBroker = entityBrokers.find(eb =>
        eb.entity_id === selectedTransaction.entity_id && (
          (selectedTransaction.broker_id && eb.broker_id === selectedTransaction.broker_id) ||
          (selectedTransaction.cds_account_id && (
            eb.broker_account_number === selectedTransaction.cds_account_id ||
            eb.custodian_account_number === selectedTransaction.cds_account_id
          ))
        )
      );
      const fallbackEntityBroker = !selectedTransaction.broker_id && !entityBroker?.broker_id
        ? entityBrokers.find(eb => eb.entity_id === selectedTransaction.entity_id && eb.broker_id)
        : null;

      const brokerName = selectedTransaction.broker_id
        ? getBrokerName(selectedTransaction.broker_id)
        : entityBroker?.broker_id
          ? getBrokerName(entityBroker.broker_id)
          : fallbackEntityBroker?.broker_id
            ? getBrokerName(fallbackEntityBroker.broker_id)
            : (entityBroker as any)?.broker_text || 'N/A';

      const transactionData = {
        entity: entityName,
        transaction_type: selectedTransaction.transaction_type,
        share: share?.share_name || 'N/A',
        ticker: share?.ticker || 'N/A',
        transaction_date: new Date(selectedTransaction.transaction_date).toLocaleDateString(),
        cds_acc_type: entityBroker?.relationship_type || 'N/A',
        cds_acc_no: selectedTransaction.cds_account_id || entityBroker?.custodian_account_number || 'N/A',
        order_type: selectedTransaction.order_type,
        no_of_shares: Number(selectedTransaction.no_of_shares).toLocaleString(),
        gross_price_per_share: Number(selectedTransaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        net_price_per_share: Number(selectedTransaction.net_price_per_share).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        total_amount: Number(selectedTransaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
        broker_name: brokerName,
        brokerage_fee_type: brokerageFeeType?.name || 'N/A',
        brokerage_fee_rate: selectedTransaction.brokerage_fee_rate ? `${selectedTransaction.brokerage_fee_rate}%` : 'N/A',
        brokerage_fee: Number(selectedTransaction.fees).toLocaleString(undefined, { minimumFractionDigits: 2 }),
        bank_name: bank?.name || 'N/A',
        bank_acc_no: entityBroker?.bank_account_number || bank?.account_number || 'N/A',
        ...(emailNote.trim() ? { note: emailNote.trim() } : {}),
      };

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-transaction-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: emailAddress.trim(),
          cc: ccAddresses.filter(e => e.trim()),
          transaction: transactionData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      alert(`Transaction details sent successfully to ${emailAddress}${ccAddresses.length ? ` (CC: ${ccAddresses.join(', ')})` : ''}`);
      setShowEmailModal(false);
      setEmailAddress('');
      setCcAddresses([]);
      setCcInput('');
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  }

  function getTransactionEmailData(transaction: Transaction) {
    const entityName = getEntityName(transaction.entity_id);
    const share = shares.find(s => s.id === transaction.share_id);
    const bank = transaction.bank_id ? banks.find(b => b.id === transaction.bank_id) : null;
    const brokerageFeeType = transaction.brokerage_fee_type_id
      ? brokerageFeeTypes.find(ft => ft.id === transaction.brokerage_fee_type_id)
      : null;

    // Match entity broker by broker_id first, then fall back to CDS account number
    const entityBroker = entityBrokers.find(eb =>
      eb.entity_id === transaction.entity_id && (
        (transaction.broker_id && eb.broker_id === transaction.broker_id) ||
        (transaction.cds_account_id && (
          eb.broker_account_number === transaction.cds_account_id ||
          eb.custodian_account_number === transaction.cds_account_id
        ))
      )
    );
    const fallbackEntityBroker = !transaction.broker_id && !entityBroker?.broker_id
      ? entityBrokers.find(eb => eb.entity_id === transaction.entity_id && eb.broker_id)
      : null;

    // Resolve broker name: direct FK → entity_broker FK → any entity broker → broker_text fallback
    const brokerName = transaction.broker_id
      ? getBrokerName(transaction.broker_id)
      : entityBroker?.broker_id
        ? getBrokerName(entityBroker.broker_id)
        : fallbackEntityBroker?.broker_id
          ? getBrokerName(fallbackEntityBroker.broker_id)
          : (entityBroker as any)?.broker_text || 'N/A';

    return {
      entity: entityName,
      transaction_type: transaction.transaction_type,
      share: share?.share_name || 'N/A',
      ticker: share?.ticker || 'N/A',
      transaction_date: new Date(transaction.transaction_date).toLocaleDateString(),
      cds_acc_type: entityBroker?.relationship_type || 'N/A',
      cds_acc_no: transaction.cds_account_id || entityBroker?.custodian_account_number || 'N/A',
      order_type: transaction.order_type,
      no_of_shares: Number(transaction.no_of_shares).toLocaleString(),
      gross_price_per_share: Number(transaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
      net_price_per_share: Number(transaction.net_price_per_share).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
      total_amount: Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      broker_name: brokerName,
      brokerage_fee_type: brokerageFeeType?.name || 'N/A',
      brokerage_fee_rate: transaction.brokerage_fee_rate ? `${transaction.brokerage_fee_rate}%` : 'N/A',
      brokerage_fee: Number(transaction.fees).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      bank_name: bank?.name || 'N/A',
      bank_acc_no: entityBroker?.bank_account_number || bank?.account_number || 'N/A'
    };
  }

  function toggleTransactionSelection(transactionId: string) {
    setSelectedTransactionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  }

  function toggleSelectAll() {
    const draftTransactions = filteredTransactions.filter(t => t.approval_status === 'DRAFT');
    if (selectedTransactionIds.size === draftTransactions.length && draftTransactions.length > 0) {
      setSelectedTransactionIds(new Set());
    } else {
      setSelectedTransactionIds(new Set(draftTransactions.map(t => t.id)));
    }
  }

  async function submitSelectedForApproval() {
    if (selectedTransactionIds.size === 0) {
      alert('Please select at least one transaction to submit for approval');
      return;
    }

    const validityHours = prompt('Enter validity period in hours (e.g., 24, 48, 72):', '24');
    if (!validityHours) return;

    const hours = parseInt(validityHours);
    if (isNaN(hours) || hours <= 0) {
      alert('Please enter a valid number of hours');
      return;
    }

    try {
      setSubmitting(true);
      const currentEmail = user?.email?.toLowerCase() || '';
      let autoApprovedCount = 0;
      let pendingCount = 0;

      for (const transactionId of selectedTransactionIds) {
        const txn = transactions.find(t => t.id === transactionId);
        if (!txn) continue;

        // Check if current user is a designated approver for this entity
        const { data: approverRows } = await supabase
          .from('entity_approvers')
          .select('id')
          .eq('entity_id', txn.entity_id)
          .eq('approver_email', currentEmail)
          .maybeSingle();

        const isApprover = !!approverRows;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

        const updatePayload: Record<string, unknown> = {
          submitted_for_approval_at: now.toISOString(),
          submitted_by: currentEmail,
          approval_validity_hours: hours,
          approval_expires_at: expiresAt.toISOString(),
        };

        if (isApprover) {
          updatePayload.approval_status = 'MANUAL_APPROVED';
          updatePayload.approved_by = currentEmail;
          updatePayload.approval_date = now.toISOString();
          updatePayload.approval_notes = 'Approved: submitted by designated approver';
          autoApprovedCount++;
        } else {
          updatePayload.approval_status = 'PENDING_APPROVAL';
          pendingCount++;
        }

        const { error } = await supabase
          .from('transactions')
          .update(updatePayload)
          .eq('id', transactionId);

        if (error) throw error;
      }

      const parts: string[] = [];
      if (pendingCount > 0) parts.push(`${pendingCount} submitted for approval`);
      if (autoApprovedCount > 0) parts.push(`${autoApprovedCount} auto-approved`);
      alert(parts.join(', ') + '.');
      setSelectedTransactionIds(new Set());
      loadData();
    } catch (error) {
      console.error('Error submitting transactions:', error);
      alert('Failed to submit transactions for approval');
    } finally {
      setSubmitting(false);
    }
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

    const matchesDateFrom = !filterDateFrom || txn.transaction_date >= filterDateFrom;
    const matchesDateTo = !filterDateTo || txn.transaction_date <= filterDateTo;
    const matchesStatus = filterStatuses.size === 0 || filterStatuses.has(txn.approval_status);

    if (activeTab === 'pending') {
      return matchesSearch && matchesDateFrom && matchesDateTo && matchesStatus && txn.approval_status === 'PENDING_APPROVAL';
    }
    return matchesSearch && matchesDateFrom && matchesDateTo && matchesStatus;
  });

  const key = `${formData.entity_id}-${formData.share_id}`;
  const currentBalance = shareBalances.get(key);
  const entityBalance = formData.entity_id ? getEntityBalance(formData.entity_id) : 0;
  const requiredAmount = calculateTotalAmountNet();
  const entityBankAccounts = formData.entity_id ? banks.filter(b => b.entity_id === formData.entity_id) : [];
  const sellPnL = formData.transaction_type === 'SELL' && formData.price_per_share && formData.no_of_shares ? calculateSellPnL() : null;

  const availableEntityBrokers = formData.entity_id
    ? entityBrokers.filter(eb =>
        eb.entity_id === formData.entity_id &&
        eb.relationship_type === formData.relationship_type
      )
    : [];

  const selectedEntityBroker = entityBrokers.find(eb => eb.id === formData.entity_broker_id);

  const availableBrokerNames = formData.relationship_type === 'Custodian' ? brokers : [];

  const pendingCount = transactions.filter(t => t.approval_status === 'PENDING_APPROVAL').length;

  const statusCounts = ALL_STATUSES.reduce((acc, { value }) => {
    acc[value] = transactions.filter(t => t.approval_status === value).length;
    return acc;
  }, {} as Record<string, number>);

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
          {selectedTransactionIds.size > 0 && (
            <button
              onClick={submitSelectedForApproval}
              disabled={submitting}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Clock className="w-5 h-5" />
              <span className="font-medium">Submit for Approval ({selectedTransactionIds.size})</span>
            </button>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Transactions</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{filteredTransactions.length}</p>
              {filteredTransactions.length !== transactions.length && (
                <p className="text-xs text-gray-400 mt-1">{transactions.length} total</p>
              )}
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
                {filteredTransactions.filter(t => t.transaction_type === 'BUY').length}
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
                {filteredTransactions.filter(t => t.transaction_type === 'SELL').length}
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
                LKR {filteredTransactions.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 p-2">
            <button
              onClick={() => { setActiveTab('all'); setFilterStatuses(new Set()); }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Transactions
            </button>
            <button
              onClick={() => { setActiveTab('pending'); setFilterStatuses(new Set()); }}
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

        <div className="p-4 border-b border-gray-200 space-y-3">
          {/* Status filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {(() => {
              const STATUS_TAB_CFG: { value: string; label: string; activeClass: string }[] = [
                { value: '', label: 'All', activeClass: 'bg-gray-800 text-white border-gray-800' },
                { value: 'DRAFT', label: 'Draft', activeClass: 'bg-gray-500 text-white border-gray-500' },
                { value: 'PENDING_APPROVAL', label: 'Pending', activeClass: 'bg-amber-500 text-white border-amber-500' },
                { value: 'MANUAL_APPROVED', label: 'Approved', activeClass: 'bg-green-600 text-white border-green-600' },
                { value: 'REJECTED', label: 'Rejected', activeClass: 'bg-red-600 text-white border-red-600' },
                { value: 'EXPIRED', label: 'Expired', activeClass: 'bg-gray-400 text-white border-gray-400' },
                { value: 'ON_HOLD', label: 'On Hold', activeClass: 'bg-orange-500 text-white border-orange-500' },
                { value: 'CANCELLED', label: 'Cancelled', activeClass: 'bg-rose-700 text-white border-rose-700' },
              ];
              return STATUS_TAB_CFG.map(({ value, label, activeClass }) => {
                const count = value === '' ? transactions.length : (statusCounts[value] ?? 0);
                const isActive = value === ''
                  ? filterStatuses.size === 0
                  : filterStatuses.size === 1 && filterStatuses.has(value);
                return (
                  <button
                    key={value || 'all'}
                    onClick={() => setFilterStatuses(value === '' ? new Set() : new Set([value]))}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 ${isActive ? activeClass : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    {label}
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white bg-opacity-25 text-current' : 'bg-gray-100 text-gray-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              });
            })()}
          </div>
          {/* Search and date filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by entity or share..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">From</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">To</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(filterDateFrom || filterDateTo || filterStatuses.size > 0) && (
              <button
                onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterStatuses(new Set()); }}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      filteredTransactions.filter(t => t.approval_status === 'DRAFT').length > 0 &&
                      selectedTransactionIds.size === filteredTransactions.filter(t => t.approval_status === 'DRAFT').length
                    }
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
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
                  <td className="px-4 py-4 text-center">
                    {transaction.approval_status === 'DRAFT' && (
                      <input
                        type="checkbox"
                        checked={selectedTransactionIds.has(transaction.id)}
                        onChange={() => toggleTransactionSelection(transaction.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    )}
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
                      {(() => {
                        const s = transaction.approval_status;
                        const cls =
                          s === 'MANUAL_APPROVED' ? 'bg-green-100 text-green-800' :
                          s === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          s === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' :
                          s === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                          'bg-gray-100 text-gray-800';
                        const label =
                          s === 'PENDING_APPROVAL' ? 'PENDING' :
                          s === 'MANUAL_APPROVED' ? 'APPROVED' :
                          s === 'CANCELLED' ? `CANCELLED ${transaction.transaction_type}` :
                          s;
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
                            {label}
                          </span>
                        );
                      })()}
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
                      {transaction.approval_status === 'DRAFT' && (
                        <button
                          onClick={() => handleEditDraft(transaction)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit Draft"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handlePrintTransaction(transaction)}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Print Transaction"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                      {transaction.approval_status === 'MANUAL_APPROVED' && (
                        <button
                          onClick={() => handleEmailTransaction(transaction)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Email Transaction"
                        >
                          <Mail className="w-5 h-5" />
                        </button>
                      )}
                      {transaction.approval_status === 'CANCELLED' && transaction.broker_id && (
                        <button
                          onClick={() => handleCancelNotifyBroker(transaction)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Send cancellation notice to broker"
                        >
                          <Mail className="w-5 h-5" />
                        </button>
                      )}
                      {transaction.approval_status === 'PENDING_APPROVAL' && (
                        <button
                          onClick={() => handleOpenUploadModal(transaction)}
                          className={`p-2 rounded-lg transition-colors ${
                            transaction.approval_document_name
                              ? 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                              : 'text-gray-500 hover:bg-gray-50'
                          }`}
                          title={transaction.approval_document_name ? 'Document Uploaded' : 'Upload Document'}
                        >
                          {transaction.approval_document_name ? (
                            <FileText className="w-5 h-5" />
                          ) : (
                            <Upload className="w-5 h-5" />
                          )}
                        </button>
                      )}
                      {transaction.approval_status !== 'CANCELLED' && transaction.approval_status !== 'REJECTED' &&
                       !(transaction.approval_status === 'MANUAL_APPROVED' && transaction.approval_document_name) && (
                        <button
                          onClick={() => handleCancelTransaction(transaction)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={transaction.approval_status === 'MANUAL_APPROVED' ? 'Cancel Approved Transaction' : 'Cancel Transaction'}
                          disabled={submitting}
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className={`rounded-xl shadow-xl w-full max-w-5xl max-h-[98vh] flex flex-col transition-colors ${
            formData.transaction_type === 'BUY' ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <div className={`px-5 py-3 border-b flex items-center justify-between ${
              formData.transaction_type === 'BUY' ? 'border-green-200 bg-green-100' : 'border-red-200 bg-red-100'
            }`}>
              <h2 className="text-lg font-bold text-gray-900">
                {editingDraftId ? `Edit Draft ${formData.transaction_type === 'BUY' ? 'Buy' : 'Sell'} Transaction` : `New ${formData.transaction_type === 'BUY' ? 'Buy' : 'Sell'} Transaction`}
              </h2>
            </div>
            <form onSubmit={handleCreateTransaction} className="flex flex-col flex-1 min-h-0">
              <div className={`px-5 py-3 space-y-2.5 overflow-y-auto ${
                formData.transaction_type === 'BUY' ? 'bg-green-50/70' : 'bg-red-50/70'
              }`}>

                {/* Row 1: Entity + Type/Account/Broker */}
                <div className={`grid grid-cols-4 gap-3 rounded-xl border p-3 ${
                  formData.transaction_type === 'BUY' ? 'border-green-200 bg-white/80' : 'border-red-200 bg-white/80'
                }`}>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Entity <span className="text-red-600">*</span></label>
                    <select
                      value={formData.entity_id}
                      onChange={(e) => setFormData({ ...formData, entity_id: e.target.value, entity_broker_id: '', selected_bank_id: '' })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Entity</option>
                      {entities.map(entity => (
                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Type <span className="text-red-600">*</span></label>
                    <select
                      value={formData.relationship_type}
                      onChange={(e) => setFormData({ ...formData, relationship_type: e.target.value, entity_broker_id: '', selected_broker_name_id: '' })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="Broker">Broker</option>
                      <option value="Custodian">Custodian</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {formData.relationship_type === 'Custodian' ? 'CDS Account ID' : 'Broker Account ID'} <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={formData.entity_broker_id}
                      onChange={(e) => setFormData({ ...formData, entity_broker_id: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Broker Name {formData.relationship_type === 'Custodian' && <span className="text-red-600">*</span>}
                    </label>
                    {formData.relationship_type === 'Custodian' ? (
                      <select
                        value={formData.selected_broker_name_id}
                        onChange={(e) => setFormData({ ...formData, selected_broker_name_id: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-100"
                        disabled
                      />
                    )}
                  </div>
                </div>

                {/* Row 2: Broker details info strip (compact) */}
                {selectedEntityBroker && (
                  <div className={`px-3 py-2 rounded-lg border flex flex-wrap gap-x-6 gap-y-1 ${
                    formData.transaction_type === 'BUY' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    {formData.relationship_type === 'Custodian' ? (
                      <>
                        <span className="text-xs text-gray-500">Custodian Acct: <span className="font-semibold text-gray-800">{selectedEntityBroker.custodian_account_number || 'N/A'}</span></span>
                        <span className="text-xs text-gray-500">Broker: <span className="font-semibold text-gray-800">{formData.selected_broker_name_id ? brokers.find(b => b.id === formData.selected_broker_name_id)?.broker_name || 'N/A' : '—'}</span></span>
                        {selectedEntityBroker.bank && <span className="text-xs text-gray-500">Bank: <span className="font-semibold text-gray-800">{selectedEntityBroker.bank.name}</span></span>}
                        {selectedEntityBroker.bank_account_number && <span className="text-xs text-gray-500">Bank Acct: <span className="font-semibold text-gray-800">{selectedEntityBroker.bank_account_number}</span></span>}
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-500">Bank: <span className="font-semibold text-gray-800">{selectedEntityBroker.bank?.name || 'N/A'}</span></span>
                        <span className="text-xs text-gray-500">Bank Acct: <span className="font-semibold text-gray-800">{selectedEntityBroker.bank_account_number || 'N/A'}</span></span>
                      </>
                    )}
                  </div>
                )}

                {/* Row 3: Bank Account dropdown + auto-populated account details */}
                <div className={`grid grid-cols-3 gap-3 rounded-xl border p-3 ${
                  formData.transaction_type === 'BUY' ? 'border-green-200 bg-white/80' : 'border-red-200 bg-white/80'
                }`}>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Bank Name</label>
                    <select
                      value={formData.selected_bank_id}
                      onChange={(e) => setFormData({ ...formData, selected_bank_id: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!formData.entity_id}
                    >
                      <option value="">Select Bank</option>
                      {entityBankAccounts.map(bank => (
                        <option key={bank.id} value={bank.id}>{bank.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Bank Account No</label>
                    <input
                      type="text"
                      value={formData.selected_bank_id ? (entityBankAccounts.find(b => b.id === formData.selected_bank_id)?.account_number || '') : ''}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                      readOnly
                      placeholder="Auto-filled on bank selection"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">CDS / Broker Account No</label>
                    <input
                      type="text"
                      value={selectedEntityBroker
                        ? (selectedEntityBroker.relationship_type === 'Custodian'
                            ? selectedEntityBroker.custodian_account_number || ''
                            : selectedEntityBroker.broker_account_number || '')
                        : ''}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                      readOnly
                      placeholder="Auto-filled on account selection"
                    />
                  </div>
                </div>

                {/* Row 4: Transaction Date / Transaction Type / Order Type / Share */}
                <div className={`grid grid-cols-4 gap-3 rounded-xl border p-3 ${
                  formData.transaction_type === 'BUY' ? 'border-green-200 bg-white/80' : 'border-red-200 bg-white/80'
                }`}>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Transaction Date <span className="text-red-600">*</span></label>
                    <input
                      type="date"
                      value={formData.transaction_date}
                      onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Transaction Type <span className="text-red-600">*</span></label>
                    <select
                      value={formData.transaction_type}
                      onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                    <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.day_trade}
                        onChange={(e) => handleDayTradeChange(e.target.checked)}
                        className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <span className="text-xs font-medium text-orange-700">Day Trade + Sell</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Order Type <span className="text-red-600">*</span></label>
                    <select
                      value={formData.order_type}
                      onChange={(e) => setFormData({ ...formData, order_type: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="DAY">1 Day Order</option>
                      <option value="2DAY">2 Day Order</option>
                      <option value="3DAY">3 Day Order</option>
                      <option value="4DAY">4 Day Order</option>
                      <option value="GTC">GTC (Good Till Cancelled)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Share <span className="text-red-600">*</span></label>
                    <select
                      value={formData.share_id}
                      onChange={(e) => setFormData({ ...formData, share_id: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Share</option>
                      {shares.map(share => (
                        <option key={share.id} value={share.id}>{share.ticker} - {share.share_name}</option>
                      ))}
                    </select>
                    {latestSharePrice && (
                      <p className="text-xs mt-1 text-gray-500">
                        Latest price: <span className="font-semibold text-gray-800">Rs. {latestSharePrice.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="ml-1 text-gray-400">({new Date(latestSharePrice.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Row 5: Shares / Price / Gross / Avg Cost — and balance warning inline */}
                <div className={`grid grid-cols-4 gap-3 rounded-xl border p-3 ${
                  formData.transaction_type === 'BUY' ? 'border-green-200 bg-white/80' : 'border-red-200 bg-white/80'
                }`}>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">No. of Shares <span className="text-red-600">*</span></label>
                    <input
                      type={sharesInputFocused ? 'number' : 'text'}
                      step="1" min="1"
                      value={
                        sharesInputFocused
                          ? formData.no_of_shares
                          : formData.no_of_shares
                            ? Number(formData.no_of_shares).toLocaleString()
                            : ''
                      }
                      onFocus={() => setSharesInputFocused(true)}
                      onBlur={() => setSharesInputFocused(false)}
                      onChange={(e) => setFormData({ ...formData, no_of_shares: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 1,000" required
                    />
                    {currentBalance && (
                      <p className="text-xs text-blue-600 mt-0.5">Held: <span className="font-semibold">{currentBalance.total_shares.toLocaleString()}</span></p>
                    )}
                    {formData.transaction_type === 'SELL' && currentBalance && formData.no_of_shares &&
                      parseFloat(formData.no_of_shares) > currentBalance.total_shares && (
                      <p className="text-xs text-red-600 mt-0.5 font-semibold">
                        Exceeds available shares ({currentBalance.total_shares.toLocaleString()})
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Price / Share (LKR) <span className="text-red-600">*</span></label>
                    <input
                      type="number" step="0.01" min="0.01"
                      value={formData.price_per_share}
                      onChange={(e) => setFormData({ ...formData, price_per_share: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 150.50" required
                    />
                    {currentBalance && formData.transaction_type === 'BUY' && (
                      <p className="text-xs text-gray-500 mt-0.5">Avg cost: <span className="font-semibold">LKR {currentBalance.avg_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Total Amount (Gross)</label>
                    <div className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                      LKR {calculateTotalAmountGross().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    {formData.transaction_type === 'BUY' && currentBalance ? (
                      <>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Avg Cost After Purchase</label>
                        <div className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                          LKR {calculateAverageCostWithPurchase().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </>
                    ) : formData.transaction_type === 'SELL' && currentBalance ? (
                      <>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Current Avg Cost</label>
                        <div className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                          LKR {currentBalance.avg_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </>
                    ) : entityBalance > 0 && requiredAmount > 0 && formData.transaction_type === 'BUY' ? (
                      <div className={`px-2.5 py-1.5 rounded-lg border text-xs ${
                        entityBalance >= requiredAmount * 1.5 ? 'bg-green-50 border-green-300' :
                        entityBalance >= requiredAmount ? 'bg-yellow-50 border-yellow-300' :
                        'bg-red-50 border-red-300'
                      }`}>
                        <p className="font-semibold text-gray-600">Available Balance</p>
                        <p className={`font-bold text-base ${getBalanceColor(entityBalance, requiredAmount)}`}>LKR {entityBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className="text-gray-500">Required: LKR {requiredAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className={`font-semibold ${getBalanceColor(entityBalance, requiredAmount)}`}>{getBalanceStatus(entityBalance, requiredAmount)}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Balance warning when currentBalance also present */}
                {entityBalance > 0 && requiredAmount > 0 && formData.transaction_type === 'BUY' && currentBalance && (
                  <div className={`px-3 py-2 rounded-lg border flex items-center justify-between text-xs ${
                    entityBalance >= requiredAmount * 1.5 ? 'bg-green-50 border-green-300' :
                    entityBalance >= requiredAmount ? 'bg-yellow-50 border-yellow-300' :
                    'bg-red-50 border-red-300'
                  }`}>
                    <span className="text-gray-600">Available Balance: <span className={`font-bold ${getBalanceColor(entityBalance, requiredAmount)}`}>LKR {entityBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                    <span className="text-gray-600">Required: <span className="font-bold text-gray-900">LKR {requiredAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                    <span className={`font-semibold ${getBalanceColor(entityBalance, requiredAmount)}`}>{getBalanceStatus(entityBalance, requiredAmount)}</span>
                  </div>
                )}

                {/* Sell P&L (compact) */}
                {formData.transaction_type === 'SELL' && sellPnL && (
                  <div className={`px-3 py-2 rounded-lg border flex gap-6 text-xs ${sellPnL.pnlPerShare >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                    <span className="font-semibold text-gray-600">Estimated P&L</span>
                    <span className="text-gray-500">P&L/Share: <span className={`font-bold ${sellPnL.pnlPerShare >= 0 ? 'text-green-700' : 'text-red-700'}`}>{sellPnL.pnlPerShare >= 0 ? '+' : ''}LKR {sellPnL.pnlPerShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                    <span className="text-gray-500">Total P&L: <span className={`font-bold ${sellPnL.totalPnl >= 0 ? 'text-green-700' : 'text-red-700'}`}>{sellPnL.totalPnl >= 0 ? '+' : ''}LKR {sellPnL.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                  </div>
                )}

                {/* Row 6: Brokerage fee type */}
                <div className={`grid grid-cols-2 gap-3 rounded-xl border p-3 ${
                  formData.transaction_type === 'BUY' ? 'border-green-200 bg-white/80' : 'border-red-200 bg-white/80'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-600">Brokerage Fee Type</label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.use_negotiated_fee}
                          onChange={(e) => setFormData({ ...formData, use_negotiated_fee: e.target.checked })}
                          className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-gray-600">Use Negotiated Fee</span>
                      </label>
                    </div>
                    {!formData.use_negotiated_fee ? (
                      formData.brokerage_fee_type_id ? (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                          {(() => {
                            const grossAmt = (parseFloat(formData.no_of_shares) || 0) * (parseFloat(formData.price_per_share) || 0);
                            const st = [...brokerageFeeTypes].sort((a, b) => (a.min_price ?? 0) - (b.min_price ?? 0));
                            const thr = st[0]?.max_price ?? null;
                            const isTiered = thr !== null && grossAmt > thr && aboveTierItems.length > 0;
                            if (isTiered) {
                              return <span className="text-xs font-semibold text-blue-800">Tiered: {st[0]?.name} + {st[1]?.name}</span>;
                            }
                            return <span className="text-xs font-semibold text-blue-800">{brokerageFeeTypes.find(ft => ft.id === formData.brokerage_fee_type_id)?.name ?? 'Auto-detected'}</span>;
                          })()}
                          <span className="text-xs text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-full">Auto-detected</span>
                        </div>
                      ) : (
                        <div className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-400 italic">
                          Enter shares and price to auto-detect fee type
                        </div>
                      )
                    ) : (
                      <select
                        value={formData.brokerage_fee_type_id}
                        onChange={(e) => {
                          const feeType = brokerageFeeTypes.find(ft => ft.id === e.target.value);
                          if (feeType) {
                            const breakdown = Array.isArray(feeType.fee_breakdown_items)
                              ? feeType.fee_breakdown_items.map(i => ({ ...i }))
                              : [];
                            setFeeBreakdownItems(breakdown);
                            setFormData({ ...formData, brokerage_fee_type_id: e.target.value, brokerage_fee_rate: feeType.rate.toString() });
                            calculateFeesFromBreakdown(breakdown);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select fee type</option>
                        {brokerageFeeTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name} ({type.rate}%)</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Negotiated fee rate input */}
                  {formData.use_negotiated_fee && feeBreakdownItems.length === 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Brokerage Fee Rate (%)</label>
                      <input
                        type="number" step="0.0001" min="0"
                        value={formData.brokerage_fee_rate}
                        onChange={(e) => {
                          setFormData({ ...formData, brokerage_fee_rate: e.target.value });
                          calculateFees(parseFloat(e.target.value) || 0);
                        }}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 1.12"
                      />
                    </div>
                  )}
                </div>

                {/* Fee breakdown table (compact) */}
                {feeBreakdownItems.length > 0 && (() => {
                  const grossAmount = (parseFloat(formData.no_of_shares) || 0) * (parseFloat(formData.price_per_share) || 0);
                  const sortedTiersUI = [...brokerageFeeTypes].sort((a, b) => (a.min_price ?? 0) - (b.min_price ?? 0));
                  const threshold = sortedTiersUI[0]?.max_price ?? null;
                  const isSplit = threshold !== null && grossAmount > threshold && aboveTierItems.length > 0;
                  const belowBase = isSplit ? threshold! : grossAmount;
                  const excessBase = isSplit ? grossAmount - threshold! : 0;

                  return (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Fee Breakdown <span className="font-normal text-gray-400">(rates editable for this transaction)</span>
                        {isSplit && <span className="ml-2 text-orange-600 font-semibold">(Tiered: first {(threshold!/1e6).toFixed(0)}M + excess)</span>}
                      </label>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Component</th>
                              <th className="px-3 py-1.5 text-right font-semibold text-gray-600 w-28">Rate (%)</th>
                              <th className="px-3 py-1.5 text-right font-semibold text-gray-600 w-36">Amount (LKR)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {isSplit && (
                              <tr className="bg-blue-50">
                                <td colSpan={3} className="px-3 py-1 text-blue-700 font-semibold">
                                  On LKR {belowBase.toLocaleString(undefined, { maximumFractionDigits: 0 })} (up to threshold)
                                </td>
                              </tr>
                            )}
                            {feeBreakdownItems.map((item, idx) => {
                              const itemAmount = (belowBase * item.rate) / 100;
                              return (
                                <tr key={`below-${idx}`} className="hover:bg-gray-50">
                                  <td className="px-3 py-1 text-gray-700">{item.name}</td>
                                  <td className="px-3 py-1">
                                    <input
                                      type="number" step="0.0001" min="0"
                                      value={item.rate}
                                      onChange={(e) => {
                                        const updated = feeBreakdownItems.map((it, i) =>
                                          i === idx ? { ...it, rate: parseFloat(e.target.value) || 0 } : it
                                        );
                                        setFeeBreakdownItems(updated);
                                        calculateFeesFromBreakdown(updated);
                                      }}
                                      className="w-full px-2 py-0.5 border border-gray-200 rounded text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </td>
                                  <td className="px-3 py-1 text-right font-medium text-gray-700">
                                    {itemAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })}
                            {isSplit && (
                              <>
                                <tr className="bg-orange-50">
                                  <td colSpan={3} className="px-3 py-1 text-orange-700 font-semibold">
                                    On LKR {excessBase.toLocaleString(undefined, { maximumFractionDigits: 0 })} (excess above threshold)
                                  </td>
                                </tr>
                                {aboveTierItems.map((item, idx) => {
                                  const itemAmount = (excessBase * item.rate) / 100;
                                  return (
                                    <tr key={`above-${idx}`} className="hover:bg-gray-50">
                                      <td className="px-3 py-1 text-gray-700">{item.name}</td>
                                      <td className="px-3 py-1">
                                        <input
                                          type="number" step="0.0001" min="0"
                                          value={item.rate}
                                          onChange={(e) => {
                                            const updated = aboveTierItems.map((it, i) =>
                                              i === idx ? { ...it, rate: parseFloat(e.target.value) || 0 } : it
                                            );
                                            setAboveTierItems(updated);
                                            calculateFeesFromBreakdown(feeBreakdownItems, updated);
                                          }}
                                          className="w-full px-2 py-0.5 border border-gray-200 rounded text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                      </td>
                                      <td className="px-3 py-1 text-right font-medium text-gray-700">
                                        {itemAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </>
                            )}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                            <tr>
                              <td className="px-3 py-1.5 font-bold text-gray-900 text-xs">Total</td>
                              <td className="px-3 py-1.5 text-right font-bold text-blue-700 text-xs">
                                {isSplit ? '(tiered)' : `${feeBreakdownItems.reduce((s, i) => s + i.rate, 0).toFixed(4)}%`}
                              </td>
                              <td className="px-3 py-1.5 text-right font-bold text-blue-700 text-xs">
                                {(parseFloat(formData.fees) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Row 7: Fee totals + net */}
                <div className={`grid grid-cols-3 gap-3 rounded-xl border p-3 ${
                  formData.transaction_type === 'BUY' ? 'border-green-200 bg-white/80' : 'border-red-200 bg-white/80'
                }`}>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Total Brokerage Fee (LKR)</label>
                    <div className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                      LKR {formData.fees ? parseFloat(formData.fees).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Net Price Per Share</label>
                    <div className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                      LKR {calculateNetPricePerShare().toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Total Amount (Net)</label>
                    <div className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-blue-50 text-blue-900 font-bold">
                      LKR {calculateTotalAmountNet().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

              </div>
              <div className={`px-5 py-3 border-t flex justify-end space-x-3 ${
                formData.transaction_type === 'BUY' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className={`px-4 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
                    formData.transaction_type === 'BUY'
                      ? 'border-green-200 text-green-700 hover:bg-green-100'
                      : 'border-red-200 text-red-700 hover:bg-red-100'
                  }`}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400 ${
                    formData.transaction_type === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
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
                      selectedTransaction.approval_status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                      selectedTransaction.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedTransaction.approval_status === 'CANCELLED'
                        ? `CANCELLED ${selectedTransaction.transaction_type}`
                        : selectedTransaction.transaction_type}
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
                    LKR {Number(selectedTransaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
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
                    LKR {Number(selectedTransaction.net_price_per_share).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
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
                      selectedTransaction.approval_status === 'MANUAL_APPROVED' ? 'bg-green-100 text-green-800' :
                      selectedTransaction.approval_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      selectedTransaction.approval_status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' :
                      selectedTransaction.approval_status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedTransaction.approval_status === 'MANUAL_APPROVED' ? 'APPROVED' :
                       selectedTransaction.approval_status === 'CANCELLED' ? `CANCELLED ${selectedTransaction.transaction_type}` :
                       selectedTransaction.approval_status}
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

      {showUploadModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Upload Approval Document</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {getEntityName(selectedTransaction.entity_id)} — {getShareInfo(selectedTransaction.share_id)}
                </p>
              </div>
              <button
                onClick={() => { setShowUploadModal(false); setUploadFile(null); setSelectedTransaction(null); }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {selectedTransaction.approval_document_name && (
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">{selectedTransaction.approval_document_name}</p>
                      {selectedTransaction.approval_document_uploaded_at && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          Uploaded {new Date(selectedTransaction.approval_document_uploaded_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <a
                      href={selectedTransaction.approval_document_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
                    >
                      View
                    </a>
                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setSelectedTransaction(null);
                        handleRemoveDocument(selectedTransaction);
                      }}
                      className="text-xs font-medium text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {selectedTransaction.approval_document_name ? 'Replace Document' : 'Select Document'}
                </label>
                <label className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  uploadFile ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
                }`}>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    disabled={uploading}
                  />
                  {uploadFile ? (
                    <div className="flex flex-col items-center space-y-2 px-4 text-center">
                      <FileText className="w-8 h-8 text-blue-600" />
                      <p className="text-sm font-semibold text-blue-800">{uploadFile.name}</p>
                      <p className="text-xs text-blue-600">{(uploadFile.size / 1024).toFixed(1)} KB — click to change</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-2">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <p className="text-sm text-gray-600">Click to browse or drag and drop</p>
                      <p className="text-xs text-gray-400">PDF, PNG, JPG, DOC, DOCX</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => { setShowUploadModal(false); setUploadFile(null); setSelectedTransaction(null); }}
                disabled={uploading}
                className="px-5 py-2 text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadDocument}
                disabled={uploading || !uploadFile}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'Uploading...' : 'Upload'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && selectedTransaction && (() => {
        const data = getTransactionEmailData(selectedTransaction);
        const broker = selectedTransaction.broker_id ? brokers.find(b => b.id === selectedTransaction.broker_id) : null;
        const typeColor = data.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }}>

              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <h2 className="text-base font-bold text-gray-900">Send Transaction Details</h2>
                </div>
                <button onClick={() => { setShowEmailModal(false); setEmailAddress(''); setCcAddresses([]); setCcInput(''); setEmailNote(''); setSelectedTransaction(null); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Transaction data — compact grid, no scroll needed */}
              <div className="px-5 pt-4 pb-3 flex-shrink-0">
                {/* Type badge + share headline */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${typeColor}`}>{data.transaction_type}</span>
                  <span className="font-semibold text-gray-900 text-sm">{data.ticker} — {data.share}</span>
                  <span className="text-gray-400 text-xs ml-auto">{data.entity}</span>
                </div>

                {/* Two-column grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-0 border border-gray-200 rounded-lg overflow-hidden">
                  {[
                    ['Transaction Date', data.transaction_date],
                    ['Order Type', data.order_type],
                    ['No. of Shares', data.no_of_shares],
                    ['Gross Price / Share', `LKR ${data.gross_price_per_share}`],
                    ['Net Price / Share', `LKR ${data.net_price_per_share}`],
                    ['Total Amount', `LKR ${data.total_amount}`],
                    ['CDS Acc Type', data.cds_acc_type],
                    ['CDS Acc No.', data.cds_acc_no],
                    ['Broker', data.broker_name],
                    ['Brokerage Fee Type', data.brokerage_fee_type],
                    ['Brokerage Fee Rate', data.brokerage_fee_rate],
                    ['Brokerage Fee', `LKR ${data.brokerage_fee}`],
                    ['Bank Name', data.bank_name],
                    ['Bank Acc No.', data.bank_acc_no],
                  ].map(([label, value], i) => {
                    const isKey = ['Total Amount', 'CDS Acc Type', 'CDS Acc No.', 'Gross Price / Share', 'Bank Name', 'Bank Acc No.'].includes(label as string);
                    return (
                      <div key={i} className={`flex items-center justify-between px-3 py-1.5 border-b border-gray-100 ${isKey ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <span className={`text-xs font-medium ${isKey ? 'text-blue-700' : 'text-gray-500'}`}>{label}</span>
                        <span className={`text-xs font-semibold ${isKey ? 'text-blue-900' : 'text-gray-800'} tabular-nums`}>{value}</span>
                      </div>
                    );
                  })}
                </div>
                {emailNote && (
                  <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-semibold text-amber-700 mb-0.5">Note</p>
                    <p className="text-xs text-amber-800 whitespace-pre-line">{emailNote}</p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 mx-5 flex-shrink-0" />

              {/* Note / To / CC / Actions */}
              <div className="px-5 py-3 space-y-2.5 flex-shrink-0">
                {/* Note */}
                <div className="flex items-start gap-3">
                  <label className="text-xs font-semibold text-gray-500 w-10 flex-shrink-0 pt-1.5">Note</label>
                  <textarea
                    value={emailNote}
                    onChange={(e) => setEmailNote(e.target.value)}
                    rows={2}
                    disabled={sendingEmail}
                    placeholder="Optional note to include in the email..."
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  />
                </div>

                {/* To */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-gray-500 w-10 flex-shrink-0">To</label>
                  <div className="flex-1">
                    <input
                      type="email"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      disabled={sendingEmail}
                    />
                    {broker?.contact_person_email && broker.contact_person_email !== emailAddress && (
                      <button type="button" onClick={() => setEmailAddress(broker.contact_person_email!)} className="mt-0.5 text-xs text-blue-600 hover:underline">
                        Use {broker.broker_name}: {broker.contact_person_email}
                      </button>
                    )}
                  </div>
                </div>

                {/* CC */}
                <div className="flex items-start gap-3">
                  <label className="text-xs font-semibold text-gray-500 w-10 flex-shrink-0 pt-1.5">CC</label>
                  <div className="flex-1 space-y-1.5">
                    {ccAddresses.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ccAddresses.map((addr, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-800 text-xs rounded-full border border-blue-200">
                            {addr}
                            <button type="button" onClick={() => setCcAddresses(ccAddresses.filter((_, i) => i !== idx))} disabled={sendingEmail} className="text-blue-400 hover:text-blue-700"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={ccInput}
                        onChange={(e) => setCcInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            const val = ccInput.trim();
                            if (val && !ccAddresses.includes(val)) { setCcAddresses([...ccAddresses, val]); setCcInput(''); }
                          }
                        }}
                        placeholder="Add CC, press Enter"
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        disabled={sendingEmail}
                      />
                      <button
                        type="button"
                        onClick={() => { const val = ccInput.trim(); if (val && !ccAddresses.includes(val)) { setCcAddresses([...ccAddresses, val]); setCcInput(''); } }}
                        disabled={sendingEmail || !ccInput.trim()}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm"
                      >Add</button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => { setShowEmailModal(false); setEmailAddress(''); setCcAddresses([]); setCcInput(''); setEmailNote(''); setSelectedTransaction(null); }} disabled={sendingEmail} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">
                    Cancel
                  </button>
                  <button onClick={sendEmail} disabled={sendingEmail || !emailAddress.trim()} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {sendingEmail ? 'Sending...' : 'Send Email'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl my-6">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Bulk Entry — Transactions</h2>
                <p className="text-sm text-gray-500 mt-0.5">Enter multiple past buy/sell transactions. All entries go directly into the system.</p>
              </div>
              <button
                onClick={() => { setShowBulkModal(false); setBulkRows([emptyBulkRow()]); }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap w-8">#</th>
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap min-w-[200px]">Transaction</th>
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap min-w-[150px]">Entity <span className="text-red-300">*</span></th>
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap min-w-[150px]">Share <span className="text-red-300">*</span></th>
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap min-w-[80px]">Buy / Sell <span className="text-red-300">*</span></th>
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap min-w-[120px]">Settlement Date <span className="text-red-300">*</span></th>
                      <th className="px-2 py-2.5 text-right font-semibold whitespace-nowrap min-w-[100px]">No. of Shares <span className="text-red-300">*</span></th>
                      <th className="px-2 py-2.5 text-right font-semibold whitespace-nowrap min-w-[130px]">Purchase / Sales Cost <span className="text-red-300">*</span></th>
                      <th className="px-2 py-2.5 text-left font-semibold whitespace-nowrap min-w-[130px]">CDS Account</th>
                      <th className="px-2 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((row, idx) => {
                      const rowReady = row.entity_id && row.share_id && row.no_of_shares && row.price_per_share;
                      return (
                        <tr key={idx} className={`border-b border-gray-200 ${rowReady ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-2 py-1.5 text-gray-400 text-center">{idx + 1}</td>

                          {/* Transaction (optional link to existing) */}
                          <td className="px-1 py-1">
                            <select
                              value={row.transaction_id}
                              onChange={e => {
                                const txn = transactions.find(t => t.id === e.target.value);
                                if (txn) {
                                  setBulkRows(prev => prev.map((r, i) => i === idx ? {
                                    ...r,
                                    transaction_id: e.target.value,
                                    entity_id: txn.entity_id,
                                    share_id: txn.share_id,
                                    transaction_type: txn.transaction_type === 'BUY' ? 'Buy' : 'Sell',
                                    no_of_shares: String(txn.no_of_shares),
                                    price_per_share: String(txn.price_per_share),
                                    cds_account: txn.cds_account_id || '',
                                  } : r));
                                } else {
                                  updateBulkRow(idx, 'transaction_id', e.target.value);
                                }
                              }}
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            >
                              <option value="">— not linked —</option>
                              {transactions.map(t => {
                                const sh = shares.find(s => s.id === t.share_id);
                                const en = entities.find(e => e.id === t.entity_id);
                                return (
                                  <option key={t.id} value={t.id}>
                                    {t.transaction_type} — {sh?.ticker} — {en?.name}
                                  </option>
                                );
                              })}
                            </select>
                          </td>

                          {/* Entity */}
                          <td className="px-1 py-1">
                            <select
                              value={row.entity_id}
                              onChange={e => updateBulkRow(idx, 'entity_id', e.target.value)}
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            >
                              <option value="">Select entity...</option>
                              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                          </td>

                          {/* Share */}
                          <td className="px-1 py-1">
                            <select
                              value={row.share_id}
                              onChange={e => updateBulkRow(idx, 'share_id', e.target.value)}
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            >
                              <option value="">Select share...</option>
                              {shares.map(s => <option key={s.id} value={s.id}>{s.ticker} — {s.share_name}</option>)}
                            </select>
                          </td>

                          {/* Buy / Sell */}
                          <td className="px-1 py-1">
                            <select
                              value={row.transaction_type}
                              onChange={e => updateBulkRow(idx, 'transaction_type', e.target.value)}
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            >
                              <option value="Buy">Buy</option>
                              <option value="Sell">Sell</option>
                            </select>
                          </td>

                          {/* Settlement date */}
                          <td className="px-1 py-1">
                            <input
                              type="date"
                              value={row.settlement_date}
                              onChange={e => updateBulkRow(idx, 'settlement_date', e.target.value)}
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>

                          {/* No of shares */}
                          <td className="px-1 py-1">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={row.no_of_shares}
                              onChange={e => updateBulkRow(idx, 'no_of_shares', e.target.value)}
                              placeholder="0"
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>

                          {/* Price per share */}
                          <td className="px-1 py-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.price_per_share}
                              onChange={e => updateBulkRow(idx, 'price_per_share', e.target.value)}
                              placeholder="0.00"
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>

                          {/* CDS account */}
                          <td className="px-1 py-1">
                            <input
                              type="text"
                              value={row.cds_account}
                              onChange={e => updateBulkRow(idx, 'cds_account', e.target.value)}
                              placeholder="CDS account no."
                              className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>

                          {/* Delete */}
                          <td className="px-1 py-1 text-center">
                            <button onClick={() => removeBulkRow(idx)} className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={addBulkRow}
                  className="flex items-center space-x-1.5 px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Row</span>
                </button>

                <div className="flex items-center space-x-3">
                  <p className="text-xs text-gray-500">
                    {bulkRows.filter(r => r.entity_id && r.share_id && r.no_of_shares && r.price_per_share).length} of {bulkRows.length} rows ready
                  </p>
                  <button
                    onClick={() => { setShowBulkModal(false); setBulkRows([emptyBulkRow()]); }}
                    className="px-5 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveBulk}
                    disabled={isSavingBulk}
                    className="flex items-center space-x-2 px-6 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingBulk ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Save All</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">Note:</span> Fields marked <span className="text-red-500">*</span> are required. Selecting a Transaction auto-fills the row. Only complete rows (Entity, Share, Shares, Price) are saved. Transactions are saved with <span className="font-semibold">MANUAL APPROVED</span> status immediately.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
