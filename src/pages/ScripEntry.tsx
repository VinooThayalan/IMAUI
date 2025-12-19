import { Plus, Search, Filter, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';

const scripEntries = [
  {
    id: 1,
    entity: 'Fernando Family Trust',
    share: 'JKH',
    entryDate: '2024-01-15',
    status: 'ACTIVE',
    noOfShares: 500,
    transactionType: 'BUY',
    notes: 'Initial purchase'
  },
  {
    id: 2,
    entity: 'Perera Holdings',
    share: 'NDB',
    entryDate: '2024-01-14',
    status: 'ACTIVE',
    noOfShares: 200,
    transactionType: 'SELL',
    notes: 'Profit taking'
  },
  {
    id: 3,
    entity: 'Silva Investment Group',
    share: 'Sampath',
    entryDate: '2024-01-14',
    status: 'COMPLETED',
    noOfShares: 350,
    transactionType: 'BUY',
    notes: 'Long-term investment'
  },
  {
    id: 4,
    entity: 'Jayasinghe Capital',
    share: 'Dialog',
    entryDate: '2024-01-13',
    status: 'ACTIVE',
    noOfShares: 150,
    transactionType: 'DIVIDEND',
    notes: 'Quarterly dividend received'
  },
  {
    id: 5,
    entity: 'Wijesinghe Retirement Fund',
    share: 'ADL',
    entryDate: '2024-01-12',
    status: 'ACTIVE',
    noOfShares: 75,
    transactionType: 'SCRIP',
    notes: 'Scrip dividend allocation'
  },
  {
    id: 6,
    entity: 'Fernando Family Trust',
    share: 'JKH',
    entryDate: '2024-01-11',
    status: 'COMPLETED',
    noOfShares: 0,
    transactionType: 'COST',
    notes: 'Transaction costs and fees'
  },
  {
    id: 7,
    entity: 'Silva Investment Group',
    share: 'HNB',
    entryDate: '2024-01-10',
    status: 'ACTIVE',
    noOfShares: 600,
    transactionType: 'BUY',
    notes: 'Banking sector investment'
  },
  {
    id: 8,
    entity: 'Perera Holdings',
    share: 'CTC',
    entryDate: '2024-01-09',
    status: 'ACTIVE',
    noOfShares: 250,
    transactionType: 'DIVIDEND',
    notes: 'Annual dividend payment'
  },
];

const typeColors = {
  BUY: 'bg-green-100 text-green-800',
  SELL: 'bg-red-100 text-red-800',
  DIVIDEND: 'bg-blue-100 text-blue-800',
  SCRIP: 'bg-purple-100 text-purple-800',
  COST: 'bg-orange-100 text-orange-800'
};

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-red-100 text-red-800'
};

export function ScripEntry() {
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingEntry(null);
    setShowModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scrip Entry</h1>
          <p className="text-gray-500 mt-1">Manage share transactions and entries</p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">New Entry</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{scripEntries.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {scripEntries.filter(e => e.status === 'ACTIVE').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {scripEntries.filter(e => e.status === 'COMPLETED').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✔️</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">This Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">24</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📈</span>
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
                placeholder="Search scrip entries..."
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">No. of Shares</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {scripEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{entry.entity}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{entry.share}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.entryDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${typeColors[entry.transactionType as keyof typeof typeColors]}`}>
                      {entry.transactionType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.noOfShares.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[entry.status as keyof typeof statusColors]}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{entry.notes}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingEntry ? 'Edit Scrip Entry' : 'New Scrip Entry'}
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Entity</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={editingEntry?.entity || ''}
                  >
                    <option value="">Select Entity</option>
                    <option>Fernando Family Trust</option>
                    <option>Perera Holdings</option>
                    <option>Silva Investment Group</option>
                    <option>Jayasinghe Capital</option>
                    <option>Wijesinghe Retirement Fund</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Share</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={editingEntry?.share || ''}
                  >
                    <option value="">Select Share</option>
                    <option>JKH</option>
                    <option>NDB</option>
                    <option>Sampath</option>
                    <option>Dialog</option>
                    <option>ADL</option>
                    <option>HNB</option>
                    <option>CTC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={editingEntry?.entryDate || ''}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Type</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={editingEntry?.transactionType || ''}
                  >
                    <option value="">Select Type</option>
                    <option>BUY</option>
                    <option>SELL</option>
                    <option>DIVIDEND</option>
                    <option>SCRIP</option>
                    <option>COST</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={editingEntry?.status || 'ACTIVE'}
                  >
                    <option>ACTIVE</option>
                    <option>COMPLETED</option>
                    <option>PENDING</option>
                    <option>CANCELLED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">No. of Shares</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    defaultValue={editingEntry?.noOfShares || ''}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Additional notes..."
                    defaultValue={editingEntry?.notes || ''}
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
                {editingEntry ? 'Update Entry' : 'Create Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
