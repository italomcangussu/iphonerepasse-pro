import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight, LogOut, Menu, X } from "lucide-react";
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

const SIDEBAR_HIDDEN_STORAGE_KEY = "crm_plus_sidebar_hidden";
const MOBILE_QUERY = "(max-width: 1024px)";

const CRMStandaloneLayout: React.FC = () => {
  const { role, signOut, user } = useAuth();
  const { stores, selectedStoreId, setSelectedStoreId } = useCRMStore();
  const location = useLocation();
  const [isSidebarHidden, setIsSidebarHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem(SIDEBAR_HIDDEN_STORAGE_KEY);
    if (stored !== null) return stored === "1";
    return window.matchMedia(MOBILE_QUERY).matches;
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
    window.localStorage.setItem(SIDEBAR_HIDDEN_STORAGE_KEY, isSidebarHidden ? "1" : "0");
  }, [isSidebarHidden]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setIsSidebarHidden(true);
    }
  }, [location.pathname]);

  const closeSidebarOnMobile = () => {
    if (typeof window === "undefined") return;
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setIsSidebarHidden(true);
    }
  };

  return (
    <div className="crm-plus-theme min-h-screen">
      <div className={`crm-shell-grid ${isSidebarHidden ? "is-sidebar-hidden" : ""}`}>
        {!isSidebarHidden && (
          <button
            type="button"
            className="crm-sidebar-backdrop"
            onClick={() => setIsSidebarHidden(true)}
            aria-label="Fechar menu"
          />
        )}
        <aside className={`crm-sidebar ${isSidebarHidden ? "is-hidden" : ""}`} aria-hidden={isSidebarHidden}>
          <div className="crm-brand">
            <BrandLogo variant="full" className="h-12 w-auto object-contain" />
            <div>
              <p className="crm-brand-title">CRM Plus</p>
              <p className="crm-brand-subtitle">iPhoneRepasse</p>
            </div>
          </div>

          <nav className="crm-nav">
            {grouped.map((group) =>
              group.items.length > 0 ? (
                <div key={group.section} className="space-y-1">
                  <p className="crm-nav-section">{SECTION_LABELS[group.section]}</p>
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
                        onClick={closeSidebarOnMobile}
                        className={`crm-nav-item ${isActive ? "is-active" : ""}`}
                      >
                        <Icon size={18} />
                        <span>{CRM_PAGE_TITLES[item.id]}</span>
                      </NavLink>
                    );
                  })}
                </div>
              ) : null,
            )}
          </nav>

          <div className="crm-sidebar-footer">
            <div className="crm-user-badge">
              <p className="text-xs uppercase tracking-wide text-slate-400">Sessão</p>
              <p className="font-semibold text-slate-100">{ROLE_LABELS[role || "seller"]}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link to="/legacy" className="crm-ghost-link" title="Ir para App" onClick={closeSidebarOnMobile}>
                <ArrowUpRight size={16} />
                Ir para App
              </Link>
              <button
                type="button"
                className="crm-logout-btn"
                onClick={() => void signOut()}
                title="Sair"
              >
                <LogOut size={16} />
                Sair
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
                onClick={() => setIsSidebarHidden((prev) => !prev)}
                aria-label={isSidebarHidden ? "Mostrar menu lateral" : "Ocultar menu lateral"}
                aria-expanded={!isSidebarHidden}
                title={isSidebarHidden ? "Mostrar menu" : "Ocultar menu"}
              >
                {isSidebarHidden ? <Menu size={16} /> : <X size={16} />}
                <span>{isSidebarHidden ? "Mostrar menu" : "Ocultar menu"}</span>
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
