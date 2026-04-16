import React, { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Loader2 } from "lucide-react";
import { DataProvider } from "../../services/dataContext";
import { supabase } from "../../services/supabase";
import Login from "../../pages/Login";
import ProtectedRoute from "../auth/ProtectedRoute";
import PublicOnlyRoute from "../auth/PublicOnlyRoute";
import { useAuth } from "../../contexts/AuthContext";
import CRMStandaloneLayout from "./CRMStandaloneLayout";
import ConversationsPage from "../../pages/crm/ConversationsPage";
import CommentsPage from "../../pages/crm/CommentsPage";
import LeadsPage from "../../pages/crm/LeadsPage";
import FunnelsPage from "../../pages/crm/FunnelsPage";
import StatisticsPage from "../../pages/crm/StatisticsPage";
import AdsPage from "../../pages/crm/AdsPage";
import FormsPage from "../../pages/crm/FormsPage";
import AutomationsPage from "../../pages/crm/AutomationsPage";
import BroadcastsPage from "../../pages/crm/BroadcastsPage";
import TemplatesPage from "../../pages/crm/TemplatesPage";
import CustomFieldsPage from "../../pages/crm/CustomFieldsPage";
import AttendanceScriptsPage from "../../pages/crm/AttendanceScriptsPage";
import IntegrationsPage from "../../pages/crm/IntegrationsPage";
import CashbackPage from "../../pages/crm/CashbackPage";
import SettingsPage from "../../pages/crm/SettingsPage";
import LegacyRedirectPage from "../../pages/crm/LegacyRedirectPage";
import { CRMStoreProvider } from "./useCRMStore";

const CRMRoleGate: React.FC<{ adminOnly?: boolean }> = ({ adminOnly = false }) => {
  const { role } = useAuth();
  if (adminOnly && role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

const CRMHandoffBootstrap: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [processing, setProcessing] = useState(false);

  const handoffCode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("handoff");
    return raw ? raw.trim() : "";
  }, [location.search]);

  useEffect(() => {
    if (!handoffCode) return;
    if (isLoading) return;
    if (isAuthenticated) {
      const params = new URLSearchParams(location.search);
      params.delete("handoff");
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
      return;
    }

    let cancelled = false;
    const consumeHandoff = async () => {
      setProcessing(true);
      try {
        const { data, error } = await supabase.functions.invoke("crm-auth-handoff", {
          body: { action: "consume", code: handoffCode },
        });

        if (error) throw error;
        if (!data?.success || !data?.session?.access_token || !data?.session?.refresh_token) {
          throw new Error(data?.error || "handoff_invalid");
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: String(data.session.access_token),
          refresh_token: String(data.session.refresh_token),
        });
        if (sessionError) throw sessionError;

        if (!cancelled) {
          const params = new URLSearchParams(location.search);
          params.delete("handoff");
          navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
        }
      } catch {
        if (!cancelled) {
          navigate("/login", { replace: true });
        }
      } finally {
        if (!cancelled) setProcessing(false);
      }
    };

    void consumeHandoff();
    return () => {
      cancelled = true;
    };
  }, [handoffCode, isAuthenticated, isLoading, location.pathname, location.search, navigate]);

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex items-center gap-2 text-slate-700">
          <Loader2 size={18} className="animate-spin" />
          <span>Sincronizando sessão CRM...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={(
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        )}
      />

      <Route
        element={(
          <ProtectedRoute>
            <CRMStandaloneLayout />
          </ProtectedRoute>
        )}
      >
        <Route element={<CRMRoleGate />}>
          <Route path="/" element={<ConversationsPage />} />
          <Route path="/comments" element={<CommentsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/funnels" element={<FunnelsPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/ads" element={<AdsPage />} />
          <Route path="/forms" element={<FormsPage />} />
        </Route>

        <Route element={<CRMRoleGate adminOnly />}>
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="/broadcasts" element={<BroadcastsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/custom-fields" element={<CustomFieldsPage />} />
          <Route path="/attendance-scripts" element={<AttendanceScriptsPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/cashback" element={<CashbackPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="/legacy" element={<LegacyRedirectPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const CRMStandaloneApp: React.FC = () => {
  return (
    <DataProvider>
      <CRMStoreProvider>
        <BrowserRouter>
          <CRMHandoffBootstrap />
        </BrowserRouter>
      </CRMStoreProvider>
    </DataProvider>
  );
};

export default CRMStandaloneApp;
