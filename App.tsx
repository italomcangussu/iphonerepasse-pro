import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DataProvider } from './services/dataContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import PDV from './pages/PDV';
import PDVHistory from './pages/PDVHistory';
import Clients from './pages/Clients';
import Stores from './pages/Stores';
import Sellers from './pages/Sellers';
import Debtors from './pages/Debtors';
import PartsStock from './pages/PartsStock';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import CardFeesSettings from './pages/CardFeesSettings';
import Finance from './pages/Finance';
import Warranties from './pages/Warranties';
import PublicWarranty from './pages/PublicWarranty';
import Login from './pages/Login';
import CRMLeads from './pages/CRMLeads';
import CRMChannels from './pages/CRMChannels';
import ConversationsPage from './pages/crm/ConversationsPage';
import CommentsPage from './pages/crm/CommentsPage';
import FunnelsPage from './pages/crm/FunnelsPage';
import StatisticsPage from './pages/crm/StatisticsPage';
import AdsPage from './pages/crm/AdsPage';
import FormsPage from './pages/crm/FormsPage';
import AutomationsPage from './pages/crm/AutomationsPage';
import BroadcastsPage from './pages/crm/BroadcastsPage';
import TemplatesPage from './pages/crm/TemplatesPage';
import CustomFieldsPage from './pages/crm/CustomFieldsPage';
import AttendanceScriptsPage from './pages/crm/AttendanceScriptsPage';
import IntegrationsPage from './pages/crm/IntegrationsPage';
import CashbackPage from './pages/crm/CashbackPage';
import SettingsPage from './pages/crm/SettingsPage';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute';
import CRMStandaloneApp from './components/crm/CRMStandaloneApp';
import { isCRMStandaloneHost } from './lib/crmRouting';

const ProtectedLayout: React.FC = () => (
  <ProtectedRoute>
    <Layout>
      <Outlet />
    </Layout>
  </ProtectedRoute>
);

const App: React.FC = () => {
  if (typeof window !== 'undefined' && isCRMStandaloneHost(window.location.hostname)) {
    return (
      <AuthProvider>
        <CRMStandaloneApp />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <DataProvider>
        <Router>
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

            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/pdv" element={<PDVHistory />} />
              <Route path="/pdv/nova-venda" element={<PDV />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/warranties" element={<Warranties />} />
              <Route path="/crm" element={<Navigate to="/crm/leads" replace />} />
              <Route path="/crm/conversations" element={<ConversationsPage />} />
              <Route path="/crm/comments" element={<CommentsPage />} />
              <Route path="/crm/leads" element={<CRMLeads />} />
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
              <Route path="/parts-stock" element={<PartsStock />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/card-fees" element={<CardFeesSettings />} />
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
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Finance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/debtors"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Debtors />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sellers"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Sellers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/stores"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Stores />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Profile />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </DataProvider>
    </AuthProvider>
  );
};

export default App;
