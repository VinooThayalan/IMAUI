import { CheckCircle, XCircle, Clock, Edit2, Pause, Printer } from 'lucide-react';
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
  validity_period_hours?: number;
  expires_at?: string;
  pdf_url?: string;
  pdf_uploaded_at?: string;
  pdf_uploaded_by?: string;
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
  const [sortColumn, setSortColumn] = useState<string>('request_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TransactionRequest | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'HOLD' | 'VIEW'>('APPROVE');
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
    hold_duration_value: '',
    email: ''
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
      const { data: allRequests } = await supabase
        .from('transaction_requests')
        .select('*')
        .in('status', ['HOLD', 'PENDING']);

      if (!allRequests || allRequests.length === 0) return;

      const now = new Date();
      const expiredRequests = allRequests.filter(req => {
        if (req.status === 'HOLD' && req.hold_until && new Date(req.hold_until) <= now) {
          return true;
        }
        if ((req.status === 'HOLD' || req.status === 'PENDING') && req.expires_at && new Date(req.expires_at) <= now) {
          return true;
        }
        return false;
      });

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

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function getTimeRemaining(request: TransactionRequest): string {
    const now = new Date();
    let targetDate: Date | null = null;

    if (request.status === 'HOLD' && request.hold_until) {
      targetDate = new Date(request.hold_until);
    } else if ((request.status === 'PENDING' || request.status === 'HOLD') && request.expires_at) {
      targetDate = new Date(request.expires_at);
    }

    if (!targetDate) return '';

    const diffMs = targetDate.getTime() - now.getTime();
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

  function handlePrintApproval(request: TransactionRequest) {
    const shareInfo = getShareInfo(request.share_id);
    const entityName = getEntityName(request.entity_id);
    const totalShares = Number(request.no_of_shares).toLocaleString();
    const grossPrice = Number(request.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const totalAmount = Number(request.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const currentDate = new Date().toLocaleDateString();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Transaction Approval - ${request.id}</title>
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
              <td>${request.transaction_type === 'BUY' ? 'Purchase' : 'Sale'}</td>
            </tr>
            <tr>
              <td>Name of the Investment</td>
              <td>&lt;Transaction record ID&gt;</td>
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
                <td>${new Date(request.request_date).toLocaleDateString()}</td>
                <td>xx</td>
                <td>xx</td>
                <td>xx</td>
                <td class="green-bg">xx</td>
                <td class="green-bg">xx</td>
                <td class="green-bg">xx</td>
                <td>xx</td>
                <td>...</td>
                <td>xx</td>
              </tr>
              <tr>
                <td>xx</td>
                <td>xx</td>
                <td>xx</td>
                <td>xx</td>
                <td class="green-bg">xx</td>
                <td class="green-bg">xx</td>
                <td class="green-bg">xx</td>
                <td>xx</td>
                <td>...</td>
                <td>xx</td>
              </tr>
              <tr>
                <td>xx</td>
                <td>xx</td>
                <td>xx</td>
                <td>xx</td>
                <td class="green-bg">xx</td>
                <td class="green-bg">xx</td>
                <td class="green-bg">xx</td>
                <td>xx</td>
                <td>...</td>
                <td>xx</td>
              </tr>
              <tr class="total-row">
                <td colspan="2">Total Sales Values /Purchase Values</td>
                <td>yy</td>
                <td colspan="3" class="green-text">[Total No. shares]</td>
                <td colspan="4" class="green-text">[Total Purchase value or sales Value]</td>
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

  function openActionModal(request: TransactionRequest, action: 'APPROVE' | 'REJECT' | 'HOLD' | 'VIEW') {
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
      hold_duration_value: '',
      email: ''
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
        if (!actionFormData.email.trim()) {
          alert('Please provide an email address to send the approved transaction');
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(actionFormData.email)) {
          alert('Please provide a valid email address');
          return;
        }

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

      if (actionType === 'APPROVE' && actionFormData.email) {
        alert(`Transaction approved successfully. A PDF will be sent to ${actionFormData.email}`);
      } else {
        alert(`Transaction ${actionType.toLowerCase()}ed successfully`);
      }
      setShowActionModal(false);
      loadData();
    } catch (error) {
      console.error('Error processing action:', error);
      alert('Failed to process action');
    } finally {
      setSubmitting(false);
    }
  }

  const sortedRequests = [...requests].sort((a, b) => {
    let aVal: any = a[sortColumn as keyof TransactionRequest];
    let bVal: any = b[sortColumn as keyof TransactionRequest];

    if (sortColumn === 'entity_id') {
      aVal = getEntityName(a.entity_id);
      bVal = getEntityName(b.entity_id);
    } else if (sortColumn === 'share_id') {
      aVal = getShareInfo(a.share_id).ticker;
      bVal = getShareInfo(b.share_id).ticker;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

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
                <th
                  onClick={() => handleSort('entity_id')}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Entity {sortColumn === 'entity_id' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('transaction_type')}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Type {sortColumn === 'transaction_type' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('share_id')}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Share {sortColumn === 'share_id' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('no_of_shares')}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Quantity {sortColumn === 'no_of_shares' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('total_amount')}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Amount {sortColumn === 'total_amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Status {sortColumn === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time Left</th>
                <th
                  onClick={() => handleSort('requested_by')}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Requested By {sortColumn === 'requested_by' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedRequests.map((request) => {
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTimeRemaining(request) && (
                        <div className={`text-sm font-semibold ${
                          getTimeRemaining(request) === 'Expired' ? 'text-red-600' : 'text-orange-600'
                        }`}>
                          {getTimeRemaining(request)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.requested_by}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handlePrintApproval(request)}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          title="Print"
                        >
                          <Printer className="w-5 h-5" />
                        </button>
                        {(request.status === 'PENDING' || request.status === 'HOLD') && (
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
                            {request.status === 'PENDING' && (
                              <button
                                onClick={() => openActionModal(request, 'HOLD')}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Hold"
                              >
                                <Pause className="w-5 h-5" />
                              </button>
                            )}
                          </>
                        )}
                        {(request.status === 'APPROVED' || request.status === 'REJECTED') && (
                          <button
                            onClick={() => openActionModal(request, 'VIEW')}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
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
                {actionType === 'VIEW' && 'Transaction Details'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {actionType === 'VIEW' ? 'View transaction approval details' : (isEditing ? 'Edit transaction details before processing' : 'Review transaction details')}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {actionType === 'VIEW' ? (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-700">Entity:</span>
                        <div className="text-gray-900">{getEntityName(selectedRequest.entity_id)}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Investment</span>
                        <div className="text-gray-900">{selectedRequest.transaction_type === 'BUY' ? 'Purchase' : 'Sale'}</div>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Name of the Investment</span>
                        <div className="text-gray-900 text-xs">&lt;Transaction record ID&gt;</div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr>
                          <th rowSpan={2} className="border border-gray-300 px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-700 text-left">
                            Date of Transaction
                          </th>
                          <th rowSpan={2} className="border border-gray-300 px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-700 text-left">
                            Share
                          </th>
                          <th rowSpan={2} className="border border-gray-300 px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-700 text-left">
                            Buy/Sell
                          </th>
                          <th rowSpan={2} className="border border-gray-300 px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-700 text-left">
                            Number of Shares
                          </th>
                          <th colSpan={2} className="border border-gray-300 px-3 py-2 bg-green-200 text-xs font-semibold text-green-900 text-center">
                            Per Share Sales Price / Purchase Cost (Gross)
                          </th>
                          <th rowSpan={2} className="border border-gray-300 px-3 py-2 bg-green-200 text-xs font-semibold text-green-900 text-left">
                            Per Share Sales Price / Purchase Cost (Net)
                          </th>
                          <th rowSpan={2} className="border border-gray-300 px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-700 text-left">
                            Purchase/ Sale Value
                          </th>
                          <th rowSpan={2} className="border border-gray-300 px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-700 text-left">
                            CDS Acc. No
                          </th>
                          <th rowSpan={2} className="border border-gray-300 px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-700 text-left">
                            Broker Name
                          </th>
                        </tr>
                        <tr>
                          <th colSpan={2} className="border border-gray-300 px-3 py-1 bg-green-200"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-gray-300 px-3 py-2 text-sm">{new Date(selectedRequest.request_date).toLocaleDateString()}</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm bg-green-100 text-green-900 font-semibold">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm bg-green-100 text-green-900 font-semibold">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm bg-green-100 text-green-900 font-semibold">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">...</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm bg-green-100 text-green-900 font-semibold">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm bg-green-100 text-green-900 font-semibold">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm bg-green-100 text-green-900 font-semibold">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">...</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm bg-green-100 text-green-900 font-semibold">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm bg-green-100 text-green-900 font-semibold">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm bg-green-100 text-green-900 font-semibold">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">...</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">xx</td>
                        </tr>
                        <tr className="bg-gray-100">
                          <td colSpan={2} className="border border-gray-300 px-3 py-2 text-sm font-semibold text-green-900">
                            Total Sales Values /Purchase Values
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm font-semibold">yy</td>
                          <td colSpan={3} className="border border-gray-300 px-3 py-2 text-sm text-green-900 italic">
                            [Total No. shares]
                          </td>
                          <td colSpan={4} className="border border-gray-300 px-3 py-2 text-sm text-green-900 italic">
                            [Total Purchase value or sales Value]
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={10} className="px-3 py-4"></td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="border-r-0 border border-gray-300 px-3 py-2 text-sm">Authorized by</td>
                          <td colSpan={7} className="border-l-0 border border-gray-300 px-3 py-2 text-sm">..........................</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="border-r-0 border border-gray-300 px-3 py-2 text-sm">Authorized date</td>
                          <td colSpan={7} className="border-l-0 border border-gray-300 px-3 py-2 text-sm">..........................</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="border-r-0 border border-gray-300 px-3 py-2 text-sm">Generate Date</td>
                          <td colSpan={7} className="border-l-0 border border-gray-300 px-3 py-2 text-sm">&lt;generated date&gt;</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : !isEditing ? (
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

              {actionType === 'APPROVE' && !isEditing && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    value={actionFormData.email}
                    onChange={(e) => setActionFormData({ ...actionFormData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email to send approved transaction PDF"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The approved transaction PDF will be sent to this email address
                  </p>
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
                {actionType === 'VIEW' ? 'Close' : 'Cancel'}
              </button>
              {actionType !== 'VIEW' && (
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
