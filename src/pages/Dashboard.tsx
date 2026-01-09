import { TrendingUp, TrendingDown, Wallet, Building2, Users, PieChart } from 'lucide-react';

const stats = [
  {
    label: 'Total Portfolio Value',
    value: 'Rs. 24,567,890',
    change: '+12.5%',
    isPositive: true,
    icon: Wallet,
  },
  {
    label: 'Total Entities',
    value: '47',
    change: '+3',
    isPositive: true,
    icon: Building2,
  },
  {
    label: 'Active Investments',
    value: '128',
    change: '+8',
    isPositive: true,
    icon: TrendingUp,
  },
  {
    label: 'Pending Approvals',
    value: '3',
    change: '-2',
    isPositive: true,
    icon: Users,
  },
];

const recentTransactions = [
  { id: 1, entity: 'Fernando Family Trust', type: 'Buy', share: 'NDB', quantity: 500, value: 'Rs. 87,500', date: '2024-01-15', status: 'Completed' },
  { id: 2, entity: 'Perera Holdings', type: 'Sell', share: 'JKH', quantity: 200, value: 'Rs. 268,000', date: '2024-01-14', status: 'Pending' },
  { id: 3, entity: 'Silva Investment Group', type: 'Buy', share: 'Sampath', quantity: 350, value: 'Rs. 131,250', date: '2024-01-14', status: 'Completed' },
  { id: 4, entity: 'Jayasinghe Capital', type: 'Buy', share: 'Dialog', quantity: 150, value: 'Rs. 37,500', date: '2024-01-13', status: 'Approved' },
];

const topHoldings = [
  { ticker: 'JKH', name: 'John Keells Holdings', value: 'Rs. 5,234,000', percentage: 21.3, change: '+2.4%' },
  { ticker: 'NDB', name: 'National Development Bank', value: 'Rs. 4,123,500', percentage: 16.8, change: '+1.8%' },
  { ticker: 'Sampath', name: 'Sampath Bank', value: 'Rs. 3,876,200', percentage: 15.8, change: '+3.2%' },
  { ticker: 'Dialog', name: 'Dialog Axiata', value: 'Rs. 2,456,800', percentage: 10.0, change: '-0.5%' },
  { ticker: 'COMB', name: 'Commercial Bank', value: 'Rs. 2,234,100', percentage: 9.1, change: '+1.2%' },
];

export function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, here's what's happening with your portfolio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <div className="flex items-center mt-2">
                  {stat.isPositive ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ml-1 ${stat.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last month</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <stat.icon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Recent Transactions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{transaction.entity}</div>
                      <div className="text-sm text-gray-500">{transaction.date}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        transaction.type === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{transaction.share}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{transaction.value}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        transaction.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                        transaction.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Top Holdings</h2>
          </div>
          <div className="p-6 space-y-4">
            {topHoldings.map((holding) => (
              <div key={holding.ticker} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{holding.ticker}</p>
                    <p className="text-xs text-gray-500">{holding.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{holding.value}</p>
                    <p className={`text-xs font-medium ${holding.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {holding.change}
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${holding.percentage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">{holding.percentage}% of portfolio</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
