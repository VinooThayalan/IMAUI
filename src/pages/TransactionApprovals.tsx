import {
  CheckCircle, XCircle, Clock, CreditCard as Edit2, Pause, Eye,
  Search, Filter, Mail, FileText, Ban, RotateCcw, X, Plus
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  created_at: string;
  currency: string | null;
  settlement_date: string | null;
}

interface Entity {
  id: string;
  name: string;
  contact_email_company_individual: string | null;
  cc_email: string | null;
}

interface Share {
  id: string;
  share_name: string;
  ticker: string;
}

interface Broker {
  id: string;
  broker_name: string;
  contact_person_email: string | null;
  contact_person_name: string | null;
}

interface Bank {
  id: string;
  name: string;
  account_number: string;
  entity_id: string;
}

interface EntityBroker {
  id: string;
  entity_id: string;
  broker_id: string;
  relationship_type: string;
  broker_account_number: string | null;
  custodian_account_number: string | null;
  bank_account_number: string | null;
}

const ALL_STATUSES = ['PENDING_APPROVAL', 'MANUAL_APPROVED', 'REJECTED', 'EXPIRED', 'ON_HOLD', 'CANCELLED'];

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  PENDING_APPROVAL: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Pending' },
  MANUAL_APPROVED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Approved' },
  REJECTED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Rejected' },
  EXPIRED: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Expired' },
  ON_HOLD: { icon: Pause, color: 'text-orange-600', bg: 'bg-orange-100', label: 'On Hold' },
  CANCELLED: { icon: Ban, color: 'text-rose-700', bg: 'bg-rose-100', label: 'Cancelled' },
};

