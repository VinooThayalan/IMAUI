import { FileText, Download, Calendar, Filter, TrendingUp, PieChart, BarChart3, FileBarChart } from 'lucide-react';

const reportTypes = [
  {
    id: 1,
    name: 'Portfolio Valuation Report',
    description: 'Complete portfolio valuation with holdings breakdown',
    icon: PieChart,
    lastGenerated: '2024-01-15',
    frequency: 'Monthly'
  },
  {
    id: 2,
    name: 'Transaction History Report',
    description: 'Detailed history of all buy and sell transactions',
    icon: FileBarChart,
    lastGenerated: '2024-01-14',
    frequency: 'Weekly'
  },
  {
    id: 3,
    name: 'Dividend Income Report',
    description: 'Summary of dividend payments and projections',
    icon: TrendingUp,
    lastGenerated: '2024-01-13',
    frequency: 'Quarterly'
  },
  {
    id: 4,
    name: 'Tax Report',
    description: 'Capital gains, losses, and dividend income for tax filing',
    icon: FileText,
    lastGenerated: '2024-01-01',
    frequency: 'Annual'
  },
  {
    id: 5,
    name: 'Performance Analysis',
    description: 'Detailed performance metrics and benchmarks',
    icon: BarChart3,
    lastGenerated: '2024-01-12',
    frequency: 'Monthly'
  },
  {
    id: 6,
    name: 'Entity Holdings Report',
    description: 'Holdings breakdown by entity with cost basis',
    icon: FileText,
    lastGenerated: '2024-01-15',
    frequency: 'Monthly'
  },
];

const recentReports = [
  {
    id: 1,
    name: 'Portfolio Valuation - January 2024',
    type: 'Portfolio Valuation',
    generatedDate: '2024-01-15 10:30 AM',
    size: '2.3 MB',
    status: 'Ready'
  },
  {
    id: 2,
    name: 'Transaction History - Week 2',
    type: 'Transaction History',
    generatedDate: '2024-01-14 3:45 PM',
    size: '1.8 MB',
    status: 'Ready'
  },
  {
    id: 3,
    name: 'Q4 2023 Tax Report',
    type: 'Tax Report',
    generatedDate: '2024-01-01 9:00 AM',
    size: '4.5 MB',
    status: 'Ready'
  },
  {
    id: 4,
    name: 'Performance Analysis - December',
    type: 'Performance',
    generatedDate: '2024-01-12 2:15 PM',
    size: '3.1 MB',
    status: 'Ready'
  },
];

export function Reports() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 mt-1">Generate and download investment reports</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700">Filter</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700">Date Range</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <div key={report.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <report.icon className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                  {report.frequency}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{report.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{report.description}</p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  Last: {report.lastGenerated}
                </div>
                <button className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  Generate
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Recent Reports</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Generated</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentReports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{report.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      {report.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{report.generatedDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.size}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="flex items-center space-x-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Download className="w-4 h-4" />
                      <span className="text-sm font-medium">Download</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
