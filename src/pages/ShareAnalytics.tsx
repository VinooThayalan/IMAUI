import { Plus, Search, TrendingUp, TrendingDown, DollarSign, BookOpen, Calendar } from 'lucide-react';
import { useState } from 'react';

type AnalyticsTab = '52week' | 'earnings' | 'values' | 'dividends';

const mockShares = [
  { id: '1', name: 'National Development Bank', symbol: 'NDB' },
  { id: '2', name: 'John Keells Holdings', symbol: 'JKH' },
  { id: '3', name: 'Aitken Spence', symbol: 'ADL' },
  { id: '4', name: 'Sampath Bank', symbol: 'Sampath' },
  { id: '5', name: 'Commercial Bank', symbol: 'COMB' },
];

const mockEntities = [
  { id: '1', name: 'NDB Wealth Management' },
  { id: '2', name: 'JKH Investment Fund' },
  { id: '3', name: 'Sampath Securities' },
  { id: '4', name: 'LOLC Finance' },
];

const mock52WeekData = [
  {
    id: 1,
    shareId: 'NDB',
    highValue: 'Rs. 195.50',
    lowValue: 'Rs. 124.17',
    effectiveDate: '2024-01-15',
    timestamp: '2024-01-15 10:30 AM',
    createdBy: 'Ravi Fernando'
  },
  {
    id: 2,
    shareId: 'JKH',
    highValue: 'Rs. 151.55',
    lowValue: 'Rs. 102.21',
    effectiveDate: '2024-01-14',
    timestamp: '2024-01-14 02:15 PM',
    createdBy: 'Priya Silva'
  },
  {
    id: 3,
    shareId: 'Sampath',
    highValue: 'Rs. 142.80',
    lowValue: 'Rs. 98.50',
    effectiveDate: '2024-01-13',
    timestamp: '2024-01-13 11:20 AM',
    createdBy: 'Nuwan Perera'
  },
];

const mockEarningsData = [
  {
    id: 1,
    entityId: 'NDB Wealth Management',
    shareId: 'NDB',
    effectiveDate: '2024-01-15',
    earningsPerShare: 'Rs. 6.42',
    priceEarningRatio: '28.5',
    timestamp: '2024-01-15 10:30 AM',
    createdBy: 'Ravi Fernando'
  },
  {
    id: 2,
    entityId: 'JKH Investment Fund',
    shareId: 'ADL',
    effectiveDate: '2024-01-14',
    earningsPerShare: 'Rs. 11.35',
    priceEarningRatio: '32.8',
    timestamp: '2024-01-14 03:45 PM',
    createdBy: 'Priya Silva'
  },
  {
    id: 3,
    entityId: 'Sampath Securities',
    shareId: 'Sampath',
    effectiveDate: '2024-01-12',
    earningsPerShare: 'Rs. 8.75',
    priceEarningRatio: '24.3',
    timestamp: '2024-01-12 09:15 AM',
    createdBy: 'Nuwan Perera'
  },
];

const mockValuesData = [
  {
    id: 1,
    entityId: 'NDB Wealth Management',
    shareId: 'NDB',
    effectiveDate: '2024-01-15',
    netbookValuePerShare: 'Rs. 4.25',
    priceToBookRatio: '42.8',
    timestamp: '2024-01-15 10:30 AM',
    createdBy: 'Ravi Fernando'
  },
  {
    id: 2,
    entityId: 'LOLC Finance',
    shareId: 'JKH',
    effectiveDate: '2024-01-13',
    netbookValuePerShare: 'Rs. 26.85',
    priceToBookRatio: '5.1',
    timestamp: '2024-01-13 11:20 AM',
    createdBy: 'Tharindu Jayasinghe'
  },
  {
    id: 3,
    entityId: 'Sampath Securities',
    shareId: 'COMB',
    effectiveDate: '2024-01-11',
    netbookValuePerShare: 'Rs. 18.40',
    priceToBookRatio: '3.8',
    timestamp: '2024-01-11 02:30 PM',
    createdBy: 'Nuwan Perera'
  },
];

const mockDividendsData = [
  {
    id: 1,
    entityId: 'NDB Wealth Management',
    shareId: 'NDB',
    effectiveDate: '2024-01-15',
    dividendPerShareGross: 'Rs. 0.96',
    dividendPerShareNet: 'Rs. 0.82',
    dividendYield: '0.52%',
    timestamp: '2024-01-15 10:30 AM',
    createdBy: 'Ravi Fernando'
  },
  {
    id: 2,
    entityId: 'JKH Investment Fund',
    shareId: 'ADL',
    effectiveDate: '2024-01-12',
    dividendPerShareGross: 'Rs. 2.72',
    dividendPerShareNet: 'Rs. 2.31',
    dividendYield: '0.74%',
    timestamp: '2024-01-12 09:15 AM',
    createdBy: 'Priya Silva'
  },
  {
    id: 3,
    entityId: 'Sampath Securities',
    shareId: 'Sampath',
    effectiveDate: '2024-01-10',
    dividendPerShareGross: 'Rs. 1.85',
    dividendPerShareNet: 'Rs. 1.57',
    dividendYield: '0.68%',
    timestamp: '2024-01-10 03:30 PM',
    createdBy: 'Nuwan Perera'
  },
];

