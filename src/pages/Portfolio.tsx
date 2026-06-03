import { PieChart, TrendingUp, Wallet, Percent, Download } from 'lucide-react';

function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const portfolioData = {
  totalValue: 24567890,
  totalGainLoss: 3456789,
  percentChange: 16.4,
  cashBalance: 2714936.12
};

const sectorAllocation = [
  { sector: 'Banking', value: 12234567, percentage: 49.8, color: 'bg-blue-600' },
  { sector: 'Conglomerate', value: 3456789, percentage: 14.1, color: 'bg-green-600' },
  { sector: 'Telecommunications', value: 2345678, percentage: 9.5, color: 'bg-yellow-600' },
  { sector: 'Diversified', value: 2123456, percentage: 8.6, color: 'bg-red-600' },
  { sector: 'Manufacturing', value: 1789012, percentage: 7.3, color: 'bg-gray-600' },
  { sector: 'Power & Energy', value: 903456, percentage: 3.7, color: 'bg-orange-600' },
  { sector: 'Other', value: 1714932, percentage: 7.0, color: 'bg-teal-600' },
];

const entityBreakdown = [
  { name: 'Fernando Family Trust', value: 5234000, percentage: 21.3, shares: 12 },
  { name: 'Perera Holdings', value: 8456700, percentage: 34.4, shares: 18 },
  { name: 'Silva Investment Group', value: 3876200, percentage: 15.8, shares: 9 },
  { name: 'Jayasinghe Capital', value: 6123450, percentage: 24.9, shares: 15 },
  { name: 'Wijesinghe Retirement Fund', value: 877540, percentage: 3.6, shares: 7 },
];

const topPerformers = [
  { ticker: 'JKH', name: 'John Keells Holdings', gainLoss: '+Rs. 145,678', percentage: '+67.3%', color: 'text-green-600' },
  { ticker: 'NDB', name: 'National Development Bank', gainLoss: '+Rs. 89,234', percentage: '+23.4%', color: 'text-green-600' },
  { ticker: 'Sampath', name: 'Sampath Bank', gainLoss: '+Rs. 67,890', percentage: '+15.7%', color: 'text-green-600' },
];

const bottomPerformers = [
  { ticker: 'Dialog', name: 'Dialog Axiata', gainLoss: '-Rs. 34,567', percentage: '-12.4%', color: 'text-red-600' },
  { ticker: 'LOLC', name: 'LOLC Holdings', gainLoss: '-Rs. 23,456', percentage: '-8.9%', color: 'text-red-600' },
  { ticker: 'Hemas', name: 'Hemas Holdings', gainLoss: '-Rs. 12,345', percentage: '-4.2%', color: 'text-red-600' },
];

export function Portfolio() {
  function handleExport() {
    const date = new Date().toISOString().split('T')[0];

    exportCsv(`portfolio_sector_allocation_${date}.csv`,
      ['Sector', 'Value (Rs.)', 'Percentage (%)'],
      sectorAllocation.map(s => [s.sector, s.value, s.percentage])
    );

    setTimeout(() => {
      exportCsv(`portfolio_entity_breakdown_${date}.csv`,
        ['Entity', 'Value (Rs.)', 'Percentage (%)', 'No. of Shares'],
        entityBreakdown.map(e => [e.name, e.value, e.percentage, e.shares])
      );
    }, 300);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Overview</h1>
          <p className="text-gray-500 mt-1">Comprehensive view of your investment portfolio</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                Rs. {portfolioData.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-600 ml-1">+{portfolioData.percentChange}%</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Gain/Loss</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                +Rs. {portfolioData.totalGainLoss.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mt-2">All time</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Cash Balance</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                Rs. {portfolioData.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-500 mt-2">Available funds</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Return Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">+{portfolioData.percentChange}%</p>
              <p className="text-sm text-gray-500 mt-2">Year to date</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <Percent className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <PieChart className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-bold text-gray-900">Sector Allocation</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {sectorAllocation.map((sector) => (
              <div key={sector.sector} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${sector.color}`}></div>
                    <span className="text-sm font-medium text-gray-900">{sector.sector}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      Rs. {sector.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">{sector.percentage}%</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${sector.color} h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${sector.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Entity Breakdown</h2>
          </div>
          <div className="p-6 space-y-4">
            {entityBreakdown.map((entity) => (
              <div key={entity.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{entity.name}</p>
                    <p className="text-xs text-gray-500">{entity.shares} different shares</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      Rs. {entity.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">{entity.percentage}%</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${entity.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Top Performers</h2>
          </div>
          <div className="p-6 space-y-4">
            {topPerformers.map((stock, index) => (
              <div key={stock.ticker} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-green-600">{index + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{stock.ticker}</p>
                    <p className="text-xs text-gray-500">{stock.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${stock.color}`}>{stock.gainLoss}</p>
                  <p className={`text-xs font-medium ${stock.color}`}>{stock.percentage}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Bottom Performers</h2>
          </div>
          <div className="p-6 space-y-4">
            {bottomPerformers.map((stock, index) => (
              <div key={stock.ticker} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-red-600">{index + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{stock.ticker}</p>
                    <p className="text-xs text-gray-500">{stock.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${stock.color}`}>{stock.gainLoss}</p>
                  <p className={`text-xs font-medium ${stock.color}`}>{stock.percentage}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
