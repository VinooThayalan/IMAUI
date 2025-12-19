import { Plus, Search, Filter, Wallet, TrendingUp, TrendingDown, AlertCircle, Settings, Building2 } from 'lucide-react';
import { useState } from 'react';

const entities = [
  { id: 'E001', name: 'Fernando Family Trust', type: 'Trust', currentBalance: 5025000.00, odLimit: 500000.00 },
  { id: 'E002', name: 'Perera Holdings', type: 'Company', currentBalance: 2345600.00, odLimit: 1000000.00 },
  { id: 'E003', name: 'Silva Investment Group', type: 'Company', currentBalance: 4893750.00, odLimit: 750000.00 },
  { id: 'E004', name: 'Jayasinghe Capital', type: 'Company', currentBalance: 4925600.00, odLimit: 600000.00 },
  { id: 'E005', name: 'Wijesinghe Retirement Fund', type: 'Fund', currentBalance: 4908600.00, odLimit: 400000.00 },
  { id: 'E006', name: 'De Silva Ventures', type: 'Company', currentBalance: 3200000.00, odLimit: 850000.00 },
  { id: 'E007', name: 'Rajapaksa Enterprises', type: 'Company', currentBalance: 1850000.00, odLimit: 950000.00 },
  { id: 'E008', name: 'Gunasekara Holdings', type: 'Company', currentBalance: 4500000.00, odLimit: 300000.00 }
];

const transactions = [
  {
    id: 1,
    entityId: 'E001',
    entityName: 'Fernando Family Trust',
    type: 'Addition',
    description: 'Dividend received from JKH',
    amount: 'Rs. 25,000.00',
    timestamp: '2024-01-20 10:00 AM',
    runningBalance: 'Rs. 5,025,000.00',
    createdBy: 'System'
  },
  {
    id: 2,
    entityId: 'E003',
    entityName: 'Silva Investment Group',
    type: 'Deduction',
    description: 'Share purchase - Sampath',
    amount: 'Rs. 131,250.00',
    timestamp: '2024-01-19 02:30 PM',
    runningBalance: 'Rs. 4,893,750.00',
    createdBy: 'Trader'
  },
  {
    id: 3,
    entityId: 'E005',
    entityName: 'Wijesinghe Retirement Fund',
    type: 'Addition',
    description: 'Sale of ADL shares',
    amount: 'Rs. 14,850.00',
    timestamp: '2024-01-18 11:15 AM',
    runningBalance: 'Rs. 4,908,600.00',
    createdBy: 'Trader'
  },
  {
    id: 4,
    entityId: 'E004',
    entityName: 'Jayasinghe Capital',
    type: 'Addition',
    description: 'Dividend received from Dialog',
    amount: 'Rs. 18,500.00',
    timestamp: '2024-01-16 10:30 AM',
    runningBalance: 'Rs. 4,925,600.00',
    createdBy: 'System'
  },
  {
    id: 5,
    entityId: 'E002',
    entityName: 'Perera Holdings',
    type: 'Deduction',
    description: 'Share purchase - HNB',
    amount: 'Rs. 75,400.00',
    timestamp: '2024-01-15 03:45 PM',
    runningBalance: 'Rs. 2,345,600.00',
    createdBy: 'System'
  },
];

export function CashBalance() {
  const [showModal, setShowModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [transactionType, setTransactionType] = useState<'Addition' | 'Deduction'>('Addition');

  const totalBalance = entities.reduce((sum, entity) => sum + entity.currentBalance, 0);
  const totalODLimit = entities.reduce((sum, entity) => sum + entity.odLimit, 0);

  const filteredTransactions = selectedEntity === 'all'
    ? transactions
    : transactions.filter(t => t.entityId === selectedEntity);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cash Balance by Entity</h1>
          <p className="text-gray-500 mt-1">Track and manage cash balance for each entity</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Transaction</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Cash Balance</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                Rs. {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-500 mt-2">Across all entities</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Entities</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{entities.length}</p>
              <p className="text-sm text-gray-500 mt-2">Active entities</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Entity Cash Balances</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Balance</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">OD Limit</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Available Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entities.map((entity) => {
                const availableCredit = entity.currentBalance + entity.odLimit;
                return (
                  <tr key={entity.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-blue-600">{entity.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">{entity.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                        {entity.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        Rs. {entity.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        Rs. {entity.odLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600">
                        Rs. {availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Transaction Ledger</h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Entities</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.id} - {entity.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Running Balance</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{transaction.timestamp}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-blue-600">{transaction.entityId}</div>
                    <div className="text-xs text-gray-500">{transaction.entityName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      transaction.type === 'Addition' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.type === 'Addition' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{transaction.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-semibold ${transaction.type === 'Addition' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.type === 'Addition' ? '+' : '-'}{transaction.amount}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{transaction.runningBalance}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{transaction.createdBy}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Cash Transaction</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Entity</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select entity</option>
                    {entities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.id} - {entity.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Type</label>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setTransactionType('Addition')}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                        transactionType === 'Addition'
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <TrendingUp className="w-5 h-5 mx-auto mb-1" />
                      Addition
                    </button>
                    <button
                      onClick={() => setTransactionType('Deduction')}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                        transactionType === 'Deduction'
                          ? 'border-red-600 bg-red-50 text-red-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <TrendingDown className="w-5 h-5 mx-auto mb-1" />
                      Deduction
                    </button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Manual deposit, Shares bought/sold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Date/Time</label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={new Date().toISOString().slice(0, 16)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Created By</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your name"
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
                Add Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
