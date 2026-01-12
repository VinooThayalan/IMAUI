import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Entities } from './pages/Entities';
import { Shares } from './pages/Shares';
import { Banks } from './pages/Banks';
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
import { BrokerageFeeTypes } from './pages/BrokerageFeeTypes';
import { RightsIssues } from './pages/RightsIssues';
import { Amalgamations } from './pages/Amalgamations';
import { ShareBuybacks } from './pages/ShareBuybacks';
import { ShareSubdivisions } from './pages/ShareSubdivisions';
import { IpoTransactions } from './pages/IpoTransactions';
import { UserManagement } from './pages/UserManagement';
import { Login } from './pages/Login';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user, appUser, loading } = useAuth();
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
    switch (currentPage) {
      case 'entities':
        return <Entities />;
      case 'shares':
        return <Shares />;
      case 'banks':
        return <Banks />;
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
      case 'brokerage-fee-types':
        return <BrokerageFeeTypes />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      case 'user-management':
        return <UserManagement />;
      default:
        return <Dashboard />;
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

  if (!appUser.is_active) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Inactive</h1>
          <p className="text-gray-600">Your account has been deactivated. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      {renderPage()}
    </Layout>
  );
}

export default App;
