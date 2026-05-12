import { CheckCircle, XCircle, Search, FileText, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface BuyAndSellApproval {
  id: string;
  buy_sell_note_id: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submitted_by: string;
  submitted_date: string;
  reviewed_by?: string;
  reviewed_date?: string;
  remarks?: string;
  priority: 'Low' | 'Medium' | 'High';
  created_at: string;
  updated_at: string;
}

interface BuyAndSellNote {
  id: string;
  transaction_id: string;
  note_type: 'Buy' | 'Sell';
  note_number: string;
  broker: string;
  settlement_date: string;
  file_url?: string;
  remarks?: string;
}

interface Transaction {
  id: string;
  entity_id: string;
  share_id: string;
  transaction_type: string;
  transaction_date: string;
  no_of_shares: number;
  price_per_share: number;
  total_amount: number;
}

interface Entity {
  id: string;
  entity_id: string;
  name: string;
}

interface Share {
  id: string;
  ticker: string;
  share_name: string;
}

export function BuyAndSellApprovals() {
  const [approvals, setApprovals] = useState<BuyAndSellApproval[]>([]);
  const [notes, setNotes] = useState<BuyAndSellNote[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<BuyAndSellApproval | null>(null);
  const [reviewAction, setReviewAction] = useState<'Approved' | 'Rejected'>('Approved');
  const [reviewRemarks, setReviewRemarks] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [approvalsRes, notesRes, transactionsRes, entitiesRes, sharesRes] = await Promise.all([
        supabase.from('buy_sell_approvals').select('*').order('submitted_date', { ascending: false }),
        supabase.from('buy_sell_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('entities').select('id, entity_id, name').order('name'),
        supabase.from('shares').select('id, ticker, share_name').order('share_name')
      ]);

      if (approvalsRes.error) throw approvalsRes.error;
      if (notesRes.error) throw notesRes.error;
      if (transactionsRes.error) throw transactionsRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (sharesRes.error) throw sharesRes.error;

      setApprovals(approvalsRes.data || []);
      setNotes(notesRes.data || []);
      setTransactions(transactionsRes.data || []);
      setEntities(entitiesRes.data || []);
      setShares(sharesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleReview() {
    if (!selectedApproval) return;

    try {
      const { error } = await supabase
        .from('buy_sell_approvals')
        .update({
          status: reviewAction,
          reviewed_by: 'Current User',
          reviewed_date: new Date().toISOString(),
          remarks: reviewRemarks || null
        })
        .eq('id', selectedApproval.id);

      if (error) throw error;

      await loadData();
      handleCloseReviewModal();
    } catch (error) {
      console.error('Error reviewing approval:', error);
      alert('Failed to review approval');
    }
  }

  function handleOpenReviewModal(approval: BuyAndSellApproval, action: 'Approved' | 'Rejected') {
    setSelectedApproval(approval);
    setReviewAction(action);
    setReviewRemarks('');
    setShowReviewModal(true);
  }

  function handleCloseReviewModal() {
    setShowReviewModal(false);
    setSelectedApproval(null);
    setReviewRemarks('');
  }

  function getNoteDetails(noteId: string) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return null;

    const transaction = transactions.find(t => t.id === note.transaction_id);
    if (!transaction) return { note, transaction: null, entity: null, share: null };

    const entity = entities.find(e => e.id === transaction.entity_id);
    const share = shares.find(s => s.id === transaction.share_id);

    return { note, transaction, entity, share };
  }

  const filteredApprovals = approvals.filter(approval => {
    const noteDetails = getNoteDetails(approval.buy_sell_note_id);
    if (!noteDetails) return false;

    const matchesSearch =
      noteDetails.note.note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      noteDetails.note.broker.toLowerCase().includes(searchTerm.toLowerCase()) ||
      approval.submitted_by.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || approval.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Buy & Sell Approvals</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <span className="font-semibold text-yellow-600">
                {approvals.filter(a => a.status === 'Pending').length}
              </span>
              <span className="text-gray-600 ml-1">Pending</span>
            </div>
          </div>
        </div>
        <p className="text-gray-600">Review and approve uploaded buy/sell contract notes</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by note number, broker, or submitter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Note Details</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted By</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredApprovals.map((approval) => {
                const details = getNoteDetails(approval.buy_sell_note_id);
                if (!details) return null;

                return (
                  <tr key={approval.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-bold text-blue-600">{details.note.note_number}</div>
                        <div className="text-xs text-gray-500">{details.note.broker}</div>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold mt-1 ${
                          details.note.note_type === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {details.note.note_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {details.transaction ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">{details.share?.share_name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{details.entity?.name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">
                            {details.transaction.no_of_shares} shares @ Rs. {details.transaction.price_per_share.toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">N/A</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getPriorityColor(approval.priority)}`}>
                        {approval.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{approval.submitted_by}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(approval.submitted_date).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(approval.status)}`}>
                        {approval.status}
                      </span>
                      {approval.reviewed_by && (
                        <div className="text-xs text-gray-500 mt-1">
                          by {approval.reviewed_by}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {details.note.file_url ? (
                        <a
                          href={details.note.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="text-sm">View</span>
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">No file</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {approval.status === 'Pending' ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleOpenReviewModal(approval, 'Approved')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenReviewModal(approval, 'Rejected')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {approval.remarks && (
                            <div className="max-w-xs truncate" title={approval.remarks}>
                              {approval.remarks}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredApprovals.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No approvals found</p>
            </div>
          )}
        </div>
      </div>

      {showReviewModal && selectedApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <h2 className="text-xl font-bold text-gray-900">
                {reviewAction} Approval
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Note Number</div>
                <div className="font-semibold text-gray-900">
                  {getNoteDetails(selectedApproval.buy_sell_note_id)?.note.note_number}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Remarks {reviewAction === 'Rejected' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Add ${reviewAction === 'Rejected' ? 'rejection reason' : 'comments'}...`}
                  required={reviewAction === 'Rejected'}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseReviewModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReview}
                  disabled={reviewAction === 'Rejected' && !reviewRemarks.trim()}
                  className={`px-4 py-2 text-white rounded-lg transition-colors ${
                    reviewAction === 'Approved'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                  }`}
                >
                  Confirm {reviewAction}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
