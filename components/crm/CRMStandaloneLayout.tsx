import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight, LogOut, Menu, MoreHorizontal, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { ROLE_LABELS } from "../../lib/permissions";
import BrandLogo from "../BrandLogo";
import CRMPwaControls from "../pwa/CRMPwaControls";
import { CRM_PAGE_ACCESS, type CRMPageSection, getCRMAvailablePagesByRole } from "./pageAccess";
import { CRM_PAGE_ICONS, CRM_PAGE_TITLES } from "./crmPageMeta";

const SECTION_LABELS: Record<CRMPageSection, string> = {
  service: "Operação CRM",
  admin: "Configurações",
};

const SIDEBAR_HIDDEN_STORAGE_KEY = "crm_plus_sidebar_hidden";
const MOBILE_QUERY = "(max-width: 1024px)";
const MOBILE_PRIMARY_PAGES = ["conversations", "leads", "simulator", "statistics"] as const;
const MOBILE_TAB_LABELS: Partial<Record<(typeof MOBILE_PRIMARY_PAGES)[number], string>> = {
  statistics: "Métricas",
};

const CRMStandaloneLayout: React.FC = () => {
  const { role, signOut, user } = useAuth();
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });
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
  const mobilePrimaryItems = useMemo(
    () =>
      MOBILE_PRIMARY_PAGES.map((id) => visibleItems.find((item) => item.id === id)).filter(
        (item): item is (typeof visibleItems)[number] => Boolean(item),
      ),
    [visibleItems],
  );
  const mobileOverflowItems = useMemo(
    () => visibleItems.filter((item) => !MOBILE_PRIMARY_PAGES.includes(item.id as (typeof MOBILE_PRIMARY_PAGES)[number])),
    [visibleItems],
  );

  const activePath = location.pathname === "/" ? "/" : location.pathname.replace(/\/$/, "");
  const getItemPath = (id: string) => (id === "conversations" ? "/" : `/${id}`);
  const activePageTitle = useMemo(() => {
    const activeItem = visibleItems.find((item) => {
      const itemPath = getItemPath(item.id);
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
      setIsMoreOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = (matches: boolean) => {
      setIsMobileViewport(matches);
      if (matches) setIsSidebarHidden(true);
      if (!matches) setIsMoreOpen(false);
    };
    update(mq.matches);
    const onChange = (event: MediaQueryListEvent) => update(event.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const root = document.documentElement;
    let frame = 0;

    const getViewportVarTargets = () =>
      [root, document.querySelector<HTMLElement>(".crm-plus-theme")].filter(
        (target): target is HTMLElement => Boolean(target),
      );

    const setViewportVar = (name: string, value: string) => {
      getViewportVarTargets().forEach((target) => target.style.setProperty(name, value));
    };

    const removeViewportVar = (name: string) => {
      getViewportVarTargets().forEach((target) => target.style.removeProperty(name));
    };

    const updateViewportVars = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const height = Math.max(0, Math.round(viewport?.height ?? window.innerHeight));
        const offsetTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
        const keyboardInset = Math.max(0, Math.round(window.innerHeight - height - offsetTop));

        setViewportVar("--crm-visual-viewport-height", `${height}px`);
        setViewportVar("--crm-visual-viewport-offset-top", `${offsetTop}px`);
        setViewportVar("--crm-keyboard-inset", `${keyboardInset}px`);
        root.classList.toggle("is-crm-keyboard-open", keyboardInset > 80);
      });
    };

    updateViewportVars();
    window.visualViewport?.addEventListener("resize", updateViewportVars);
    window.visualViewport?.addEventListener("scroll", updateViewportVars);
    window.addEventListener("resize", updateViewportVars);
    window.addEventListener("orientationchange", updateViewportVars);

    return () => {
      window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", updateViewportVars);
      window.visualViewport?.removeEventListener("scroll", updateViewportVars);
      window.removeEventListener("resize", updateViewportVars);
      window.removeEventListener("orientationchange", updateViewportVars);
      root.classList.remove("is-crm-keyboard-open");
      removeViewportVar("--crm-visual-viewport-height");
      removeViewportVar("--crm-visual-viewport-offset-top");
      removeViewportVar("--crm-keyboard-inset");
    };
  }, []);

  const closeSidebarOnMobile = () => {
    if (typeof window === "undefined") return;
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setIsSidebarHidden(true);
    }
  };

  const closeMobileSurfaces = () => {
    closeSidebarOnMobile();
    setIsMoreOpen(false);
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
                    const path = getItemPath(item.id);
                    const normalizedPath = path === "/" ? "/" : path.replace(/\/$/, "");
                    const isActive = activePath === normalizedPath;
                    return (
                      <NavLink
                        key={item.id}
                        to={path}
                        title={CRM_PAGE_TITLES[item.id]}
                        onClick={closeMobileSurfaces}
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

            <CRMPwaControls />
          </header>

          <div className="crm-main-content">
            <Outlet />
          </div>
        </main>

        {isMobileViewport && (
          <nav className="crm-mobile-tabbar" aria-label="Navegação principal CRM">
            {mobilePrimaryItems.map((item) => {
              const Icon = CRM_PAGE_ICONS[item.id];
              const path = getItemPath(item.id);
              const normalizedPath = path === "/" ? "/" : path.replace(/\/$/, "");
              const isActive = activePath === normalizedPath;
              return (
                <NavLink
                  key={item.id}
                  to={path}
                  aria-label={CRM_PAGE_TITLES[item.id]}
                  title={CRM_PAGE_TITLES[item.id]}
                  onClick={closeMobileSurfaces}
                  className={`crm-mobile-tabbar-item ${isActive ? "is-active" : ""}`}
                >
                  <Icon size={20} />
                  <span aria-hidden="true">
                    {MOBILE_TAB_LABELS[item.id as (typeof MOBILE_PRIMARY_PAGES)[number]] ?? CRM_PAGE_TITLES[item.id]}
                  </span>
                </NavLink>
              );
            })}
            {mobileOverflowItems.length > 0 && (
              <button
                type="button"
                className={`crm-mobile-tabbar-item ${isMoreOpen ? "is-active" : ""}`}
                onClick={() => setIsMoreOpen((prev) => !prev)}
                aria-haspopup="dialog"
                aria-expanded={isMoreOpen}
              >
                <MoreHorizontal size={20} />
                <span>Mais</span>
              </button>
            )}
          </nav>
        )}

        {isMobileViewport && isMoreOpen && (
          <>
            <button
              type="button"
              className="crm-mobile-more-backdrop"
              aria-label="Fechar mais páginas"
              onClick={() => setIsMoreOpen(false)}
            />
            <section className="crm-mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Mais páginas do CRM">
              <div className="crm-mobile-more-handle" aria-hidden="true" />
              <div className="crm-mobile-more-header">
                <div>
                  <p className="crm-layout-page-kicker">CRM Plus</p>
                  <h2>Mais páginas</h2>
                </div>
                <button type="button" className="crm-icon-btn" onClick={() => setIsMoreOpen(false)} aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>
              <div className="crm-mobile-more-grid">
                {mobileOverflowItems.map((item) => {
                  const Icon = CRM_PAGE_ICONS[item.id];
                  const path = getItemPath(item.id);
                  return (
                    <NavLink
                      key={item.id}
                      to={path}
                      className="crm-mobile-more-link"
                      onClick={closeMobileSurfaces}
                    >
                      <Icon size={18} />
                      <span>{CRM_PAGE_TITLES[item.id]}</span>
                    </NavLink>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default CRMStandaloneLayout;
