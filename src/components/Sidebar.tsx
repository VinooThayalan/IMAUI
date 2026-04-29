import { LayoutDashboard, Building2, TrendingUp, Landmark, ArrowLeftRight, DollarSign, FileText, Settings, PieChart, Calendar, Wallet, BarChart3, CheckSquare, File as FileEdit, FileUp, ClipboardCheck, Percent, GitBranch, GitMerge, ShoppingCart, SplitSquareVertical, Rocket, Users, ChevronDown, ChevronRight, Wrench, Tag, Briefcase, Factory, Layers, Shield, Menu, MapPin } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
  adminOnly?: boolean;
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
      { icon: BarChart3, label: 'Bank Transaction History', href: '#bank-transaction-history', menuName: 'bank-transaction-history' },
      { icon: FileEdit, label: 'Scrip Entry', href: '#scrip-entry', menuName: 'scrip-entry' },
      { icon: Wallet, label: 'Opening Balances', href: '#opening-balances', menuName: 'opening-balances' },
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
      { icon: Landmark, label: 'Entity - Banks', href: '#banks', menuName: 'banks' },
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
      { icon: Landmark, label: 'Banks', href: '#bank-master', menuName: 'bank-master' },
    ]
  },
  {
    title: 'System',
    items: [
      { icon: FileText, label: 'Reports', href: '#reports', menuName: 'reports' },
      { icon: PieChart, label: 'Portfolio Summary', href: '#portfolio-summary', menuName: 'portfolio-summary' },
      { icon: Settings, label: 'Settings', href: '#settings', menuName: 'settings' },
    ]
  },
  {
    title: 'Admin',
    icon: Shield,
    adminOnly: true,
    items: [
      { icon: Users, label: 'User Management', href: '#user-management', menuName: 'user-management' },
      { icon: Menu, label: 'Menu Access', href: '#menu-access', menuName: 'menu-access' },
      { icon: MapPin, label: 'Entity Access', href: '#entity-access', menuName: 'entity-access' },
    ]
  }
];

export function Sidebar() {
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const { appUser, isAdmin, hasMenuAccess } = useAuth();

  function toggleSection(title: string) {
    setCollapsedSections(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  }

  const filteredSections = navSections
    .filter(section => {
      if (section.adminOnly && !isAdmin) return false;
      return true;
    })
    .map(section => ({
      ...section,
      items: section.items.filter(item => hasMenuAccess(item.menuName))
    }))
    .filter(section => section.items.length > 0);

  const initials = appUser?.full_name
    ? appUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#3e5a7d] rounded-lg flex items-center justify-center shadow-md">
            <span className="text-lg font-bold text-white">M</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-900">IMA - Metro Corp</span>
            <span className="text-xs text-gray-500">Portfolio Management</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        {filteredSections.map((section) => (
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
                    className="flex items-center justify-between px-4 py-2.5 text-gray-700 rounded-lg hover:bg-[#3e5a7d] hover:text-white transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-5 h-5 text-gray-500 group-hover:text-white" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-2 py-1 text-xs font-semibold text-white bg-[#4a6a94] rounded-full group-hover:bg-white group-hover:text-[#3e5a7d]">
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
            <span className="text-sm font-semibold text-gray-700">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{appUser?.full_name || 'User'}</p>
            <p className="text-xs text-gray-500 capitalize">{appUser?.role || 'User'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
