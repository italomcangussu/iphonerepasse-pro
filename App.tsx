import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DataProvider } from './services/dataContext';
import Layout from './components/Layout';
import Login from './pages/Login';
const LeadsPage = lazy(() => import('./pages/crm/LeadsPage'));
const CRMChannels = lazy(() => import('./pages/CRMChannels'));
const ConversationsPage = lazy(() => import('./pages/crm/ConversationsPage'));
const CommentsPage = lazy(() => import('./pages/crm/CommentsPage'));
const FunnelsPage = lazy(() => import('./pages/crm/FunnelsPage'));
const StatisticsPage = lazy(() => import('./pages/crm/StatisticsPage'));
const AdsPage = lazy(() => import('./pages/crm/AdsPage'));
const FormsPage = lazy(() => import('./pages/crm/FormsPage'));
const AutomationsPage = lazy(() => import('./pages/crm/AutomationsPage'));
const BroadcastsPage = lazy(() => import('./pages/crm/BroadcastsPage'));
const TemplatesPage = lazy(() => import('./pages/crm/TemplatesPage'));
const CustomFieldsPage = lazy(() => import('./pages/crm/CustomFieldsPage'));
const AttendanceScriptsPage = lazy(() => import('./pages/crm/AttendanceScriptsPage'));
const IntegrationsPage = lazy(() => import('./pages/crm/IntegrationsPage'));
const CashbackPage = lazy(() => import('./pages/crm/CashbackPage'));
const SettingsPage = lazy(() => import('./pages/crm/SettingsPage'));
import { AuthProvider } from './contexts/AuthContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute';
const CRMStandaloneApp = lazy(() => import('./components/crm/CRMStandaloneApp'));
import { CRMStoreProvider } from './components/crm/useCRMStore';
import { isCRMStandaloneHost } from './lib/crmRouting';

