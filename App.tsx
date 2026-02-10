import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './services/dataContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import PDV from './pages/PDV';
import Clients from './pages/Clients';
import Stores from './pages/Stores';
import Sellers from './pages/Sellers';
import Profile from './pages/Profile';
import Finance from './pages/Finance';
import Warranties from './pages/Warranties';

const App: React.FC = () => {
  return (
    <DataProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/pdv" element={<PDV />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/stores" element={<Stores />} />
            <Route path="/sellers" element={<Sellers />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/warranties" element={<Warranties />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </DataProvider>
  );
};

export default App;