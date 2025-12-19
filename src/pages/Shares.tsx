import { Plus, Search, Filter, TrendingUp, TrendingDown, Edit, Eye, MoreVertical } from 'lucide-react';
import { useState } from 'react';

const shares = [
  {
    id: 1,
    symbol: 'JKH',
    name: 'John Keells Holdings',
    currentPrice: 'Rs. 175.00',
    change: '+2.4%',
    isPositive: true,
    totalShares: 2850,
    totalValue: 'Rs. 498,750',
    avgCost: 'Rs. 165.50',
    gainLoss: '+Rs. 27,075',
    sector: 'Conglomerate'
  },
  {
    id: 2,
    symbol: 'NDB',
    name: 'National Development Bank',
    currentPrice: 'Rs. 134.00',
    change: '+1.8%',
    isPositive: true,
    totalShares: 1950,
    totalValue: 'Rs. 261,300',
    avgCost: 'Rs. 128.75',
    gainLoss: '+Rs. 10,237',
    sector: 'Banking'
  },
  {
    id: 3,
    symbol: 'Sampath',
    name: 'Sampath Bank',
    currentPrice: 'Rs. 375.00',
    change: '+3.2%',
    isPositive: true,
    totalShares: 1230,
    totalValue: 'Rs. 461,250',
    avgCost: 'Rs. 352.00',
    gainLoss: '+Rs. 28,290',
    sector: 'Banking'
  },
  {
    id: 4,
    symbol: 'Dialog',
    name: 'Dialog Axiata',
    currentPrice: 'Rs. 250.00',
    change: '-0.5%',
    isPositive: false,
    totalShares: 780,
    totalValue: 'Rs. 195,000',
    avgCost: 'Rs. 265.50',
    gainLoss: '-Rs. 12,090',
    sector: 'Telecommunications'
  },
  {
    id: 5,
    symbol: 'ADL',
    name: 'Aitken Spence',
    currentPrice: 'Rs. 148.50',
    change: '+1.2%',
    isPositive: true,
    totalShares: 1650,
    totalValue: 'Rs. 245,025',
    avgCost: 'Rs. 142.00',
    gainLoss: '+Rs. 10,725',
    sector: 'Diversified'
  },
  {
    id: 6,
    symbol: 'COMB',
    name: 'Commercial Bank',
    currentPrice: 'Rs. 182.00',
    change: '+1.5%',
    isPositive: true,
    totalShares: 1420,
    totalValue: 'Rs. 258,440',
    avgCost: 'Rs. 175.50',
    gainLoss: '+Rs. 9,230',
    sector: 'Banking'
  },
];

export function Shares() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shares</h1>
          <p className="text-gray-500 mt-1">Track and manage share holdings across all entities</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Share</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">Rs. 1,661,325</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-600 ml-1">+Rs. 64,237</span>
                <span className="text-sm text-gray-500 ml-1">Total Gain</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Shares Held</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">8,460</p>
              <p className="text-sm text-gray-500 mt-2">Across 5 different securities</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Average Return</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">+4.03%</p>
              <p className="text-sm text-gray-500 mt-2">Weighted average across portfolio</p>
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
                placeholder="Search shares by symbol or name..."
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Price</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Shares</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Value</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Cost</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Gain/Loss</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shares.map((share) => (
                <tr key={share.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-bold text-gray-900">{share.symbol}</div>
                      <div className="text-xs text-gray-500">{share.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{share.currentPrice}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {share.isPositive ? (
                        <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${share.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {share.change}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{share.totalShares.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{share.totalValue}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{share.avgCost}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-semibold ${share.gainLoss.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {share.gainLoss}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="View">
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="Edit">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="More">
                        <MoreVertical className="w-4 h-4 text-gray-600" />
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add New Share</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Symbol</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., NDB"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Apple Inc."
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sector</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Technology</option>
                    <option>Healthcare</option>
                    <option>Financial</option>
                    <option>Consumer</option>
                    <option>Industrial</option>
                  </select>
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
                Add Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
