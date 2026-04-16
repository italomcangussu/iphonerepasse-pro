import React, { useMemo } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight, LogOut } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import BrandLogo from "../BrandLogo";
import { CRM_PAGE_ACCESS, type CRMPageSection, getCRMAvailablePagesByRole } from "./pageAccess";
import { CRM_PAGE_ICONS, CRM_PAGE_TITLES } from "./crmPageMeta";

const SECTION_LABELS: Record<CRMPageSection, string> = {
  service: "Operação CRM",
  admin: "Configurações",
};

const CRMStandaloneLayout: React.FC = () => {
  const { role, signOut, user } = useAuth();
  const location = useLocation();

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

  return (
    <div className="crm-plus-theme min-h-screen">
      <div className="crm-shell-grid">
        <aside className="crm-sidebar">
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
              <p className="font-semibold text-slate-100">{role === "admin" ? "Administrador" : "Vendedor"}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link to="/legacy" className="crm-ghost-link">
                <ArrowUpRight size={16} />
                Ir para App
              </Link>
              <button type="button" className="crm-logout-btn" onClick={() => void signOut()}>
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>
        </aside>

        <main className="crm-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default CRMStandaloneLayout;
