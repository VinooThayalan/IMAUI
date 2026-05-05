import { CheckCircle, XCircle, Clock, CreditCard as Edit2, Pause, Eye } from 'lucide-react';
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
  created_at: string;
  currency: string | null;
  settlement_date: string | null;
}

interface User {
  id: string;
  email: string;
}

interface Entity {
  id: string;
  name: string;
}

interface Share {
  id: string;
  name: string;
  ticker: string;
}

interface Broker {
  id: string;
  broker_name: string;
}

const statusConfig = {
  PENDING_APPROVAL: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Pending' },
  APPROVED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Approved' },
  AUTO_APPROVED: { icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Auto Approved' },
  REJECTED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Rejected' },
  EXPIRED: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Expired' },
  ON_HOLD: { icon: Pause, color: 'text-orange-600', bg: 'bg-orange-100', label: 'On Hold' }
};

export function TransactionApprovals() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [showModal, setShowModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'HOLD' | 'VIEW'>('VIEW');
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
    hold_hours: ''
  });

  useEffect(() => {
    loadData();
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    const expiryInterval = setInterval(() => {
      checkExpiredTransactions();
    }, 10000);
    return () => {
      clearInterval(timeInterval);
      clearInterval(expiryInterval);
    };
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [transactionsRes, entitiesRes, sharesRes, brokersRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .in('approval_status', ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'ON_HOLD'])
          .order('submitted_for_approval_at', { ascending: false, nullsFirst: false }),
        supabase.from('entities').select('id, name').order('name'),
        supabase.from('shares').select('id, name, ticker').order('name'),
        supabase.from('brokers').select('id, broker_name').order('broker_name')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;
      if (brokersRes.error) throw brokersRes.error;

      setTransactions(transactionsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
      setBrokers(brokersRes.data || []);
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
        await supabase
          .from('transactions')
          .update({ approval_status: 'EXPIRED' })
          .eq('id', t.id);
      }

      setTransactions(prevTransactions =>
        prevTransactions.map(trans =>
          expired.some(exp => exp.id === trans.id)
            ? { ...trans, approval_status: 'EXPIRED' }
            : trans
        )
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
    return share ? `${share.ticker} - ${share.name}` : shareId;
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

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  function checkAutoApproval(transaction: Transaction): boolean {
    return transaction.submitted_by === user?.email;
  }

  function openModal(transaction: Transaction, type: 'VIEW' | 'APPROVE' | 'REJECT' | 'HOLD') {
    setSelectedTransaction(transaction);
    setActionType(type);
    setIsEditing(false);
    setActionFormData({ approval_notes: '', rejection_reason: '', hold_hours: '' });

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
        approval_status: 'APPROVED',
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

      const { error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', selectedTransaction.id);

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

      const { error } = await supabase
        .from('transactions')
        .update({
          approval_status: 'REJECTED',
          approved_by: user?.email || 'system',
          approval_date: new Date().toISOString(),
          rejection_reason: actionFormData.rejection_reason,
          approval_notes: actionFormData.approval_notes || null
        })
        .eq('id', selectedTransaction.id);

      if (error) throw error;

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

      const { error } = await supabase
        .from('transactions')
        .update({
          approval_expires_at: newExpiry.toISOString(),
          approval_validity_hours: (selectedTransaction.approval_validity_hours || 0) + additionalHours,
          approval_notes: actionFormData.approval_notes || selectedTransaction.approval_notes
        })
        .eq('id', selectedTransaction.id);

      if (error) throw error;

      alert(`Transaction approval extended by ${additionalHours} hours`);
      closeModal();
      loadData();
    } catch (error) {
      console.error('Error holding transaction:', error);
      alert('Failed to hold transaction');
    } finally {
      setSubmitting(false);
    }
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transaction Approvals</h1>
          <p className="text-gray-600 mt-1">Review and approve pending transactions</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Transaction Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Share</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Transaction Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">No. of Shares</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time to Approve</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((transaction) => {
                const timeRemaining = getTimeRemaining(transaction);
                const StatusIcon = statusConfig[transaction.approval_status as keyof typeof statusConfig]?.icon || Clock;
                const statusColor = statusConfig[transaction.approval_status as keyof typeof statusConfig]?.color || 'text-gray-600';
                const statusBg = statusConfig[transaction.approval_status as keyof typeof statusConfig]?.bg || 'bg-gray-100';

                return (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{getEntityName(transaction.entity_id)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        transaction.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.transaction_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{getShareInfo(transaction.share_id)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(transaction.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {Number(transaction.no_of_shares).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      LKR {Number(transaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {(transaction.approval_status === 'PENDING_APPROVAL' || transaction.approval_status === 'ON_HOLD') ? (
                        <span className={`inline-flex items-center space-x-1 ${
                          timeRemaining === 'EXPIRED' ? 'text-red-600 font-semibold' : 'text-gray-700'
                        }`}>
                          <Clock className="w-4 h-4" />
                          <span>{timeRemaining || 'No limit'}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBg} ${statusColor}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span>{statusConfig[transaction.approval_status as keyof typeof statusConfig]?.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openModal(transaction, 'VIEW')}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(transaction.approval_status === 'PENDING_APPROVAL' || transaction.approval_status === 'ON_HOLD') && (() => {
                          const isSelfSubmitted = transaction.submitted_by?.toLowerCase() === user?.email?.toLowerCase();
                          return isSelfSubmitted ? (
                            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded font-medium">
                              Self-submitted
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => openModal(transaction, 'APPROVE')}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Approve"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openModal(transaction, 'REJECT')}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Reject"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openModal(transaction, 'HOLD')}
                                className="p-1 text-yellow-600 hover:bg-yellow-50 rounded"
                                title="Hold / Extend Time"
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {transactions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No transaction approvals found
            </div>
          )}
        </div>
      </div>

      {showModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {actionType === 'VIEW' && 'Transaction Details'}
                {actionType === 'APPROVE' && 'Approve Transaction'}
                {actionType === 'REJECT' && 'Reject Transaction'}
                {actionType === 'HOLD' && 'Hold / Extend Approval Time'}
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {selectedTransaction.approval_status === 'AUTO_APPROVED' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <p className="text-sm text-emerald-800 font-medium">
                    Auto-approved — submitted by the designated approver for this entity
                  </p>
                </div>
              )}
              {selectedTransaction.approval_status === 'PENDING_APPROVAL' &&
                selectedTransaction.submitted_by?.toLowerCase() === user?.email?.toLowerCase() && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <p className="text-sm text-amber-800 font-medium">
                    You submitted this transaction — it must be approved by another user
                  </p>
                </div>
              )}

              {!isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Entity</label>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{getEntityName(selectedTransaction.entity_id)}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Transaction Type</label>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedTransaction.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedTransaction.transaction_type}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Share</label>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{getShareInfo(selectedTransaction.share_id)}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Transaction Date</label>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {new Date(selectedTransaction.transaction_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Number of Shares</label>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {Number(selectedTransaction.no_of_shares).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Price Per Share</label>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        LKR {Number(selectedTransaction.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Total Purchase/Sale Value</label>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        LKR {Number(selectedTransaction.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Broker</label>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{getBrokerName(selectedTransaction.broker_id)}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Order Type</label>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{selectedTransaction.order_type || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">CDS Account</label>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{selectedTransaction.cds_account_id || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Brokerage Fee</label>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        LKR {Number(selectedTransaction.fees || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Net Price Per Share</label>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        LKR {Number(selectedTransaction.net_price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Currency</label>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{selectedTransaction.currency || 'LKR'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Time to Approve</label>
                      <div className="mt-1">
                        {(selectedTransaction.approval_status === 'PENDING_APPROVAL' || selectedTransaction.approval_status === 'ON_HOLD') ? (
                          <span className={`inline-flex items-center space-x-1 text-sm font-semibold ${
                            getTimeRemaining(selectedTransaction) === 'EXPIRED' ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            <Clock className="w-4 h-4" />
                            <span>{getTimeRemaining(selectedTransaction) || 'No limit'}</span>
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Status</label>
                      <div className="mt-1">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          statusConfig[selectedTransaction.approval_status as keyof typeof statusConfig]?.bg
                        } ${statusConfig[selectedTransaction.approval_status as keyof typeof statusConfig]?.color}`}>
                          <span>{statusConfig[selectedTransaction.approval_status as keyof typeof statusConfig]?.label}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedTransaction.approval_notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Previous Notes</label>
                      <div className="mt-1 text-sm text-gray-700 bg-gray-50 rounded p-2">
                        {selectedTransaction.approval_notes}
                      </div>
                    </div>
                  )}

                  {selectedTransaction.rejection_reason && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Rejection Reason</label>
                      <div className="mt-1 text-sm text-red-700 bg-red-50 rounded p-2">
                        {selectedTransaction.rejection_reason}
                      </div>
                    </div>
                  )}

                  {actionType === 'APPROVE' && (
                    <div className="pt-4 border-t border-gray-200">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Edit Transaction (Audit Trail Maintained)</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      Editing this transaction will maintain an audit trail of all changes.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
                      <select
                        value={editFormData.entity_id}
                        onChange={(e) => setEditFormData({ ...editFormData, entity_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {entities.map(entity => (
                          <option key={entity.id} value={entity.id}>{entity.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                      <select
                        value={editFormData.transaction_type}
                        onChange={(e) => setEditFormData({ ...editFormData, transaction_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Share</label>
                      <select
                        value={editFormData.share_id}
                        onChange={(e) => setEditFormData({ ...editFormData, share_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {shares.map(share => (
                          <option key={share.id} value={share.id}>{share.ticker} - {share.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Date</label>
                      <input
                        type="date"
                        value={editFormData.transaction_date}
                        onChange={(e) => setEditFormData({ ...editFormData, transaction_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Shares</label>
                      <input
                        type="number"
                        step="1"
                        value={editFormData.no_of_shares}
                        onChange={(e) => setEditFormData({ ...editFormData, no_of_shares: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price Per Share</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.price_per_share}
                        onChange={(e) => setEditFormData({ ...editFormData, price_per_share: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel Edit
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {actionType !== 'VIEW' && !isEditing && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  {actionType === 'REJECT' && (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm text-amber-800">
                          Upon rejection, any on-hold cash will be released back to the entity's available balance.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rejection Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={actionFormData.rejection_reason}
                          onChange={(e) => setActionFormData({ ...actionFormData, rejection_reason: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Provide reason for rejection..."
                        />
                      </div>
                    </>
                  )}

                  {actionType === 'HOLD' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Extend Approval Time By (hours) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={actionFormData.hold_hours}
                        onChange={(e) => setActionFormData({ ...actionFormData, hold_hours: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 2 for 2 hours, 0.5 for 30 minutes"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={actionFormData.approval_notes}
                      onChange={(e) => setActionFormData({ ...actionFormData, approval_notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add any additional notes..."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                {actionType === 'VIEW' ? 'Close' : 'Cancel'}
              </button>
              {actionType === 'APPROVE' && !isEditing && (() => {
                const isSelf = selectedTransaction.submitted_by?.toLowerCase() === user?.email?.toLowerCase();
                return (
                  <button
                    onClick={handleApprove}
                    disabled={submitting || isSelf}
                    title={isSelf ? 'Cannot approve your own submission' : ''}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Approving...' : 'Approve Transaction'}
                  </button>
                );
              })()}
              {actionType === 'REJECT' && (
                <button
                  onClick={handleReject}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? 'Rejecting...' : 'Reject Transaction'}
                </button>
              )}
              {actionType === 'HOLD' && (
                <button
                  onClick={handleHold}
                  disabled={submitting}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Extend Time'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