export function ShareAnalytics() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('52week');
  const [showModal, setShowModal] = useState(false);

  const renderTabContent = () => {
    switch (activeTab) {
      case '52week':
        return (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">52-Week Share Values History</h2>
                  <p className="text-sm text-gray-500 mt-1">Track high and low values over 52-week periods</p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">Add Record</span>
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by share..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Share ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">High Value</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Low Value</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Effective Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mock52WeekData.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">{record.shareId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="font-semibold text-green-600">{record.highValue}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <TrendingDown className="w-4 h-4 text-red-600" />
                          <span className="font-semibold text-red-600">{record.lowValue}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">{record.effectiveDate}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{record.timestamp}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{record.createdBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'earnings':
        return (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Earnings History</h2>
                  <p className="text-sm text-gray-500 mt-1">Track earnings per share and P/E ratios</p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">Add Record</span>
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by entity or share..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Share</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">EPS</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">P/E Ratio</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Effective Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mockEarningsData.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">{record.entityId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">{record.shareId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-blue-600">{record.earningsPerShare}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-purple-600">{record.priceEarningRatio}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">{record.effectiveDate}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{record.timestamp}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{record.createdBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'values':
        return (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Share Values History</h2>
                  <p className="text-sm text-gray-500 mt-1">Track net book value per share and P/B ratios</p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">Add Record</span>
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by entity or share..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Share</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Net Book Value/Share</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">P/B Ratio</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Effective Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mockValuesData.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">{record.entityId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">{record.shareId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-teal-600">{record.netbookValuePerShare}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-orange-600">{record.priceToBookRatio}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">{record.effectiveDate}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{record.timestamp}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{record.createdBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'dividends':
        return (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Dividend Per Share History</h2>
                  <p className="text-sm text-gray-500 mt-1">Track dividend per share and dividend yields</p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">Add Record</span>
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by entity or share..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Share</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">DPS (Gross)</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">DPS (Net)</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Dividend Yield</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Effective Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mockDividendsData.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">{record.entityId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">{record.shareId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-green-600">{record.dividendPerShareGross}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-emerald-600">{record.dividendPerShareNet}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {record.dividendYield}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">{record.effectiveDate}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{record.timestamp}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{record.createdBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
    }
  };

  const renderModal = () => {
    switch (activeTab) {
      case '52week':
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Add 52-Week Values</h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Share</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select a share...</option>
                      {mockShares.map(share => (
                        <option key={share.id} value={share.id}>{share.symbol} - {share.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">High Value (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Low Value (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Effective Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue={new Date().toISOString().split('T')[0]}
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
                  Add Record
                </button>
              </div>
            </div>
          </div>
        );

      case 'earnings':
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Add Earnings Data</h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entity</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select an entity...</option>
                      {mockEntities.map(entity => (
                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Share</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select a share...</option>
                      {mockShares.map(share => (
                        <option key={share.id} value={share.id}>{share.symbol} - {share.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Earnings Per Share (LKR)</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Price Earning Ratio</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Effective Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue={new Date().toISOString().split('T')[0]}
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
                  Add Record
                </button>
              </div>
            </div>
          </div>
        );

      case 'values':
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Add Share Values Data</h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entity</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select an entity...</option>
                      {mockEntities.map(entity => (
                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Share</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select a share...</option>
                      {mockShares.map(share => (
                        <option key={share.id} value={share.id}>{share.symbol} - {share.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Net Book Value Per Share (LKR)</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Price to Book Ratio</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Effective Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue={new Date().toISOString().split('T')[0]}
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
                  Add Record
                </button>
              </div>
            </div>
          </div>
        );

      case 'dividends':
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Add Dividend Per Share Data</h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entity</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select an entity...</option>
                      {mockEntities.map(entity => (
                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Share</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select a share...</option>
                      {mockShares.map(share => (
                        <option key={share.id} value={share.id}>{share.symbol} - {share.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Dividend Per Share - Gross (LKR)</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Dividend Per Share - Net (LKR)</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Dividend Yield (%)</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Effective Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="col-span-2">
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
                  Add Record
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Share Analytics</h1>
        <p className="text-gray-500 mt-1">Track share-specific values with complete historical records</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('52week')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === '52week'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>52-Week Values</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('earnings')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'earnings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5" />
                <span>Earnings</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('values')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'values'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5" />
                <span>Values</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('dividends')}
              className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'dividends'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5" />
                <span>Dividend Per Share</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {renderTabContent()}

      {showModal && renderModal()}
    </div>
  );
}
