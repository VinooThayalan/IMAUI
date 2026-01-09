import { Plus, Search, Filter, Wallet, TrendingUp, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const dividends = [
  {
    id: 1,
    entity: 'Fernando Family Trust',
    share: 'JKH',
    quantity: 2850,
    dividendPerShare: 'Rs. 0.24',
    totalAmount: 'Rs. 684.00',
    paymentDate: '2024-02-15',
    exDate: '2024-02-01',
    status: 'Paid',
    bankAccount: 'Commercial Bank ****1234'
  },
  {
    id: 2,
    entity: 'Perera Holdings',
    share: 'NDB',
    quantity: 1950,
    dividendPerShare: 'Rs. 0.20',
    totalAmount: 'Rs. 390.00',
    paymentDate: '2024-02-20',
    exDate: '2024-02-05',
    status: 'Scheduled',
    bankAccount: 'Sampath Bank ****5678'
  },
  {
    id: 3,
    entity: 'Silva Investment Group',
    share: 'Sampath',
    quantity: 1230,
    dividendPerShare: 'Rs. 0.68',
    totalAmount: 'Rs. 836.40',
    paymentDate: '2024-02-12',
    exDate: '2024-01-28',
    status: 'Paid',
    bankAccount: 'HNB Bank ****9012'
  },
  {
    id: 4,
    entity: 'Jayasinghe Capital',
    share: 'Dialog',
    quantity: 1650,
    dividendPerShare: 'Rs. 0.00',
    totalAmount: 'Rs. 0.00',
    paymentDate: null,
    exDate: null,
    status: 'N/A',
    bankAccount: null
  },
];

export function Dividends() {
  const [showModal, setShowModal] = useState(false);
  const [shares, setShares] = useState<{ id: string; ticker: string; name: string }[]>([]);

  useEffect(() => {
    fetchShares();
  }, []);

  async function fetchShares() {
    try {
      const { data, error } = await supabase
        .from('shares')
        .select('id, ticker, name')
        .order('ticker');

      if (error) throw error;
      setShares(data || []);
    } catch (error) {
      console.error('Error fetching shares:', error);
    }
  }

  const totalDividends = dividends
    .filter(d => d.status === 'Paid')
    .reduce((sum, d) => sum + parseFloat(d.totalAmount.replace(/[Rs.,\s]/g, '')), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dividends</h1>
          <p className="text-gray-500 mt-1">Track dividend payments</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Dividend</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Dividends (YTD)</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">Rs. {totalDividends.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-600 ml-1">+12.5%</span>
                <span className="text-sm text-gray-500 ml-1">vs last year</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Scheduled Payments</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">2</p>
              <p className="text-sm text-gray-500 mt-2">Next payment on Feb 20</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
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
                placeholder="Search dividends..."
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticker</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross/Share</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Net/Share</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">W. Tax</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Net</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dividends.map((dividend) => (
                  <tr key={dividend.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{dividend.entity}</div>
                        {dividend.bankAccount && (
                          <div className="text-xs text-gray-500">{dividend.bankAccount}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">{dividend.share}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dividend.quantity.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dividend.dividendPerShare}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. 0.00</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. 0.00</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{dividend.totalAmount}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        {dividend.paymentDate && (
                          <div className="text-xs text-gray-500">Pay: {dividend.paymentDate}</div>
                        )}
                        {dividend.exDate && (
                          <div className="text-xs text-gray-500">Ex: {dividend.exDate}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        dividend.status === 'Paid' ? 'bg-green-100 text-green-800' :
                        dividend.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {dividend.status}
                      </span>
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
              <h2 className="text-2xl font-bold text-gray-900">Add Dividend</h2>
            </div>
            <div className="p-6 space-y-6">
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ticker</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select a ticker</option>
                    {shares.map((share) => (
                      <option key={share.id} value={share.id}>
                        {share.ticker} - {share.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity</label>
                  <input
                    type="number"
                    step="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Gross Dividend per Share</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Net Dividend per Share</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Withholding Tax</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Announcement Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ex-Dividend Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Account</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Chase Bank - ****1234</option>
                    <option>Bank of America - ****5678</option>
                    <option>Wells Fargo - ****9012</option>
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
                Add Dividend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