export function TransactionApprovals() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [entityBrokers, setEntityBrokers] = useState<EntityBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('PENDING_APPROVAL');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterShare, setFilterShare] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'HOLD' | 'VIEW' | 'CANCEL' | 'CANCEL_APPROVE'>('VIEW');
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editFormData, setEditFormData] = useState({
    entity_id: '',
    share_id: '',
    transaction_type: '',
    transaction_date: '',
    no_of_shares: '',
    price_per_share: ''
  });

  const [actionFormData, setActionFormData] = useState({
    approval_notes: '',
    rejection_reason: '',
    hold_hours: '',
    cancel_reason: '',
    notify_broker: false,
  });

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [ccAddresses, setCcAddresses] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    loadData();
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    const expiryInterval = setInterval(() => checkExpiredTransactions(), 10000);
    return () => {
      clearInterval(timeInterval);
      clearInterval(expiryInterval);
    };
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [transactionsRes, entitiesRes, sharesRes, brokersRes, banksRes, entityBrokersRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .in('approval_status', ALL_STATUSES)
          .order('submitted_for_approval_at', { ascending: false, nullsFirst: false }),
        supabase.from('entities').select('id, name, contact_email_company_individual, cc_email').order('name'),
        supabase.from('shares').select('id, share_name, ticker').order('share_name'),
        supabase.from('brokers').select('id, broker_name, contact_person_email, contact_person_name').order('broker_name'),
        supabase.from('banks').select('id, name, account_number, entity_id').order('name'),
        supabase.from('entity_brokers').select('*'),
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      setTransactions(transactionsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
      setBrokers(brokersRes.data || []);
      setBanks(banksRes.data || []);
      setEntityBrokers(entityBrokersRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function checkExpiredTransactions() {
    try {
      const { data } = await supabase
        .from('transactions')
        .select('id, approval_expires_at')
        .eq('approval_status', 'PENDING_APPROVAL')
        .not('approval_expires_at', 'is', null);

      if (!data) return;
      const now = new Date();
      const expired = data.filter(t => new Date(t.approval_expires_at!) <= now);
      if (expired.length === 0) return;

      for (const t of expired) {
        await supabase.from('transactions').update({ approval_status: 'EXPIRED' }).eq('id', t.id);
      }
      setTransactions(prev =>
        prev.map(t => expired.some(e => e.id === t.id) ? { ...t, approval_status: 'EXPIRED' } : t)
      );
    } catch (error) {
      console.error('Error checking expired transactions:', error);
    }
  }

  function getEntityName(entityId: string) {
    return entities.find(e => e.id === entityId)?.name || entityId;
  }

  function getShareInfo(shareId: string) {
    const share = shares.find(s => s.id === shareId);
    return share ? `${share.ticker} - ${share.share_name}` : shareId;
  }

  function getBrokerName(brokerId: string | null) {
    if (!brokerId) return 'N/A';
    return brokers.find(b => b.id === brokerId)?.broker_name || 'N/A';
  }

  function getTimeRemaining(transaction: Transaction): string {
    if (!transaction.approval_expires_at || (transaction.approval_status !== 'PENDING_APPROVAL' && transaction.approval_status !== 'ON_HOLD')) return '';
    const expiresAt = new Date(transaction.approval_expires_at);
    const diffMs = expiresAt.getTime() - currentTime.getTime();
    if (diffMs <= 0) return 'EXPIRED';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  // Filtered transactions
  const filteredTransactions = transactions.filter(t => {
    const searchL = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      getEntityName(t.entity_id).toLowerCase().includes(searchL) ||
      getShareInfo(t.share_id).toLowerCase().includes(searchL);
    const matchesStatus = !filterStatus || t.approval_status === filterStatus;
    const matchesEntity = !filterEntity || t.entity_id === filterEntity;
    const matchesShare = !filterShare || t.share_id === filterShare;
    const matchesDateFrom = !filterDateFrom || t.transaction_date >= filterDateFrom;
    const matchesDateTo = !filterDateTo || t.transaction_date <= filterDateTo;
    return matchesSearch && matchesStatus && matchesEntity && matchesShare && matchesDateFrom && matchesDateTo;
  });

  function openModal(transaction: Transaction, type: typeof actionType) {
    setSelectedTransaction(transaction);
    setActionType(type);
    setIsEditing(false);
    setActionFormData({ approval_notes: '', rejection_reason: '', hold_hours: '', cancel_reason: '', notify_broker: false });
    if (type !== 'VIEW') {
      setEditFormData({
        entity_id: transaction.entity_id,
        share_id: transaction.share_id,
        transaction_type: transaction.transaction_type,
        transaction_date: transaction.transaction_date,
        no_of_shares: transaction.no_of_shares.toString(),
        price_per_share: transaction.price_per_share.toString()
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSelectedTransaction(null);
    setIsEditing(false);
  }

  async function handleApprove() {
    if (!selectedTransaction) return;
    try {
      setSubmitting(true);
      const updates: any = {
        approval_status: 'MANUAL_APPROVED',
        approved_by: user?.email || 'system',
        approval_date: new Date().toISOString(),
        approval_notes: actionFormData.approval_notes || null
      };
      if (isEditing) {
        updates.entity_id = editFormData.entity_id;
        updates.share_id = editFormData.share_id;
        updates.transaction_type = editFormData.transaction_type;
        updates.transaction_date = editFormData.transaction_date;
        updates.no_of_shares = parseFloat(editFormData.no_of_shares);
        updates.price_per_share = parseFloat(editFormData.price_per_share);
        updates.total_amount_gross = updates.no_of_shares * updates.price_per_share;
        updates.total_amount = updates.total_amount_gross - (selectedTransaction.fees || 0);
      }
      const { error } = await supabase.from('transactions').update(updates).eq('id', selectedTransaction.id);
      if (error) throw error;
      alert('Transaction approved successfully');
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error approving transaction:', error);
      alert('Failed to approve transaction');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (!selectedTransaction || !actionFormData.rejection_reason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    try {
      setSubmitting(true);
      const { error } = await supabase.from('transactions').update({
        approval_status: 'REJECTED',
        approved_by: user?.email || 'system',
        approval_date: new Date().toISOString(),
        rejection_reason: actionFormData.rejection_reason,
        approval_notes: actionFormData.approval_notes || null
      }).eq('id', selectedTransaction.id);
      if (error) throw error;

      // Release on-hold cash
      await releaseOnHoldCash(selectedTransaction);

      alert('Transaction rejected successfully');
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error rejecting transaction:', error);
      alert('Failed to reject transaction');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleHold() {
    if (!selectedTransaction || !actionFormData.hold_hours) {
      alert('Please specify how many hours to extend');
      return;
    }
    try {
      setSubmitting(true);
      const currentExpiry = selectedTransaction.approval_expires_at
        ? new Date(selectedTransaction.approval_expires_at)
        : new Date();
      const additionalHours = parseFloat(actionFormData.hold_hours);
      const newExpiry = new Date(currentExpiry.getTime() + additionalHours * 60 * 60 * 1000);
      const { error } = await supabase.from('transactions').update({
        approval_expires_at: newExpiry.toISOString(),
        approval_validity_hours: (selectedTransaction.approval_validity_hours || 0) + additionalHours,
        approval_notes: actionFormData.approval_notes || selectedTransaction.approval_notes
      }).eq('id', selectedTransaction.id);
      if (error) throw error;
      alert(`Approval extended by ${additionalHours} hour${additionalHours !== 1 ? 's' : ''}. New deadline: ${newExpiry.toLocaleString()}`);
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error holding transaction:', error);
      alert('Failed to hold transaction');
    } finally {
      setSubmitting(false);
    }
  }

  async function releaseOnHoldCash(transaction: Transaction) {
    // Find any cash ledger entries with on_hold_amount > 0 for this transaction
    const { data: ledgerEntries } = await supabase
      .from('cash_balance_ledger')
      .select('*')
      .eq('entity_id', transaction.entity_id)
      .not('on_hold_amount', 'is', null);

    if (!ledgerEntries || ledgerEntries.length === 0) return;

    // Zero out on_hold_amount for entries referencing this transaction
    for (const entry of ledgerEntries) {
      if ((entry.reference_id === transaction.id || entry.notes?.includes(transaction.id)) && (entry.on_hold_amount || 0) > 0) {
        await supabase
          .from('cash_balance_ledger')
          .update({ on_hold_amount: 0 })
          .eq('id', entry.id);
      }
    }
  }

  async function handleCancel() {
    if (!selectedTransaction || !actionFormData.cancel_reason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }
    try {
      setSubmitting(true);

      const { error } = await supabase.from('transactions').update({
        approval_status: 'CANCELLED',
        rejection_reason: actionFormData.cancel_reason,
        approval_notes: `Cancelled by ${user?.email || 'system'} on ${new Date().toLocaleDateString()}. ${actionFormData.approval_notes || ''}`.trim(),
      }).eq('id', selectedTransaction.id);
      if (error) throw error;

      // Release on-hold cash
      await releaseOnHoldCash(selectedTransaction);

      // Optionally notify broker
      if (actionFormData.notify_broker && selectedTransaction.broker_id) {
        const broker = brokers.find(b => b.id === selectedTransaction.broker_id);
        if (broker?.contact_person_email) {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-transaction-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: broker.contact_person_email,
              transaction: buildEmailData(selectedTransaction, `CANCELLATION — Reason: ${actionFormData.cancel_reason}`  + (actionFormData.approval_notes ? `\n\n${actionFormData.approval_notes}` : '')),
            }),
          });
        }
      }

      alert('Transaction cancelled and cash released');
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error cancelling transaction:', error);
      alert('Failed to cancel transaction');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelApprove() {
    if (!selectedTransaction || !actionFormData.cancel_reason.trim()) {
      alert('Please provide a reason for cancelling the approval');
      return;
    }
    try {
      setSubmitting(true);

      const { error } = await supabase.from('transactions').update({
        approval_status: 'CANCELLED',
        rejection_reason: actionFormData.cancel_reason,
        approval_notes: `Approval cancelled by ${user?.email || 'system'} on ${new Date().toLocaleDateString()}. ${actionFormData.approval_notes || ''}`.trim(),
      }).eq('id', selectedTransaction.id);
      if (error) throw error;

      // Release on-hold cash
      await releaseOnHoldCash(selectedTransaction);

      // Optionally notify broker
      if (actionFormData.notify_broker && selectedTransaction.broker_id) {
        const broker = brokers.find(b => b.id === selectedTransaction.broker_id);
        if (broker?.contact_person_email) {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-transaction-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: broker.contact_person_email,
              transaction: buildEmailData(selectedTransaction, `APPROVAL CANCELLED — Reason: ${actionFormData.cancel_reason}. Note: Buy/Sell Note was not uploaded.` + (actionFormData.approval_notes ? `\n\n${actionFormData.approval_notes}` : '')),
            }),
          });
        }
      }

      alert('Approval cancelled and cash released');
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error cancelling approval:', error);
      alert('Failed to cancel approval');
    } finally {
      setSubmitting(false);
    }
  }

  function buildEmailData(transaction: Transaction, note?: string) {
    const entity = entities.find(e => e.id === transaction.entity_id);
    const share = shares.find(s => s.id === transaction.share_id);
    const broker = transaction.broker_id ? brokers.find(b => b.id === transaction.broker_id) : null;
    const bank = transaction.bank_id ? banks.find(b => b.id === transaction.bank_id) : null;
    const entityBroker = entityBrokers.find(
      eb => eb.entity_id === transaction.entity_id && eb.broker_id === transaction.broker_id
    );
    return {
      entity: entity?.name || 'N/A',
      transaction_type: transaction.transaction_type,
      share: share?.share_name || 'N/A',
      ticker: share?.ticker || 'N/A',
      transaction_date: new Date(transaction.transaction_date).toLocaleDateString(),
      cds_acc_type: entityBroker?.relationship_type || 'N/A',
      cds_acc_no: transaction.cds_account_id || entityBroker?.custodian_account_number || 'N/A',
      order_type: transaction.order_type || 'N/A',
      no_of_shares: Number(transaction.no_of_shares).toLocaleString(),
      gross_price_per_share: Number(transaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
      net_price_per_share: Number(transaction.net_price_per_share).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
      total_amount: Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      broker_name: broker?.broker_name || 'N/A',
      brokerage_fee_type: 'N/A',
      brokerage_fee_rate: transaction.brokerage_fee_rate ? `${transaction.brokerage_fee_rate}%` : 'N/A',
      brokerage_fee: Number(transaction.fees || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      bank_name: bank?.name || 'N/A',
      bank_acc_no: entityBroker?.bank_account_number || bank?.account_number || 'N/A',
      ...(note ? { note } : {}),
    };
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
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-transaction-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: emailAddress.trim(),
          cc: ccAddresses.filter(e => e.trim()),
          transaction: buildEmailData(selectedTransaction, emailNote.trim() || undefined),
        }),
      });
      if (!response.ok) throw new Error('Failed to send email');
      alert(`Transaction details sent to ${emailAddress}${ccAddresses.length ? ` (CC: ${ccAddresses.join(', ')})` : ''}`);
      setShowEmailModal(false);
      setEmailAddress('');
      setCcAddresses([]);
      setEmailNote('');
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  }

  function openEmailModal(transaction: Transaction) {
    setSelectedTransaction(transaction);
    setEmailNote('');
    setCcInput('');
    // Pre-fill To with broker's contact email
    const broker = transaction.broker_id ? brokers.find(b => b.id === transaction.broker_id) : null;
    setEmailAddress(broker?.contact_person_email || '');
    // Auto-CC from entity cc_email
    const entity = entities.find(e => e.id === transaction.entity_id);
    const autoCc: string[] = [];
    if (entity?.cc_email) autoCc.push(entity.cc_email);
    setCcAddresses(autoCc);
    setShowEmailModal(true);
  }

  const hasFilters = searchTerm || filterStatus !== 'PENDING_APPROVAL' || filterEntity || filterShare || filterDateFrom || filterDateTo;

  function clearFilters() {
    setSearchTerm('');
    setFilterStatus('PENDING_APPROVAL');
    setFilterEntity('');
    setFilterShare('');
    setFilterDateFrom('');
    setFilterDateTo('');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading transaction approvals...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transaction Approvals</h1>
          <p className="text-gray-600 mt-1">Review and manage transaction approvals</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <Clock className="w-4 h-4" />
          <span>{currentTime.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Entity or share..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status */}
          <div className="min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{statusConfig[s]?.label || s}</option>
              ))}
            </select>
          </div>

          {/* Entity */}
          <div className="min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Entity</label>
            <select
              value={filterEntity}
              onChange={e => setFilterEntity(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Entities</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* Share */}
          <div className="min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Share</label>
            <select
              value={filterShare}
              onChange={e => setFilterShare(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Shares</option>
              {shares.map(s => <option key={s.id} value={s.id}>{s.ticker} - {s.share_name}</option>)}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Clear</span>
            </button>
          )}
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Share</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Shares</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Doc</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time to Approve</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => {
                const timeRemaining = getTimeRemaining(transaction);
                const cfg = statusConfig[transaction.approval_status] || statusConfig['PENDING_APPROVAL'];
                const StatusIcon = cfg.icon;
                const isSelf = transaction.submitted_by?.toLowerCase() === user?.email?.toLowerCase();
                const isPending = transaction.approval_status === 'PENDING_APPROVAL' || transaction.approval_status === 'ON_HOLD';
                const isApproved = transaction.approval_status === 'MANUAL_APPROVED';
                const hasDoc = !!transaction.approval_document_url;

                return (
                  <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{getEntityName(transaction.entity_id)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        transaction.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.transaction_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{getShareInfo(transaction.share_id)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(transaction.transaction_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{Number(transaction.no_of_shares).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right tabular-nums">
                      LKR {Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      {hasDoc ? (
                        <a
                          href={transaction.approval_document_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700"
                          title={transaction.approval_document_name || 'View document'}
                        >
                          <FileText className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isPending ? (
                        <span className={`inline-flex items-center space-x-1 font-mono text-xs ${
                          timeRemaining === 'EXPIRED' ? 'text-red-600 font-semibold' : 'text-gray-700'
                        }`}>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{timeRemaining || 'No limit'}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span>{cfg.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1">
                        {/* View */}
                        <button
                          onClick={() => openModal(transaction, 'VIEW')}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Pending actions */}
                        {isPending && !isSelf && (
                          <>
                            <button
                              onClick={() => openModal(transaction, 'APPROVE')}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openModal(transaction, 'REJECT')}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openModal(transaction, 'HOLD')}
                              className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                              title="Extend Time"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {isPending && isSelf && (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                            Self-submitted
                          </span>
                        )}

                        {/* Pending cancel */}
                        {isPending && (
                          <button
                            onClick={() => openModal(transaction, 'CANCEL')}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Cancel Transaction"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}

                        {/* Cancelled: send cancel notification to broker */}
                        {transaction.approval_status === 'CANCELLED' && transaction.broker_id && (
                          <button
                            onClick={() => openEmailModal(transaction)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Send cancellation notice to broker"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}

                        {/* Approved: email + cancel-approve (if no buy/sell note uploaded) */}
                        {isApproved && (
                          <>
                            <button
                              onClick={() => openEmailModal(transaction)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Send Email"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            {!hasDoc && (
                              <button
                                onClick={() => openModal(transaction, 'CANCEL_APPROVE')}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Cancel Approval (no note uploaded)"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredTransactions.length === 0 && (
            <div className="text-center py-16">
              <Filter className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No transactions found</p>
              {hasFilters && (
                <button onClick={clearFilters} className="mt-2 text-sm text-blue-600 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {showModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {actionType === 'VIEW' && 'Transaction Details'}
                {actionType === 'APPROVE' && 'Approve Transaction'}
                {actionType === 'REJECT' && 'Reject Transaction'}
                {actionType === 'HOLD' && 'Extend Approval Deadline'}
                {actionType === 'CANCEL' && 'Cancel Transaction'}
                {actionType === 'CANCEL_APPROVE' && 'Cancel Approval'}
              </h2>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status banners */}
              {selectedTransaction.approval_status === 'MANUAL_APPROVED' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-sm text-emerald-800 font-medium">Auto-approved — submitted by the designated approver for this entity</p>
                </div>
              )}
              {selectedTransaction.approval_status === 'PENDING_APPROVAL' &&
                selectedTransaction.submitted_by?.toLowerCase() === user?.email?.toLowerCase() && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800 font-medium">You submitted this transaction — it must be approved by another user</p>
                </div>
              )}
              {(actionType === 'CANCEL' || actionType === 'CANCEL_APPROVE') && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-center space-x-2">
                  <Ban className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <p className="text-sm text-rose-800 font-medium">
                    {actionType === 'CANCEL_APPROVE'
                      ? 'This will cancel the approval and reverse any cash on hold. No buy/sell note has been uploaded for this transaction.'
                      : 'This will cancel the transaction and release any cash on hold back to the entity balance.'}
                  </p>
                </div>
              )}

              {/* Approval document banner (if uploaded) */}
              {selectedTransaction.approval_document_url && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-blue-800 font-medium">Approval Document Uploaded</p>
                      {selectedTransaction.approval_document_name && (
                        <p className="text-xs text-blue-600">{selectedTransaction.approval_document_name}</p>
                      )}
                      {selectedTransaction.approval_document_uploaded_at && (
                        <p className="text-xs text-blue-500">
                          Uploaded {new Date(selectedTransaction.approval_document_uploaded_at).toLocaleString()}
                          {selectedTransaction.approval_document_uploaded_by && ` by ${selectedTransaction.approval_document_uploaded_by}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <a
                    href={selectedTransaction.approval_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    View
                  </a>
                </div>
              )}

              {/* Transaction detail grid */}
              {!isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Entity', value: getEntityName(selectedTransaction.entity_id) },
                      { label: 'Broker', value: getBrokerName(selectedTransaction.broker_id) },
                      { label: 'Share', value: getShareInfo(selectedTransaction.share_id) },
                      { label: 'Transaction Date', value: new Date(selectedTransaction.transaction_date).toLocaleDateString() },
                      { label: 'No. of Shares', value: Number(selectedTransaction.no_of_shares).toLocaleString() },
                      { label: 'Price Per Share (LKR)', value: Number(selectedTransaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) },
                      { label: 'Brokerage Fee (LKR)', value: Number(selectedTransaction.fees || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
                      { label: 'Net Price Per Share (LKR)', value: Number(selectedTransaction.net_price_per_share).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) },
                      { label: 'Total Value (LKR)', value: Number(selectedTransaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
                      { label: 'Order Type', value: selectedTransaction.order_type || 'N/A' },
                      { label: 'CDS Account', value: selectedTransaction.cds_account_id || 'N/A' },
                      { label: 'Currency', value: selectedTransaction.currency || 'LKR' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                        <p className="mt-0.5 text-sm font-semibold text-gray-900">{value}</p>
                      </div>
                    ))}

                    {/* Transaction type */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transaction Type</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mt-0.5 ${
                        selectedTransaction.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedTransaction.transaction_type}
                      </span>
                    </div>

                    {/* Time remaining */}
                    {(selectedTransaction.approval_status === 'PENDING_APPROVAL' || selectedTransaction.approval_status === 'ON_HOLD') && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time to Approve</p>
                        <span className={`inline-flex items-center space-x-1 text-sm font-mono font-semibold mt-0.5 ${
                          getTimeRemaining(selectedTransaction) === 'EXPIRED' ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          <Clock className="w-4 h-4" />
                          <span>{getTimeRemaining(selectedTransaction) || 'No limit'}</span>
                        </span>
                        {selectedTransaction.approval_expires_at && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Deadline: {new Date(selectedTransaction.approval_expires_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Status */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</p>
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium mt-0.5 ${statusConfig[selectedTransaction.approval_status]?.bg} ${statusConfig[selectedTransaction.approval_status]?.color}`}>
                        <span>{statusConfig[selectedTransaction.approval_status]?.label}</span>
                      </span>
                    </div>
                  </div>

                  {selectedTransaction.submitted_by && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-400">
                        Submitted by <span className="font-medium text-gray-600">{selectedTransaction.submitted_by}</span>
                        {selectedTransaction.submitted_for_approval_at && ` on ${new Date(selectedTransaction.submitted_for_approval_at).toLocaleString()}`}
                      </p>
                      {selectedTransaction.approved_by && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {selectedTransaction.approval_status === 'MANUAL_APPROVED' ? 'Approved' : 'Actioned'} by{' '}
                          <span className="font-medium text-gray-600">{selectedTransaction.approved_by}</span>
                          {selectedTransaction.approval_date && ` on ${new Date(selectedTransaction.approval_date).toLocaleString()}`}
                        </p>
                      )}
                    </div>
                  )}

                  {selectedTransaction.approval_notes && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                      <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selectedTransaction.approval_notes}</div>
                    </div>
                  )}

                  {selectedTransaction.rejection_reason && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Rejection / Cancellation Reason</p>
                      <div className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{selectedTransaction.rejection_reason}</div>
                    </div>
                  )}

                  {actionType === 'APPROVE' && (
                    <div className="pt-4 border-t border-gray-200">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Edit Transaction (Audit Trail Maintained)</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Edit form */
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">Editing will maintain an audit trail of all changes.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
                      <select value={editFormData.entity_id} onChange={e => setEditFormData({ ...editFormData, entity_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                        {entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                      <select value={editFormData.transaction_type} onChange={e => setEditFormData({ ...editFormData, transaction_type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Share</label>
                      <select value={editFormData.share_id} onChange={e => setEditFormData({ ...editFormData, share_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                        {shares.map(share => <option key={share.id} value={share.id}>{share.ticker} - {share.share_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Date</label>
                      <input type="date" value={editFormData.transaction_date} onChange={e => setEditFormData({ ...editFormData, transaction_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Shares</label>
                      <input type="number" step="1" value={editFormData.no_of_shares} onChange={e => setEditFormData({ ...editFormData, no_of_shares: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price Per Share</label>
                      <input type="number" step="0.01" value={editFormData.price_per_share} onChange={e => setEditFormData({ ...editFormData, price_per_share: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel Edit</button>
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                  </div>
                </div>
              )}

              {/* Action-specific fields */}
              {!isEditing && actionType !== 'VIEW' && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  {actionType === 'REJECT' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rejection Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={actionFormData.rejection_reason}
                        onChange={e => setActionFormData({ ...actionFormData, rejection_reason: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Provide reason for rejection..."
                      />
                    </div>
                  )}

                  {actionType === 'HOLD' && (
                    <div className="space-y-3">
                      {selectedTransaction.approval_expires_at && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                          <span className="font-medium">Current deadline:</span>{' '}
                          {new Date(selectedTransaction.approval_expires_at).toLocaleString()}
                          {actionFormData.hold_hours && parseFloat(actionFormData.hold_hours) > 0 && (
                            <span className="ml-2 text-blue-600 font-medium">
                              → New deadline: {new Date(new Date(selectedTransaction.approval_expires_at).getTime() + parseFloat(actionFormData.hold_hours) * 3600000).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Extend by (hours) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={actionFormData.hold_hours}
                          onChange={e => setActionFormData({ ...actionFormData, hold_hours: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="e.g., 2 for 2 hours, 0.5 for 30 minutes"
                        />
                      </div>
                    </div>
                  )}

                  {(actionType === 'CANCEL' || actionType === 'CANCEL_APPROVE') && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {actionType === 'CANCEL' ? 'Cancellation Reason' : 'Reason for Cancelling Approval'} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={actionFormData.cancel_reason}
                          onChange={e => setActionFormData({ ...actionFormData, cancel_reason: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                          placeholder="Provide reason for cancellation..."
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                    <textarea
                      value={actionFormData.approval_notes}
                      onChange={e => setActionFormData({ ...actionFormData, approval_notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Add any additional notes..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <button onClick={closeModal} disabled={submitting} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50">
                {actionType === 'VIEW' ? 'Close' : 'Cancel'}
              </button>

              {actionType === 'APPROVE' && !isEditing && (() => {
                const isSelf = selectedTransaction.submitted_by?.toLowerCase() === user?.email?.toLowerCase();
                return (
                  <button
                    onClick={handleApprove}
                    disabled={submitting || isSelf}
                    title={isSelf ? 'Cannot approve your own submission' : ''}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Approving...' : 'Approve Transaction'}
                  </button>
                );
              })()}

              {actionType === 'REJECT' && (
                <button onClick={handleReject} disabled={submitting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {submitting ? 'Rejecting...' : 'Reject Transaction'}
                </button>
              )}

              {actionType === 'HOLD' && (
                <button onClick={handleHold} disabled={submitting} className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50">
                  {submitting ? 'Processing...' : 'Extend Deadline'}
                </button>
              )}

              {actionType === 'CANCEL' && (
                <button onClick={handleCancel} disabled={submitting} className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50">
                  {submitting ? 'Cancelling...' : 'Cancel Transaction'}
                </button>
              )}

              {actionType === 'CANCEL_APPROVE' && (
                <button onClick={handleCancelApprove} disabled={submitting} className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50">
                  {submitting ? 'Processing...' : 'Cancel Approval'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && selectedTransaction && (() => {
        const broker = selectedTransaction.broker_id ? brokers.find(b => b.id === selectedTransaction.broker_id) : null;
        const entity = entities.find(e => e.id === selectedTransaction.entity_id);
        const data = buildEmailData(selectedTransaction);
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
                <button onClick={() => setShowEmailModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Transaction data — compact grid */}
              <div className="px-5 pt-4 pb-3 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${typeColor}`}>{data.transaction_type}</span>
                  <span className="font-semibold text-gray-900 text-sm">{data.ticker} — {data.share}</span>
                  <span className="text-gray-400 text-xs ml-auto">{data.entity}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 border border-gray-200 rounded-lg overflow-hidden">
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
                    ['Brokerage Fee Rate', data.brokerage_fee_rate],
                    ['Brokerage Fee', `LKR ${data.brokerage_fee}`],
                    ['Bank Name', data.bank_name],
                    ['Bank Acc No.', data.bank_acc_no],
                    ['', ''],
                  ].map(([label, value], i) => {
                    const isKey = ['Total Amount', 'CDS Acc Type', 'CDS Acc No.', 'Gross Price / Share', 'Bank Name', 'Bank Acc No.'].includes(label as string);
                    return (
                      <div key={i} className={`flex items-center justify-between px-3 py-1.5 border-b border-gray-100 ${isKey ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                        <span className={`text-xs font-medium ${isKey ? 'text-blue-700' : 'text-gray-500'}`}>{label}</span>
                        <span className={`text-xs font-semibold ${isKey ? 'text-blue-900' : 'text-gray-800'} tabular-nums`}>{value}</span>
                      </div>
                    );
                  })}
                </div>
                {emailNote && (
                  <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 whitespace-pre-line">{emailNote}</div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 mx-5 flex-shrink-0" />

              {/* To / CC / Note / Actions */}
              <div className="px-5 py-3 space-y-2.5 flex-shrink-0">
                {/* To */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-gray-500 w-6 flex-shrink-0">To</label>
                  <div className="flex-1">
                    <input
                      type="email"
                      value={emailAddress}
                      onChange={e => setEmailAddress(e.target.value)}
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
                  <div className="flex items-center justify-between w-full gap-3">
                    <label className="text-xs font-semibold text-gray-500 w-6 flex-shrink-0 pt-1.5">CC</label>
                    <div className="flex-1 space-y-1.5">
                      {ccAddresses.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {ccAddresses.map((addr, i) => {
                            const isEntity = addr === entity?.contact_email_company_individual;
                            return (
                              <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${isEntity ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
                                {addr}
                                <button onClick={() => setCcAddresses(ccAddresses.filter((_, idx) => idx !== i))} disabled={sendingEmail} className="hover:opacity-70"><X className="w-3 h-3" /></button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={ccInput}
                          onChange={e => setCcInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && ccInput.trim()) { e.preventDefault(); setCcAddresses([...ccAddresses, ccInput.trim()]); setCcInput(''); } }}
                          placeholder="Add CC, press Enter"
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          disabled={sendingEmail}
                        />
                        <button type="button" onClick={() => { if (ccInput.trim()) { setCcAddresses([...ccAddresses, ccInput.trim()]); setCcInput(''); } }} disabled={sendingEmail || !ccInput.trim()} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm">
                          <Plus className="w-4 h-4" />
                        </button>
                        {entity?.contact_email_company_individual && !ccAddresses.includes(entity.contact_email_company_individual) && (
                          <button type="button" onClick={() => setCcAddresses([...ccAddresses, entity.contact_email_company_individual!])} className="px-2 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 whitespace-nowrap">
                            + {entity.name}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Note */}
                <div className="flex items-start gap-3">
                  <label className="text-xs font-semibold text-gray-500 w-6 flex-shrink-0 pt-1.5">Note</label>
                  <textarea
                    value={emailNote}
                    onChange={e => setEmailNote(e.target.value)}
                    rows={2}
                    disabled={sendingEmail}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    placeholder="Optional message..."
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setShowEmailModal(false)} disabled={sendingEmail} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">Cancel</button>
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
    </div>
  );
}
