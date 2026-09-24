import { useState, useEffect, Suspense } from 'react';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
// Every page loads through lazyWithRetry so a deploy that changes chunk
// hashes cannot leave an open session stranded. See lib/chunkErrors.ts.
import { lazyWithRetry } from './lib/lazyWithRetry';
import { Login } from './pages/Login';
import { useAuth } from './contexts/AuthContext';
import { Shield } from 'lucide-react';
import { LoadingState } from './components/Loading';

const Dashboard = lazyWithRetry(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Entities = lazyWithRetry(() => import('./pages/Entities').then(m => ({ default: m.Entities })));
const Shares = lazyWithRetry(() => import('./pages/Shares').then(m => ({ default: m.Shares })));
const Banks = lazyWithRetry(() => import('./pages/Banks').then(m => ({ default: m.Banks })));
const Brokers = lazyWithRetry(() => import('./pages/Brokers').then(m => ({ default: m.Brokers })));
const Transactions = lazyWithRetry(() => import('./pages/Transactions').then(m => ({ default: m.Transactions })));
const TransactionApprovals = lazyWithRetry(() => import('./pages/TransactionApprovals').then(m => ({ default: m.TransactionApprovals })));
const ScripEntry = lazyWithRetry(() => import('./pages/ScripEntry').then(m => ({ default: m.ScripEntry })));
const BuyAndSellNotes = lazyWithRetry(() => import('./pages/BuyAndSellNotes').then(m => ({ default: m.BuyAndSellNotes })));
const BuyAndSellApprovals = lazyWithRetry(() => import('./pages/BuyAndSellApprovals').then(m => ({ default: m.BuyAndSellApprovals })));
const Dividends = lazyWithRetry(() => import('./pages/Dividends').then(m => ({ default: m.Dividends })));
const Portfolio = lazyWithRetry(() => import('./pages/Portfolio').then(m => ({ default: m.Portfolio })));
const Reports = lazyWithRetry(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Settings = lazyWithRetry(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const DailyPrices = lazyWithRetry(() => import('./pages/DailyPrices').then(m => ({ default: m.DailyPrices })));
const CashBalance = lazyWithRetry(() => import('./pages/CashBalance').then(m => ({ default: m.CashBalance })));
const ShareAnalytics = lazyWithRetry(() => import('./pages/ShareAnalytics').then(m => ({ default: m.ShareAnalytics })));
const ShareSpecificValues = lazyWithRetry(() => import('./pages/ShareSpecificValues').then(m => ({ default: m.ShareSpecificValues })));
const PortfolioSummary = lazyWithRetry(() => import('./pages/PortfolioSummary').then(m => ({ default: m.PortfolioSummary })));
const BrokerageFeeTypes = lazyWithRetry(() => import('./pages/BrokerageFeeTypes').then(m => ({ default: m.BrokerageFeeTypes })));
const RightsIssues = lazyWithRetry(() => import('./pages/RightsIssues').then(m => ({ default: m.RightsIssues })));
const Amalgamations = lazyWithRetry(() => import('./pages/Amalgamations').then(m => ({ default: m.Amalgamations })));
const ShareBuybacks = lazyWithRetry(() => import('./pages/ShareBuybacks').then(m => ({ default: m.ShareBuybacks })));
const ShareSubdivisions = lazyWithRetry(() => import('./pages/ShareSubdivisions').then(m => ({ default: m.ShareSubdivisions })));
const IpoTransactions = lazyWithRetry(() => import('./pages/IpoTransactions').then(m => ({ default: m.IpoTransactions })));
const UserManagement = lazyWithRetry(() => import('./pages/UserManagement').then(m => ({ default: m.UserManagement })));
const AuditLog = lazyWithRetry(() => import('./pages/AuditLog').then(m => ({ default: m.AuditLog })));
const MenuAccess = lazyWithRetry(() => import('./pages/MenuAccess').then(m => ({ default: m.MenuAccess })));
const EntityAccess = lazyWithRetry(() => import('./pages/EntityAccess').then(m => ({ default: m.EntityAccess })));
const EntityTypes = lazyWithRetry(() => import('./pages/EntityTypes').then(m => ({ default: m.EntityTypes })));
const IndustryTypes = lazyWithRetry(() => import('./pages/IndustryTypes').then(m => ({ default: m.IndustryTypes })));
const SectorTypes = lazyWithRetry(() => import('./pages/SectorTypes').then(m => ({ default: m.SectorTypes })));
const BankMaster = lazyWithRetry(() => import('./pages/BankMaster').then(m => ({ default: m.BankMaster })));
const OpeningBalances = lazyWithRetry(() => import('./pages/OpeningBalances').then(m => ({ default: m.OpeningBalances })));
const BankTransactionHistory = lazyWithRetry(() => import('./pages/BankTransactionHistory').then(m => ({ default: m.BankTransactionHistory })));
const TestEmail = lazyWithRetry(() => import('./pages/TestEmail').then(m => ({ default: m.TestEmail })));
const EmailDeliveries = lazyWithRetry(() => import('./pages/EmailDeliveries').then(m => ({ default: m.EmailDeliveries })));

function PageFallback() {
  return (
    <LoadingState />
  );
}

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

/**
 * Something stopped the account loading, and it is not a permission problem.
 *
 * Deliberately not the Access Denied screen and deliberately not the login page:
 * the person is signed in, and telling them otherwise is what made this
 * confusing enough to be reported.
 */
function AuthProblem({ title, detail, onRetry, onSignOut }: {
  title: string;
  detail: string;
  onRetry?: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 p-8">
      <div className="text-center max-w-md">
        <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-gray-500 mt-2 text-sm">{detail}</p>
        <div className="flex items-center justify-center gap-3 mt-5">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
          )}
          <button
            onClick={onSignOut}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

const adminPages = new Set(['user-management', 'menu-access', 'entity-access', 'test-email', 'email-deliveries']);

function App() {
  const { user, appUser, loading, hasMenuAccess, isAdmin, status, statusReason, retryIdentity, signOut } = useAuth();
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
      case 'bank-transaction-history':
        return <BankTransactionHistory />;
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
      case 'share-specific-values':
        return <ShareSpecificValues />;
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
      case 'bank-master':
        return <BankMaster />;
      case 'opening-balances':
        return <OpeningBalances />;
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
      case 'audit-log':
        return <AuditLog />;
      case 'test-email':
        return <TestEmail />;
      case 'email-deliveries':
        return <EmailDeliveries />;
      default:
        return hasMenuAccess('dashboard') ? <Dashboard /> : <AccessDenied />;
    }
  };

  if (loading) {
    return (
      <LoadingState screen />
    );
  }

  /*
    A failed load is not a denial.

    These two screens exist because the alternative was showing the app shell
    with an invented account in it: "Access Denied" on every page, the person's
    own email in the menu, and their name rendered as "User". Whatever went wrong
    is said out loud, and the way out is a retry rather than a reload the user
    has to think of themselves.
  */
  if (user && status === 'unavailable') {
    return <AuthProblem
      title="Could not load your account"
      detail={statusReason ?? 'The server did not answer.'}
      onRetry={() => void retryIdentity()}
      onSignOut={() => void signOut()}
    />;
  }

  if (user && status === 'not-provisioned') {
    return <AuthProblem
      title="Your account is not set up"
      detail={`${user.email ?? 'This login'} signed in, but has no profile in this application. An administrator needs to add it.`}
      onSignOut={() => void signOut()}
    />;
  }

  if (!user || !appUser) {
    return <Login />;
  }

  return (
    <Layout>
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          {renderPage()}
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
}

export default App;
