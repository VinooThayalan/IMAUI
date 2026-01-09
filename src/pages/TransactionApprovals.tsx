import { CheckCircle, XCircle, Clock, Upload, Eye, Edit2, Pause } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TransactionRequest {
  id: string;
  entity_id: string;
  share_id: string;
  transaction_type: string;
  no_of_shares: number;
  price_per_share: number;
  total_amount: number;
  request_date: string;
  status: string;
  requested_by: string;
  notes: string;
  approved_by?: string;
  approval_date?: string;
  rejection_reason?: string;
  hold_until?: string;
  hold_duration_minutes?: number;
  edited_by?: string;
  edit_notes?: string;
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
  ticker: string;
}

const statusConfig = {
  PENDING: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  APPROVED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  REJECTED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  HOLD: { icon: Pause, color: 'text-blue-600', bg: 'bg-blue-100' },
  CANCELLED: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-100' }
};

const typeColors = {
  BUY: 'bg-green-100 text-green-800',
  SELL: 'bg-red-100 text-red-800',
  DIVIDEND: 'bg-blue-100 text-blue-800',
  SCRIP: 'bg-purple-100 text-purple-800',
  COST: 'bg-orange-100 text-orange-800'
};

export function TransactionApprovals() {
  const [requests, setRequests] = useState<TransactionRequest[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);

  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TransactionRequest | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'HOLD'>('APPROVE');
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editFormData, setEditFormData] = useState({
    entity_id: '',
    share_id: '',
    transaction_type: '',
    no_of_shares: '',
    price_per_share: '',
    notes: ''
  });

  const [actionFormData, setActionFormData] = useState({
    notes: '',
    rejection_reason: '',
    hold_duration_type: 'minutes',
    hold_duration_value: ''
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(checkHeldTransactions, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [requestsRes, entitiesRes, sharesRes] = await Promise.all([
        supabase.from('transaction_requests').select('*').order('request_date', { ascending: false }),
        supabase.from('entities').select('id, name').order('name'),
        supabase.from('shares').select('id, name, ticker').order('name')
      ]);

      if (requestsRes.error) throw requestsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;

      setRequests(requestsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function checkHeldTransactions() {
    try {
      const { data: heldRequests } = await supabase
        .from('transaction_requests')
        .select('*')
        .eq('status', 'HOLD')
        .not('hold_until', 'is', null);

      if (!heldRequests || heldRequests.length === 0) return;

      const now = new Date();
      const expiredRequests = heldRequests.filter(req =>
        req.hold_until && new Date(req.hold_until) <= now
      );

      for (const req of expiredRequests) {
        await supabase
          .from('transaction_requests')
          .update({
            status: 'CANCELLED',
            updated_at: new Date().toISOString()
          })
          .eq('id', req.id);
      }

      if (expiredRequests.length > 0) {
        loadData();
      }
    } catch (error) {
      console.error('Error checking held transactions:', error);
    }
  }

  function getEntityName(entityId: string) {
    return entities.find(e => e.id === entityId)?.name || 'Unknown';
  }

  function getShareInfo(shareId: string) {
    const share = shares.find(s => s.id === shareId);
    return share ? { ticker: share.ticker, name: share.name } : { ticker: 'Unknown', name: '' };
  }

  function openActionModal(request: TransactionRequest, action: 'APPROVE' | 'REJECT' | 'HOLD') {
    setSelectedRequest(request);
    setActionType(action);
    setIsEditing(false);

    setEditFormData({
      entity_id: request.entity_id,
      share_id: request.share_id,
      transaction_type: request.transaction_type,
      no_of_shares: String(request.no_of_shares),
      price_per_share: String(request.price_per_share),
      notes: request.notes || ''
    });

    setActionFormData({
      notes: '',
      rejection_reason: '',
      hold_duration_type: 'minutes',
      hold_duration_value: ''
    });

    setShowActionModal(true);
  }

  function calculateTotalAmount() {
    const shares = parseFloat(editFormData.no_of_shares) || 0;
    const price = parseFloat(editFormData.price_per_share) || 0;
    return shares * price;
  }

  async function handleSubmitAction() {
    if (!selectedRequest) return;

    try {
      setSubmitting(true);

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (isEditing) {
        updateData.entity_id = editFormData.entity_id;
        updateData.share_id = editFormData.share_id;
        updateData.transaction_type = editFormData.transaction_type;
        updateData.no_of_shares = parseFloat(editFormData.no_of_shares);
        updateData.price_per_share = parseFloat(editFormData.price_per_share);
        updateData.total_amount = calculateTotalAmount();
        updateData.notes = editFormData.notes;
        updateData.edited_by = 'Current User';
        updateData.edit_notes = actionFormData.notes;
      }

      if (actionType === 'APPROVE') {
        updateData.status = 'APPROVED';
        updateData.approved_by = 'Current User';
        updateData.approval_date = new Date().toISOString();
      } else if (actionType === 'REJECT') {
        if (!actionFormData.rejection_reason.trim()) {
          alert('Please provide a rejection reason');
          return;
        }
        updateData.status = 'REJECTED';
        updateData.rejection_reason = actionFormData.rejection_reason;
        updateData.approved_by = 'Current User';
        updateData.approval_date = new Date().toISOString();
      } else if (actionType === 'HOLD') {
        if (!actionFormData.hold_duration_value) {
          alert('Please specify hold duration');
          return;
        }

        const durationValue = parseInt(actionFormData.hold_duration_value);
        const durationMinutes = actionFormData.hold_duration_type === 'days'
          ? durationValue * 24 * 60
          : durationValue;

        const holdUntil = new Date();
        holdUntil.setMinutes(holdUntil.getMinutes() + durationMinutes);

        updateData.status = 'HOLD';
        updateData.hold_until = holdUntil.toISOString();
        updateData.hold_duration_minutes = durationMinutes;
      }

      const { error } = await supabase
        .from('transaction_requests')
        .update(updateData)
        .eq('id', selectedRequest.id);

      if (error) throw error;

      alert(`Transaction ${actionType.toLowerCase()}ed successfully`);
      setShowActionModal(false);
      loadData();
    } catch (error) {
      console.error('Error processing action:', error);
      alert('Failed to process action');
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;
  const holdCount = requests.filter(r => r.status === 'HOLD').length;

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
          <h1 className="text-3xl font-bold text-gray-900">Transaction Approvals</h1>
          <p className="text-gray-500 mt-1">Review and approve transaction requests</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{pendingCount}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">On Hold</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{holdCount}</p>
            </div>
            <Pause className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Approved</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{approvedCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Rejected</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{rejectedCount}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Transaction Requests</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Requested By</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.map((request) => {
                const StatusIcon = statusConfig[request.status as keyof typeof statusConfig]?.icon || Clock;
                const shareInfo = getShareInfo(request.share_id);

                return (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{getEntityName(request.entity_id)}</div>
                        <div className="text-xs text-gray-500">{new Date(request.request_date).toLocaleDateString()}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${typeColors[request.transaction_type as keyof typeof typeColors]}`}>
                        {request.transaction_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">{shareInfo.ticker}</div>
                      <div className="text-xs text-gray-500">{shareInfo.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Number(request.no_of_shares).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      Rs. {Number(request.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <StatusIcon className={`w-4 h-4 ${statusConfig[request.status as keyof typeof statusConfig]?.color}`} />
                        <span className={`text-xs font-semibold ${statusConfig[request.status as keyof typeof statusConfig]?.color}`}>
                          {request.status}
                        </span>
                      </div>
                      {request.status === 'HOLD' && request.hold_until && (
                        <div className="text-xs text-gray-500 mt-1">
                          Until: {new Date(request.hold_until).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.requested_by}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {request.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => openActionModal(request, 'APPROVE')}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => openActionModal(request, 'REJECT')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => openActionModal(request, 'HOLD')}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Hold"
                            >
                              <Pause className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {requests.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No transaction requests found</p>
            </div>
          )}
        </div>
      </div>

      {showActionModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {actionType === 'APPROVE' && 'Approve Transaction'}
                {actionType === 'REJECT' && 'Reject Transaction'}
                {actionType === 'HOLD' && 'Hold Transaction'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {isEditing ? 'Edit transaction details before processing' : 'Review transaction details'}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {!isEditing ? (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Entity:</span>
                    <span className="text-sm font-bold text-gray-900">{getEntityName(selectedRequest.entity_id)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Share:</span>
                    <span className="text-sm font-bold text-gray-900">
                      {getShareInfo(selectedRequest.share_id).ticker} - {getShareInfo(selectedRequest.share_id).name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Type:</span>
                    <span className={`text-sm font-bold px-2 py-1 rounded ${typeColors[selectedRequest.transaction_type as keyof typeof typeColors]}`}>
                      {selectedRequest.transaction_type}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Quantity:</span>
                    <span className="text-sm font-bold text-gray-900">{Number(selectedRequest.no_of_shares).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Price per Share:</span>
                    <span className="text-sm font-bold text-gray-900">
                      Rs. {Number(selectedRequest.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Total Amount:</span>
                    <span className="text-sm font-bold text-gray-900">
                      Rs. {Number(selectedRequest.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Requested By:</span>
                    <span className="text-sm font-bold text-gray-900">{selectedRequest.requested_by}</span>
                  </div>
                  {selectedRequest.notes && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Notes:</span>
                      <p className="text-sm text-gray-900 mt-1">{selectedRequest.notes}</p>
                    </div>
                  )}

                  {actionType === 'APPROVE' && (
                    <div className="pt-3 border-t border-gray-200">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Edit Transaction Details</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entity</label>
                    <select
                      value={editFormData.entity_id}
                      onChange={(e) => setEditFormData({ ...editFormData, entity_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {entities.map(entity => (
                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Share</label>
                    <select
                      value={editFormData.share_id}
                      onChange={(e) => setEditFormData({ ...editFormData, share_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {shares.map(share => (
                        <option key={share.id} value={share.id}>{share.ticker} - {share.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Type</label>
                      <select
                        value={editFormData.transaction_type}
                        onChange={(e) => setEditFormData({ ...editFormData, transaction_type: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Shares</label>
                      <input
                        type="number"
                        step="1"
                        value={editFormData.no_of_shares}
                        onChange={(e) => setEditFormData({ ...editFormData, no_of_shares: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Price per Share (Rs.)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.price_per_share}
                        onChange={(e) => setEditFormData({ ...editFormData, price_per_share: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Total Amount (Rs.)</label>
                      <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-semibold">
                        {calculateTotalAmount().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                    <textarea
                      rows={3}
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Cancel Editing
                    </button>
                  </div>
                </div>
              )}

              {actionType === 'REJECT' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={actionFormData.rejection_reason}
                    onChange={(e) => setActionFormData({ ...actionFormData, rejection_reason: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Provide a detailed reason for rejection..."
                    required
                  />
                </div>
              )}

              {actionType === 'HOLD' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Hold Duration <span className="text-red-600">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="number"
                        min="1"
                        value={actionFormData.hold_duration_value}
                        onChange={(e) => setActionFormData({ ...actionFormData, hold_duration_value: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Duration"
                        required
                      />
                      <select
                        value={actionFormData.hold_duration_type}
                        onChange={(e) => setActionFormData({ ...actionFormData, hold_duration_type: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Transaction will be automatically cancelled after this duration expires
                    </p>
                  </div>
                </div>
              )}

              {isEditing && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Edit Notes</label>
                  <textarea
                    rows={3}
                    value={actionFormData.notes}
                    onChange={(e) => setActionFormData({ ...actionFormData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe what was changed..."
                  />
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-4">
              <button
                onClick={() => setShowActionModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAction}
                className={`px-6 py-2 rounded-lg font-medium text-white transition-colors disabled:bg-gray-400 ${
                  actionType === 'APPROVE'
                    ? 'bg-green-600 hover:bg-green-700'
                    : actionType === 'REJECT'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={submitting}
              >
                {submitting ? 'Processing...' : `${actionType} Transaction`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
