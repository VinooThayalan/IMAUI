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
  BarChart3,
  CheckSquare,
  FileEdit,
  FileUp,
  ClipboardCheck,
  Percent,
  GitBranch,
  GitMerge,
  ShoppingCart,
  SplitSquareVertical,
  Rocket,
  Users,
  ChevronDown,
  ChevronRight,
  Wrench,
  Tag,
  Briefcase,
  Factory,
  Layers
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  menuName: string;
  badge?: string;
}

interface NavSection {
  title: string;
  icon?: React.ElementType;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '#dashboard', menuName: 'dashboard' },
      { icon: ArrowLeftRight, label: 'Transactions', href: '#transactions', menuName: 'transactions', badge: '3' },
      { icon: Rocket, label: 'IPO Transactions', href: '#ipo-transactions', menuName: 'ipo-transactions' },
      { icon: CheckSquare, label: 'Transaction Approvals', href: '#transaction-approvals', menuName: 'transaction-approvals', badge: '2' },
      { icon: FileUp, label: 'Buy & Sell Notes', href: '#buy-sell-notes', menuName: 'buy-sell-notes' },
      { icon: ClipboardCheck, label: 'Buy & Sell Approvals', href: '#buy-sell-approvals', menuName: 'buy-sell-approvals' },
      { icon: Wallet, label: 'Cash Balance', href: '#cash-balance', menuName: 'cash-balance' },
      { icon: FileEdit, label: 'Scrip Entry', href: '#scrip-entry', menuName: 'scrip-entry' },
      { icon: DollarSign, label: 'Dividends', href: '#dividends', menuName: 'dividends' },
      { icon: GitBranch, label: 'Rights Issues', href: '#rights-issues', menuName: 'rights-issues' },
      { icon: GitMerge, label: 'Amalgamations', href: '#amalgamations', menuName: 'amalgamations' },
      { icon: ShoppingCart, label: 'Share Buybacks', href: '#share-buybacks', menuName: 'share-buybacks' },
      { icon: SplitSquareVertical, label: 'Share Subdivisions', href: '#share-subdivisions', menuName: 'share-subdivisions' },
      { icon: Calendar, label: 'Daily Prices', href: '#daily-prices', menuName: 'daily-prices' },
      { icon: BarChart3, label: 'Share Analytics', href: '#share-analytics', menuName: 'share-analytics' },
      { icon: PieChart, label: 'Portfolio', href: '#portfolio', menuName: 'portfolio' },
    ]
  },
  {
    title: 'Master Data',
    items: [
      { icon: Building2, label: 'Entities', href: '#entities', menuName: 'entities' },
      { icon: TrendingUp, label: 'Shares', href: '#shares', menuName: 'shares' },
      { icon: Landmark, label: 'Banks', href: '#banks', menuName: 'banks' },
      { icon: Briefcase, label: 'Brokers', href: '#brokers', menuName: 'brokers' },
    ]
  },
  {
    title: 'Configurations',
    icon: Wrench,
    items: [
      { icon: Tag, label: 'Entity Types', href: '#entity-types', menuName: 'entity-types' },
      { icon: Percent, label: 'Brokerage Fee Types', href: '#brokerage-fee-types', menuName: 'brokerage-fee-types' },
      { icon: Factory, label: 'Industry Types', href: '#industry-types', menuName: 'industry-types' },
      { icon: Layers, label: 'Sector Types', href: '#sector-types', menuName: 'sector-types' },
    ]
  },
  {
    title: 'System',
    items: [
      { icon: FileText, label: 'Reports', href: '#reports', menuName: 'reports' },
      { icon: Settings, label: 'Settings', href: '#settings', menuName: 'settings' },
      { icon: Users, label: 'User Management', href: '#user-management', menuName: 'user-management' },
    ]
  }
];

export function Sidebar() {
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);

  function toggleSection(title: string) {
    setCollapsedSections(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  }

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

      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title}>
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full flex items-center justify-between px-2 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-2">
                {section.icon && <section.icon className="w-4 h-4" />}
                <span>{section.title}</span>
              </div>
              {collapsedSections.includes(section.title) ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {!collapsedSections.includes(section.title) && (
              <div className="mt-1 space-y-1">
                {section.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between px-4 py-2.5 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
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