const ProtectedLayout: React.FC = () => (
  <ProtectedRoute>
    <Layout>
      <Outlet />
    </Layout>
  </ProtectedRoute>
);

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const InUse = lazy(() => import('./pages/InUse'));
const PDV = lazy(() => import('./pages/PDV'));
const PDVHistory = lazy(() => import('./pages/PDVHistory'));
const Clients = lazy(() => import('./pages/Clients'));
const Marketing = lazy(() => import('./pages/Marketing'));
const Stores = lazy(() => import('./pages/Stores'));
const Sellers = lazy(() => import('./pages/Sellers'));
const Debtors = lazy(() => import('./pages/Debtors'));
const PayableDebts = lazy(() => import('./pages/PayableDebts'));
const PartsStock = lazy(() => import('./pages/PartsStock'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const CardFeesSettings = lazy(() => import('./pages/CardFeesSettings'));
const Finance = lazy(() => import('./pages/Finance'));
const Warranties = lazy(() => import('./pages/Warranties'));
const PublicWarranty = lazy(() => import('./pages/PublicWarranty'));
import PrivacyPolicyPage from './pages/legal/PrivacyPolicy';
import TermsOfServicePage from './pages/legal/TermsOfService';
import DataUsagePage from './pages/legal/DataUsage';

const App: React.FC = () => {
  const [currentHash, setCurrentHash] = React.useState(typeof window !== 'undefined' ? window.location.hash : '');

  React.useEffect(() => {
    const handleHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const isStandalone = typeof window !== 'undefined' && (
    isCRMStandaloneHost(window.location.hostname) || 
    currentHash.startsWith('#/crmplus')
  );

  if (isStandalone) {
    return (
      <AuthProvider>
        <PermissionsProvider>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Carregando...</div>}>
            <CRMStandaloneApp />
          </Suspense>
        </PermissionsProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <PermissionsProvider>
        <DataProvider>
          <CRMStoreProvider>
            <Router>
              <Suspense
                fallback={
                  <div className="min-h-screen bg-surface-light-100 dark:bg-surface-dark-50 flex items-center justify-center text-sm text-gray-500">
                    Carregando...
                  </div>
                }
              >
                <Routes>
                  <Route
                    path="/login"
                    element={
                      <PublicOnlyRoute>
                        <Login />
                      </PublicOnlyRoute>
                    }
                  />
                  <Route path="/warranties/:cpf" element={<PublicWarranty />} />
                  <Route path="/warranty/:token" element={<PublicWarranty />} />

                  {/* Legal pages — public, no auth required */}
                  <Route path="/legal/privacidade" element={<PrivacyPolicyPage />} />
                  <Route path="/legal/termos" element={<TermsOfServicePage />} />
                  <Route path="/legal/dados" element={<DataUsagePage />} />

                  <Route element={<ProtectedLayout />}>
                    <Route
                      path="/"
                      element={(
                        <ProtectedRoute requiredPermission="dashboard">
                          <Dashboard />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="/inventory"
                      element={(
                        <ProtectedRoute requiredPermission="inventory">
                          <Inventory />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="/in-use"
                      element={(
                        <ProtectedRoute requiredPermission="in_use">
                          <InUse />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="/pdv"
                      element={(
                        <ProtectedRoute requiredPermission="pdv">
                          <PDVHistory />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="/pdv/nova-venda"
                      element={(
                        <ProtectedRoute requiredPermission="pdv">
                          <PDV />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="/clients"
                      element={(
                        <ProtectedRoute requiredPermission="clients">
                          <Clients />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="/warranties"
                      element={(
                        <ProtectedRoute requiredPermission="warranties">
                          <Warranties />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="/marketing"
                      element={(
                        <ProtectedRoute requiredPermission="marketing">
                          <Marketing />
                        </ProtectedRoute>
                      )}
                    />
                    <Route path="/crm" element={<Navigate to="/crm/leads" replace />} />
                    <Route path="/crm/conversations" element={<ConversationsPage />} />
                    <Route path="/crm/comments" element={<CommentsPage />} />
                    <Route path="/crm/leads" element={<LeadsPage />} />
                    <Route path="/crm/funnels" element={<FunnelsPage />} />
                    <Route path="/crm/statistics" element={<StatisticsPage />} />
                    <Route path="/crm/ads" element={<AdsPage />} />
                    <Route path="/crm/forms" element={<FormsPage />} />
                    <Route
                      path="/crm/automations"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <AutomationsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/crm/broadcasts"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <BroadcastsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/crm/templates"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <TemplatesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/crm/custom-fields"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <CustomFieldsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/crm/attendance-scripts"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <AttendanceScriptsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/crm/integrations"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <IntegrationsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/crm/cashback"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <CashbackPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/parts-stock"
                      element={(
                        <ProtectedRoute requiredPermission="parts_stock">
                          <PartsStock />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="/settings"
                      element={(
                        <ProtectedRoute requiredPermission="settings">
                          <Settings />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="/settings/card-fees"
                      element={(
                        <ProtectedRoute requiredPermission="card_fees">
                          <CardFeesSettings />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="/crm/channels"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <CRMChannels />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/crm/settings"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <SettingsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/finance"
                      element={
                        <ProtectedRoute allowedRoles={['admin']} requiredPermission="finance">
                          <Finance />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/debtors"
                      element={
                        <ProtectedRoute allowedRoles={['admin']} requiredPermission="debtors">
                          <Debtors />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/payable-debts"
                      element={
                        <ProtectedRoute allowedRoles={['admin']} requiredPermission="payable_debts">
                          <PayableDebts />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/sellers"
                      element={
                        <ProtectedRoute allowedRoles={['admin']} requiredPermission="sellers">
                          <Sellers />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/stores"
                      element={
                        <ProtectedRoute allowedRoles={['admin']} requiredPermission="stores">
                          <Stores />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute allowedRoles={['admin']} requiredPermission="profile_store">
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </Router>
          </CRMStoreProvider>
        </DataProvider>
      </PermissionsProvider>
    </AuthProvider>
  );
};

export default App;
