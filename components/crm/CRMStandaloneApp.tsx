import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
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
import { assertNoError } from "../../utils/supabase";
import Login from "../../pages/Login";
import ProtectedRoute from "../auth/ProtectedRoute";
import PublicOnlyRoute from "../auth/PublicOnlyRoute";
import { useAuth } from "../../contexts/AuthContext";
import CRMStandaloneLayout from "./CRMStandaloneLayout";
const ConversationsPage = lazy(() => import("../../pages/crm/ConversationsPage"));
const CommentsPage = lazy(() => import("../../pages/crm/CommentsPage"));
const LeadsPage = lazy(() => import("../../pages/crm/LeadsPage"));
const FunnelsPage = lazy(() => import("../../pages/crm/FunnelsPage"));
const StatisticsPage = lazy(() => import("../../pages/crm/StatisticsPage"));
const SimulatorPage = lazy(() => import("../../pages/crm/SimulatorPage"));
const AdsPage = lazy(() => import("../../pages/crm/AdsPage"));
const FormsPage = lazy(() => import("../../pages/crm/FormsPage"));
const AutomationsPage = lazy(() => import("../../pages/crm/AutomationsPage"));
const BroadcastsPage = lazy(() => import("../../pages/crm/BroadcastsPage"));
const TemplatesPage = lazy(() => import("../../pages/crm/TemplatesPage"));
const CustomFieldsPage = lazy(() => import("../../pages/crm/CustomFieldsPage"));
const AttendanceScriptsPage = lazy(() => import("../../pages/crm/AttendanceScriptsPage"));
const IntegrationsPage = lazy(() => import("../../pages/crm/IntegrationsPage"));
const CashbackPage = lazy(() => import("../../pages/crm/CashbackPage"));
const SettingsPage = lazy(() => import("../../pages/crm/SettingsPage"));
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
        const data = assertNoError(await supabase.functions.invoke("crm-auth-handoff", {
          body: { action: "consume", code: handoffCode },
        }));
        if (!data?.success || !data?.session?.access_token || !data?.session?.refresh_token) {
          throw new Error(data?.error || "handoff_invalid");
        }

        assertNoError(await supabase.auth.setSession({
          access_token: String(data.session.access_token),
          refresh_token: String(data.session.refresh_token),
        }));

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
          <Route path="/conversations/:conversationId" element={<ConversationsPage />} />
          <Route path="/comments" element={<CommentsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/:leadId" element={<LeadsPage />} />
          <Route path="/funnels" element={<FunnelsPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
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
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Carregando...</div>}>
            <CRMHandoffBootstrap />
          </Suspense>
        </BrowserRouter>
      </CRMStoreProvider>
    </DataProvider>
  );
};

export default CRMStandaloneApp;
