import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DataProvider } from './services/dataContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import PDV from './pages/PDV';
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
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute';

const ProtectedLayout: React.FC = () => (
  <ProtectedRoute>
    <Layout>
      <Outlet />
    </Layout>
  </ProtectedRoute>
);

const App: React.FC = () => {
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
              <Route path="/pdv" element={<PDV />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/warranties" element={<Warranties />} />
              <Route path="/parts-stock" element={<PartsStock />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/card-fees" element={<CardFeesSettings />} />
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
