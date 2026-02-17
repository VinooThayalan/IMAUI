import { Plus, Search, Filter, Calendar, TrendingUp, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useState } from 'react';

const dailyPrices = [
  {
    id: 1,
    dateEntered: '2024-01-15 09:30 AM',
    effectiveDate: '2024-01-15',
    shareId: 'JKH',
    sharePrice: 'Rs. 175.00',
    enteredBy: 'Ravi Fernando',
    approvedBy: 'Priya Silva',
    status: 'Approved'
  },
  {
    id: 2,
    dateEntered: '2024-01-15 10:15 AM',
    effectiveDate: '2024-01-15',
    shareId: 'NDB',
    sharePrice: 'Rs. 134.00',
    enteredBy: 'Nuwan Perera',
    approvedBy: null,
    status: 'Pending'
  },
  {
    id: 3,
    dateEntered: '2024-01-15 11:00 AM',
    effectiveDate: '2024-01-15',
    shareId: 'Sampath',
    sharePrice: 'Rs. 375.00',
    enteredBy: 'Tharindu Jayasinghe',
    approvedBy: 'Chathura Wijesinghe',
    status: 'Approved'
  },
  {
    id: 4,
    dateEntered: '2024-01-14 02:30 PM',
    effectiveDate: '2024-01-14',
    shareId: 'Dialog',
    sharePrice: 'Rs. 250.00',
    enteredBy: 'Dilshan Rajapaksa',
    approvedBy: 'Priya Silva',
    status: 'Approved'
  },
  {
    id: 5,
    dateEntered: '2024-01-14 03:45 PM',
    effectiveDate: '2024-01-14',
    shareId: 'ADL',
    sharePrice: 'Rs. 148.50',
    enteredBy: 'Ravi Fernando',
    approvedBy: null,
    status: 'Rejected'
  },
];

const statusConfig = {
  Approved: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  Pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  Rejected: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
};

export function DailyPrices() {
  const [showModal, setShowModal] = useState(false);

  const pendingCount = dailyPrices.filter(p => p.status === 'Pending').length;
  const approvedToday = dailyPrices.filter(p =>
    p.status === 'Approved' && p.effectiveDate === '2024-01-15'
  ).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daily Share Prices</h1>
          <p className="text-gray-500 mt-1">Enter and manage daily share price data</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Price Entry</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Today's Entries</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{approvedToday}</p>
              <p className="text-sm text-gray-500 mt-2">Approved prices</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Approval</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{pendingCount}</p>
              <p className="text-sm text-gray-500 mt-2">Awaiting review</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Shares</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">5</p>
              <p className="text-sm text-gray-500 mt-2">Tracked symbols</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
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
                placeholder="Search by ticker, entered by, or date..."
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Entered</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Effective Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticker</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share Price</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entered By</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Approved By</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dailyPrices.map((price) => {
                const StatusIcon = statusConfig[price.status as keyof typeof statusConfig].icon;
                return (
                  <tr key={price.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{price.dateEntered}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{price.effectiveDate}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-blue-600">{price.shareId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{price.sharePrice}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{price.enteredBy}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{price.approvedBy || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusConfig[price.status as keyof typeof statusConfig].bg} ${statusConfig[price.status as keyof typeof statusConfig].color}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {price.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Daily Price Entry</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Effective Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ticker</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., JKH"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Share Price (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Entered By</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Approved By (Optional)</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Approver name"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add any additional notes..."
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
