import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { ROLE_LABELS } from "../../lib/permissions";
import BrandLogo from "../BrandLogo";
import { CRM_PAGE_ACCESS, type CRMPageSection, getCRMAvailablePagesByRole } from "./pageAccess";
import { CRM_PAGE_ICONS, CRM_PAGE_TITLES } from "./crmPageMeta";
import { useCRMStore } from "./useCRMStore";

const SECTION_LABELS: Record<CRMPageSection, string> = {
  service: "Operação CRM",
  admin: "Configurações",
};

const SIDEBAR_COLLAPSED_STORAGE_KEY = "crm_plus_sidebar_collapsed";

const CRMStandaloneLayout: React.FC = () => {
  const { role, signOut, user } = useAuth();
  const { stores, selectedStoreId, setSelectedStoreId } = useCRMStore();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  });

  const availablePages = useMemo(() => getCRMAvailablePagesByRole(role), [role]);
  const visibleItems = useMemo(
    () => CRM_PAGE_ACCESS.filter((item) => availablePages.includes(item.id)),
    [availablePages],
  );

  const grouped = useMemo(
    () =>
      (["service", "admin"] as CRMPageSection[]).map((section) => ({
        section,
        items: visibleItems.filter((item) => item.section === section),
      })),
    [visibleItems],
  );

  const activePath = location.pathname === "/" ? "/" : location.pathname.replace(/\/$/, "");
  const activePageTitle = useMemo(() => {
    const activeItem = visibleItems.find((item) => {
      const itemPath = item.id === "conversations" ? "/" : `/${item.id}`;
      const normalizedPath = itemPath === "/" ? "/" : itemPath.replace(/\/$/, "");
      return normalizedPath === activePath;
    });
    return activeItem ? CRM_PAGE_TITLES[activeItem.id] : "Visão Geral";
  }, [activePath, visibleItems]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, isSidebarCollapsed ? "1" : "0");
  }, [isSidebarCollapsed]);

  return (
    <div className="crm-plus-theme min-h-screen">
      <div className={`crm-shell-grid ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
        <aside className={`crm-sidebar ${isSidebarCollapsed ? "is-collapsed" : ""}`}>
          <div className={`crm-brand ${isSidebarCollapsed ? "is-collapsed" : ""}`}>
            {isSidebarCollapsed ? (
              <BrandLogo variant="mark" className="h-10 w-10 object-contain" />
            ) : (
              <>
                <BrandLogo variant="full" className="h-12 w-auto object-contain" />
                <div>
                  <p className="crm-brand-title">CRM Plus</p>
                  <p className="crm-brand-subtitle">iPhoneRepasse</p>
                </div>
              </>
            )}
          </div>

          <nav className="crm-nav">
            {grouped.map((group) =>
              group.items.length > 0 ? (
                <div key={group.section} className="space-y-1">
                  {!isSidebarCollapsed ? <p className="crm-nav-section">{SECTION_LABELS[group.section]}</p> : null}
                  {group.items.map((item) => {
                    const Icon = CRM_PAGE_ICONS[item.id];
                    const path = item.id === "conversations" ? "/" : `/${item.id}`;
                    const normalizedPath = path === "/" ? "/" : path.replace(/\/$/, "");
                    const isActive = activePath === normalizedPath;
                    return (
                      <NavLink
                        key={item.id}
                        to={path}
                        title={CRM_PAGE_TITLES[item.id]}
                        className={`crm-nav-item ${isActive ? "is-active" : ""} ${isSidebarCollapsed ? "is-collapsed" : ""}`}
                      >
                        <Icon size={18} />
                        {!isSidebarCollapsed ? <span>{CRM_PAGE_TITLES[item.id]}</span> : null}
                      </NavLink>
                    );
                  })}
                </div>
              ) : null,
            )}
          </nav>

          <div className="crm-sidebar-footer">
            {!isSidebarCollapsed ? (
              <div className="crm-user-badge">
                <p className="text-xs uppercase tracking-wide text-slate-400">Sessão</p>
                <p className="font-semibold text-slate-100">{ROLE_LABELS[role || "seller"]}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Link to="/legacy" className={`crm-ghost-link ${isSidebarCollapsed ? "is-collapsed" : ""}`} title="Ir para App">
                <ArrowUpRight size={16} />
                {!isSidebarCollapsed ? "Ir para App" : null}
              </Link>
              <button
                type="button"
                className={`crm-logout-btn ${isSidebarCollapsed ? "is-collapsed" : ""}`}
                onClick={() => void signOut()}
                title="Sair"
              >
                <LogOut size={16} />
                {!isSidebarCollapsed ? "Sair" : null}
              </button>
            </div>
          </div>
        </aside>

        <main className="crm-main">
          <header className="crm-layout-header">
            <div className="crm-layout-header-left">
              <button
                type="button"
                className="crm-sidebar-toggle"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                aria-label={isSidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
                title={isSidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
              >
                {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                <span>{isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}</span>
              </button>

              <div className="crm-layout-page-title">
                <p className="crm-layout-page-kicker">CRM Plus</p>
                <p className="crm-layout-page-name">{activePageTitle}</p>
              </div>
            </div>

            <div className="crm-header-store crm-card">
              <label className="crm-field-label" htmlFor="crm-header-store">
                Loja
              </label>
              <select
                id="crm-header-store"
                className="crm-input"
                value={selectedStoreId}
                onChange={(event) => setSelectedStoreId(event.target.value)}
                disabled={stores.length === 0}
              >
                {stores.length === 0 ? <option value="">Sem lojas disponíveis</option> : null}
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <div className="crm-main-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default CRMStandaloneLayout;
