import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  Landmark,
  ArrowLeftRight,
  DollarSign,
  FileText,
  Settings,
  PieChart,
  Calendar,
  Wallet,
  BarChart3
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '#dashboard' },
  { icon: Building2, label: 'Entities', href: '#entities' },
  { icon: TrendingUp, label: 'Shares', href: '#shares' },
  { icon: Landmark, label: 'Banks', href: '#banks' },
  { icon: Wallet, label: 'Cash Balance', href: '#cash-balance' },
  { icon: ArrowLeftRight, label: 'Transactions', href: '#transactions', badge: '3' },
  { icon: DollarSign, label: 'Dividends', href: '#dividends' },
  { icon: Calendar, label: 'Daily Prices', href: '#daily-prices' },
  { icon: BarChart3, label: 'Share Analytics', href: '#share-analytics' },
  { icon: PieChart, label: 'Portfolio', href: '#portfolio' },
  { icon: FileText, label: 'Reports', href: '#reports' },
  { icon: Settings, label: 'Settings', href: '#settings' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">IMA</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center justify-between px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <item.icon className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
              <span className="font-medium">{item.label}</span>
            </div>
            {item.badge && (
              <span className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full">
                {item.badge}
              </span>
            )}
          </a>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 px-4 py-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-700">JD</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">John Doe</p>
            <p className="text-xs text-gray-500">Administrator</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
