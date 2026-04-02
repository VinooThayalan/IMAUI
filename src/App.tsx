import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { Entities } from './pages/Entities';
import { Shares } from './pages/Shares';
import { Banks } from './pages/Banks';
import { Brokers } from './pages/Brokers';
import { Transactions } from './pages/Transactions';
import { TransactionApprovals } from './pages/TransactionApprovals';
import { ScripEntry } from './pages/ScripEntry';
import { BuyAndSellNotes } from './pages/BuyAndSellNotes';
import { BuyAndSellApprovals } from './pages/BuyAndSellApprovals';
import { Dividends } from './pages/Dividends';
import { Portfolio } from './pages/Portfolio';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { DailyPrices } from './pages/DailyPrices';
import { CashBalance } from './pages/CashBalance';
import { ShareAnalytics } from './pages/ShareAnalytics';
import { PortfolioSummary } from './pages/PortfolioSummary';
import { BrokerageFeeTypes } from './pages/BrokerageFeeTypes';
import { RightsIssues } from './pages/RightsIssues';
import { Amalgamations } from './pages/Amalgamations';
import { ShareBuybacks } from './pages/ShareBuybacks';
import { ShareSubdivisions } from './pages/ShareSubdivisions';
import { IpoTransactions } from './pages/IpoTransactions';
import { UserManagement } from './pages/UserManagement';
import { MenuAccess } from './pages/MenuAccess';
import { EntityAccess } from './pages/EntityAccess';
import { EntityTypes } from './pages/EntityTypes';
import { IndustryTypes } from './pages/IndustryTypes';
import { SectorTypes } from './pages/SectorTypes';
import { Login } from './pages/Login';
import { useAuth } from './contexts/AuthContext';
import { Shield } from 'lucide-react';

function AccessDenied() {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center">
        <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-gray-500 mt-2">You do not have permission to access this page.</p>
        <a href="#dashboard" className="inline-block mt-4 text-blue-600 hover:text-blue-800 font-medium text-sm">
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

const adminPages = new Set(['user-management', 'menu-access', 'entity-access']);

function App() {
  const { user, appUser, loading, hasMenuAccess, isAdmin } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setCurrentPage(hash || 'dashboard');
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const renderPage = () => {
    if (adminPages.has(currentPage) && !isAdmin) {
      return <AccessDenied />;
    }

    if (!adminPages.has(currentPage) && currentPage !== 'settings' && !hasMenuAccess(currentPage)) {
      return <AccessDenied />;
    }

    switch (currentPage) {
      case 'entities':
        return <Entities />;
      case 'shares':
        return <Shares />;
      case 'banks':
        return <Banks />;
      case 'brokers':
        return <Brokers />;
      case 'transactions':
        return <Transactions />;
      case 'ipo-transactions':
        return <IpoTransactions />;
      case 'transaction-approvals':
        return <TransactionApprovals />;
      case 'scrip-entry':
        return <ScripEntry />;
      case 'buy-sell-notes':
        return <BuyAndSellNotes />;
      case 'buy-sell-approvals':
        return <BuyAndSellApprovals />;
      case 'dividends':
        return <Dividends />;
      case 'rights-issues':
        return <RightsIssues />;
      case 'amalgamations':
        return <Amalgamations />;
      case 'share-buybacks':
        return <ShareBuybacks />;
      case 'share-subdivisions':
        return <ShareSubdivisions />;
      case 'portfolio':
        return <Portfolio />;
      case 'daily-prices':
        return <DailyPrices />;
      case 'cash-balance':
        return <CashBalance />;
      case 'share-analytics':
        return <ShareAnalytics />;
      case 'portfolio-summary':
        return <PortfolioSummary />;
      case 'brokerage-fee-types':
        return <BrokerageFeeTypes />;
      case 'entity-types':
        return <EntityTypes />;
      case 'industry-types':
        return <IndustryTypes />;
      case 'sector-types':
        return <SectorTypes />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      case 'user-management':
        return <UserManagement />;
      case 'menu-access':
        return <MenuAccess />;
      case 'entity-access':
        return <EntityAccess />;
      default:
        return hasMenuAccess('dashboard') ? <Dashboard /> : <AccessDenied />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !appUser) {
    return <Login />;
  }

  return (
    <Layout>
      <ErrorBoundary>
        {renderPage()}
      </ErrorBoundary>
    </Layout>
  );
}

export default App;
