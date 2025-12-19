import { CheckCircle, XCircle, Clock, Upload, FileText, Eye } from 'lucide-react';
import { useState } from 'react';

const transactionRequests = [
  {
    id: 1,
    entity: 'Fernando Family Trust',
    share: 'JKH',
    transactionType: 'BUY',
    noOfShares: 500,
    pricePerShare: 175.00,
    totalAmount: 87500.00,
    requestDate: '2024-01-15',
    requestedBy: 'Ravi Fernando',
    status: 'PENDING',
    notes: 'Urgent buy order for portfolio diversification'
  },
  {
    id: 2,
    entity: 'Perera Holdings',
    share: 'NDB',
    transactionType: 'SELL',
    noOfShares: 200,
    pricePerShare: 134.00,
    totalAmount: 26800.00,
    requestDate: '2024-01-14',
    requestedBy: 'Priya Silva',
    status: 'PENDING',
    notes: 'Taking profit from recent gains'
  },
  {
    id: 3,
    entity: 'Silva Investment Group',
    share: 'Sampath',
    transactionType: 'BUY',
    noOfShares: 350,
    pricePerShare: 375.00,
    totalAmount: 131250.00,
    requestDate: '2024-01-14',
    requestedBy: 'Nuwan Perera',
    status: 'APPROVED',
    notes: 'Long-term investment opportunity',
    approvedBy: 'Manager',
    approvalDate: '2024-01-14'
  },
  {
    id: 4,
    entity: 'Jayasinghe Capital',
    share: 'Dialog',
    transactionType: 'DIVIDEND',
    noOfShares: 150,
    pricePerShare: 0,
    totalAmount: 2250.00,
    requestDate: '2024-01-13',
    requestedBy: 'Tharindu Jayasinghe',
    status: 'APPROVED',
    notes: 'Quarterly dividend payment',
    approvedBy: 'Accountant',
    approvalDate: '2024-01-13'
  },
  {
    id: 5,
    entity: 'Wijesinghe Retirement Fund',
    share: 'ADL',
    transactionType: 'SELL',
    noOfShares: 100,
    pricePerShare: 148.50,
    totalAmount: 14850.00,
    requestDate: '2024-01-12',
    requestedBy: 'Chathura Wijesinghe',
    status: 'REJECTED',
    notes: 'Market timing not optimal',
    approvedBy: 'Analyst',
    approvalDate: '2024-01-12'
  },
];

const statusConfig = {
  PENDING: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  APPROVED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  REJECTED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' }
};

const typeColors = {
  BUY: 'bg-green-100 text-green-800',
  SELL: 'bg-red-100 text-red-800',
  DIVIDEND: 'bg-blue-100 text-blue-800',
  SCRIP: 'bg-purple-100 text-purple-800',
  COST: 'bg-orange-100 text-orange-800'
};

export function TransactionApprovals() {
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [approvalAction, setApprovalAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');

  const handleApprove = (request: any) => {
    setSelectedRequest(request);
    setApprovalAction('APPROVE');
    setShowApprovalModal(true);
  };

  const handleReject = (request: any) => {
    setSelectedRequest(request);
    setApprovalAction('REJECT');
    setShowApprovalModal(true);
  };

  const handleUploadDocument = (request: any) => {
    setSelectedRequest(request);
    setShowUploadModal(true);
  };

  const pendingCount = transactionRequests.filter(r => r.status === 'PENDING').length;
  const approvedCount = transactionRequests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = transactionRequests.filter(r => r.status === 'REJECTED').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transaction Approvals</h1>
          <p className="text-gray-500 mt-1">Review and approve transaction requests</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Approval</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{pendingCount}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
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
              {transactionRequests.map((request) => {
                const StatusIcon = statusConfig[request.status as keyof typeof statusConfig].icon;
                return (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{request.entity}</div>
                        <div className="text-xs text-gray-500">{request.requestDate}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${typeColors[request.transactionType as keyof typeof typeColors]}`}>
                        {request.transactionType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{request.share}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.noOfShares.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      Rs. {request.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <StatusIcon className={`w-4 h-4 ${statusConfig[request.status as keyof typeof statusConfig].color}`} />
                        <span className={`text-xs font-semibold ${statusConfig[request.status as keyof typeof statusConfig].color}`}>
                          {request.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.requestedBy}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {request.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(request)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleReject(request)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        {request.status === 'APPROVED' && (
                          <button
                            onClick={() => handleUploadDocument(request)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Upload Confirmation Document"
                          >
                            <Upload className="w-5 h-5" />
                          </button>
                        )}
                        <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" title="View Details">
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {approvalAction === 'APPROVE' ? 'Approve Transaction' : 'Reject Transaction'}
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Entity:</span>
                  <span className="text-sm font-bold text-gray-900">{selectedRequest.entity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Share:</span>
                  <span className="text-sm font-bold text-gray-900">{selectedRequest.share}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Type:</span>
                  <span className={`text-sm font-bold px-2 py-1 rounded ${typeColors[selectedRequest.transactionType as keyof typeof typeColors]}`}>
                    {selectedRequest.transactionType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Quantity:</span>
                  <span className="text-sm font-bold text-gray-900">{selectedRequest.noOfShares.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Amount:</span>
                  <span className="text-sm font-bold text-gray-900">
                    Rs. {selectedRequest.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Requested By:</span>
                  <span className="text-sm font-bold text-gray-900">{selectedRequest.requestedBy}</span>
                </div>
              </div>

              {approvalAction === 'APPROVE' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Upload Supporting Document (Optional)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, DOC, or DOCX (MAX. 10MB)</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {approvalAction === 'APPROVE' ? 'Approval Notes' : 'Rejection Reason'}
                </label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={approvalAction === 'APPROVE' ? 'Add any approval notes...' : 'Provide reason for rejection...'}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
                  approvalAction === 'APPROVE'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {approvalAction === 'APPROVE' ? 'Approve Transaction' : 'Reject Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Upload Confirmation Document</h2>
              <p className="text-sm text-gray-500 mt-1">Upload the PDF of completed transaction</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Transaction:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {selectedRequest.transactionType} - {selectedRequest.share}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Entity:</span>
                  <span className="text-sm font-bold text-gray-900">{selectedRequest.entity}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Upload Transaction Confirmation PDF
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-400 mt-1">PDF files only (MAX. 10MB)</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any additional notes..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Upload Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
