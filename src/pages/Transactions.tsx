import { Plus, Search, Filter, ArrowUpRight, ArrowDownRight, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

const transactions = [
  {
    id: 1,
    entity: 'Fernando Family Trust',
    type: 'Buy',
    share: 'JKH',
    quantity: 500,
    price: 'Rs. 175.00',
    totalValue: 'Rs. 87,500.00',
    date: '2024-01-15',
    status: 'Completed',
    approver: 'Ravi Fernando',
    tradeDate: '2024-01-15',
    settlementDate: '2024-01-17'
  },
  {
    id: 2,
    entity: 'Perera Holdings',
    type: 'Sell',
    share: 'NDB',
    quantity: 200,
    price: 'Rs. 134.00',
    totalValue: 'Rs. 26,800.00',
    date: '2024-01-14',
    status: 'Pending',
    approver: 'Priya Silva',
    tradeDate: '2024-01-14',
    settlementDate: '2024-01-16'
  },
  {
    id: 3,
    entity: 'Silva Investment Group',
    type: 'Buy',
    share: 'Sampath',
    quantity: 350,
    price: 'Rs. 375.00',
    totalValue: 'Rs. 131,250.00',
    date: '2024-01-14',
    status: 'Completed',
    approver: 'Nuwan Perera',
    tradeDate: '2024-01-14',
    settlementDate: '2024-01-16'
  },
  {
    id: 4,
    entity: 'Jayasinghe Capital',
    type: 'Buy',
    share: 'Dialog',
    quantity: 150,
    price: 'Rs. 250.00',
    totalValue: 'Rs. 37,500.00',
    date: '2024-01-13',
    status: 'Approved',
    approver: 'Tharindu Jayasinghe',
    tradeDate: '2024-01-13',
    settlementDate: '2024-01-15'
  },
  {
    id: 5,
    entity: 'Wijesinghe Retirement Fund',
    type: 'Sell',
    share: 'ADL',
    quantity: 100,
    price: 'Rs. 148.50',
    totalValue: 'Rs. 14,850.00',
    date: '2024-01-12',
    status: 'Rejected',
    approver: 'Chathura Wijesinghe',
    tradeDate: '2024-01-12',
    settlementDate: null
  },
];

const statusConfig = {
  Completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  Pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  Approved: { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-100' },
  Rejected: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' }
};

export function Transactions() {
  const [showModal, setShowModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'Buy' | 'Sell'>('Buy');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500 mt-1">Manage buy and sell orders with approval workflow</p>
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
              <p className="text-sm font-medium text-gray-500">Pending Approval</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">3</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Completed Today</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">8</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Volume</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">Rs. 1.2M</p>
            </div>
            <ArrowUpRight className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">This Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">142</p>
            </div>
            <ArrowDownRight className="w-8 h-8 text-gray-600" />
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Value</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Approver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((transaction) => {
                const StatusIcon = statusConfig[transaction.status as keyof typeof statusConfig].icon;
                return (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{transaction.entity}</div>
                        <div className="text-xs text-gray-500">{transaction.date}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        transaction.type === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{transaction.share}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.quantity.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.price}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{transaction.totalValue}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <StatusIcon className={`w-4 h-4 ${statusConfig[transaction.status as keyof typeof statusConfig].color}`} />
                        <span className={`text-xs font-semibold ${statusConfig[transaction.status as keyof typeof statusConfig].color}`}>
                          {transaction.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.approver}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">New Transaction</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex space-x-4 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setTransactionType('Buy')}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    transactionType === 'Buy' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Buy Order
                </button>
                <button
                  onClick={() => setTransactionType('Sell')}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    transactionType === 'Sell' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sell Order
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Entity</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Johnson Family Trust</option>
                    <option>Smith Holdings LLC</option>
                    <option>Brown Investment Group</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Share Symbol</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., JKH"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">No of shares</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Price per Share</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                {transactionType === 'Buy' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Purchase Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                )}
                {transactionType === 'Sell' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Sale value</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Trade Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Approval Status</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Pending</option>
                    <option>Approved</option>
                    <option>Rejected</option>
                    <option>Completed</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Additional notes or instructions..."
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
                Create Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
