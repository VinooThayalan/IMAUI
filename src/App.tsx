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

function App() {
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
      case 'portfolio':
        return <Portfolio />;
      case 'daily-prices':
        return <DailyPrices />;
      case 'cash-balance':
        return <CashBalance />;
      case 'share-analytics':
        return <ShareAnalytics />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout>
      {renderPage()}
    </Layout>
  );
}

export default App;
