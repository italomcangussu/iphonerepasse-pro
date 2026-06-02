import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight, LogOut, Menu, MoreHorizontal, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { ROLE_LABELS } from "../../lib/permissions";
import BrandLogo from "../BrandLogo";
import CRMPwaControls from "../pwa/CRMPwaControls";
import { CRM_PAGE_ACCESS, type CRMPageSection, getCRMAvailablePagesByRole } from "./pageAccess";
import { CRM_PAGE_ICONS, CRM_PAGE_TITLES } from "./crmPageMeta";
import { resolveCRMViewportMetrics } from "../../lib/crm/viewportMetrics";

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
  // Opt-in on-device diagnostic for the iOS keyboard layout. On a phone there is
  // no console, so it is toggled by a URL flag: append `?kbdebug=1` to enable or
  // `?kbdebug=0` to disable (works in the path or the hash). The choice is
  // persisted to localStorage so it survives reloads / PWA relaunches.
  const showViewportDebug = (() => {
    if (typeof window === "undefined") return false;
    try {
      const haystack = `${window.location.search} ${window.location.hash}`;
      if (/[?&]kbdebug=1\b/.test(haystack)) window.localStorage.setItem("crmkbdebug", "1");
      else if (/[?&]kbdebug=0\b/.test(haystack)) window.localStorage.removeItem("crmkbdebug");
      return window.localStorage.getItem("crmkbdebug") === "1";
    } catch {
      return false;
    }
  })();
  const viewportDebugRef = React.useRef<HTMLDivElement>(null);
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
  const isConversationRoute = activePath === "/";
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
        const activeElement = document.activeElement as HTMLElement | null;
        const metrics = resolveCRMViewportMetrics({
          innerHeight: window.innerHeight,
          visualViewportHeight: viewport?.height,
          visualViewportOffsetTop: viewport?.offsetTop,
          activeElementTagName: activeElement?.tagName,
          activeElementInputType: activeElement instanceof HTMLInputElement ? activeElement.type : null,
          activeElementIsContentEditable: activeElement?.isContentEditable,
        });

        setViewportVar("--crm-visual-viewport-height", `${metrics.height}px`);
        setViewportVar("--crm-visual-viewport-offset-top", `${metrics.offsetTop}px`);
        setViewportVar("--crm-keyboard-inset", `${metrics.keyboardInset}px`);
        root.classList.toggle("is-crm-keyboard-open", metrics.isKeyboardOpen);

        // iOS scrolls the window to "reveal" the focused textarea, which drags
        // the fixed chat surface (anchored to the layout viewport) out of view.
        // Force the document back to the top while the keyboard is open so the
        // surface stays put above the keyboard.
        if (metrics.isKeyboardOpen && (window.scrollY !== 0 || window.pageYOffset !== 0)) {
          window.scrollTo(0, 0);
        }

        const debugEl = viewportDebugRef.current;
        if (debugEl) {
          const shell = document.querySelector<HTMLElement>(".crm-conversation-shell.is-mobile-thread-open");
          const shellH = shell ? Math.round(shell.getBoundingClientRect().height) : -1;
          debugEl.textContent =
            `build=kb8 inner=${Math.round(window.innerHeight)} vv=${Math.round(viewport?.height ?? -1)} ` +
            `off=${Math.round(viewport?.offsetTop ?? -1)} occ=${metrics.keyboardInset} ` +
            `kbOpen=${metrics.isKeyboardOpen ? 1 : 0} h=${metrics.height} top=${metrics.offsetTop} ` +
            `shell=${shellH} scrollY=${Math.round(window.scrollY)} focus=${(activeElement?.tagName || "-").toLowerCase()}`;
        }
      });
    };

    // Directly counter iOS' focus-scroll: any window scroll while the keyboard
    // is open is snapped back to the top so the fixed chat surface cannot be
    // pushed off-screen.
    const keepPinned = () => {
      if (!root.classList.contains("is-crm-keyboard-open")) return;
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    updateViewportVars();
    window.visualViewport?.addEventListener("resize", updateViewportVars);
    window.visualViewport?.addEventListener("scroll", updateViewportVars);
    window.addEventListener("resize", updateViewportVars);
    window.addEventListener("orientationchange", updateViewportVars);
    window.addEventListener("scroll", keepPinned, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", updateViewportVars);
      window.visualViewport?.removeEventListener("scroll", updateViewportVars);
      window.removeEventListener("resize", updateViewportVars);
      window.removeEventListener("orientationchange", updateViewportVars);
      window.removeEventListener("scroll", keepPinned);
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
      {showViewportDebug && (
        <div
          ref={viewportDebugRef}
          style={{
            position: "fixed",
            top: "env(safe-area-inset-top, 0px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "rgba(2,6,23,0.85)",
            color: "#7dd3fc",
            font: "600 10px/1.3 ui-monospace, monospace",
            padding: "2px 6px",
            textTransform: "none",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        />
      )}
      <div className={`crm-shell-grid ${isSidebarHidden ? "is-sidebar-hidden" : ""} ${isConversationRoute ? "is-crm-conversation-route" : ""}`}>
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
