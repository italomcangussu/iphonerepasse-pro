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
  // persisted to localStorage so it survives reloads / PWA relaunches. Inside an
  // installed PWA the URL flag can't be set (separate storage + fixed start_url),
  // so it can also be toggled by 5 quick taps on a hidden top-left hotspot.
  const [showViewportDebug, setShowViewportDebug] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const haystack = `${window.location.search} ${window.location.hash}`;
      if (/[?&]kbdebug=1\b/.test(haystack)) window.localStorage.setItem("crmkbdebug", "1");
      else if (/[?&]kbdebug=0\b/.test(haystack)) window.localStorage.removeItem("crmkbdebug");
      return window.localStorage.getItem("crmkbdebug") === "1";
    } catch {
      return false;
    }
  });
  const debugTapsRef = React.useRef<{ count: number; last: number }>({ count: 0, last: 0 });
  // Document-scroll chat shell (DEFAULT ON): lets iOS Safari collapse its
  // toolbar into a floating overlay. We skip the body pin + visual-viewport
  // shell pinning and let the document scroll (see `body.crm-docscroll`
  // overrides in index.css); keyboard handling relies on
  // `interactive-widget=resizes-content` + a sticky composer. Validated on
  // device. `?docscroll=0` is an emergency opt-out that restores the legacy
  // fixed-shell + JS keyboard pinning (persisted to localStorage like
  // `?kbdebug`); `?docscroll=1` clears the opt-out.
  const [docScrollEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const haystack = `${window.location.search} ${window.location.hash}`;
      if (/[?&]docscroll=0\b/.test(haystack)) window.localStorage.setItem("crmdocscroll", "0");
      else if (/[?&]docscroll=1\b/.test(haystack)) window.localStorage.removeItem("crmdocscroll");
      return window.localStorage.getItem("crmdocscroll") !== "0";
    } catch {
      return true;
    }
  });
  const handleDebugHotspot = () => {
    const now = Date.now();
    const taps = debugTapsRef.current;
    taps.count = now - taps.last < 600 ? taps.count + 1 : 1;
    taps.last = now;
    if (taps.count < 5) return;
    taps.count = 0;
    setShowViewportDebug((prev) => {
      const next = !prev;
      try {
        if (next) window.localStorage.setItem("crmkbdebug", "1");
        else window.localStorage.removeItem("crmkbdebug");
      } catch {
        /* ignore */
      }
      return next;
    });
  };
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
  const isConversationRoute = activePath === "/" || activePath.startsWith("/conversations/");
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
    if (typeof document === "undefined") return undefined;
    // Pin the document while the CRM shell is mounted (known-good iOS shell):
    // prevents the page from scrolling/panning under the keyboard. The fixed
    // .crm-plus-theme handles visible sizing.
    // EXPERIMENT: in document-scroll mode we deliberately do NOT pin the body —
    // the document must scroll for Safari to overlay its toolbar.
    const lockClass = docScrollEnabled ? "crm-docscroll" : "crm-standalone-locked";
    document.body.classList.add(lockClass);
    return () => document.body.classList.remove(lockClass);
  }, [docScrollEnabled]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;
    // EXPERIMENT: document-scroll mode opts out of the fixed-shell + keyboard
    // pinning entirely. The layout viewport resizes for the keyboard via
    // `interactive-widget=resizes-content` and the composer is sticky, so none
    // of the visual-viewport bookkeeping below should run.
    if (docScrollEnabled) return undefined;

    const root = document.documentElement;
    let frame = 0;
    const settleTimers: number[] = [];

    const iosRuntime = (() => {
      const ua = window.navigator.userAgent;
      const isIosWebKit =
        /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
      const nav = window.navigator as Navigator & { standalone?: boolean };
      const standalone =
        nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
      return {
        isIosWebKit,
        isIosStandalone: isIosWebKit && standalone,
      };
    })();

    const getShell = () => document.querySelector<HTMLElement>(".crm-plus-theme");

    const getViewportVarTargets = () =>
      [root, getShell()].filter((target): target is HTMLElement => Boolean(target));

    const setViewportVar = (name: string, value: string) => {
      getViewportVarTargets().forEach((target) => target.style.setProperty(name, value));
    };

    const removeViewportVar = (name: string) => {
      getViewportVarTargets().forEach((target) => target.style.removeProperty(name));
    };

    // Pin the fixed shell onto the visual-viewport rectangle while the keyboard
    // is open (top/left/width/height in px), mirroring the known-good iOS shell.
    // iOS does not resize the *layout* viewport for the keyboard — it shrinks
    // (and may pan) the *visual* viewport — so we map the shell directly onto
    // the region the user can actually see above the keyboard. When closed we
    // clear the inline box and let the CSS (top:0; inset; height var) drive it.
    const pinShellToVisibleArea = (top: number, left: number, width: number, height: number) => {
      const shell = getShell();
      if (!shell) return;
      shell.style.top = `${top}px`;
      shell.style.left = `${left}px`;
      shell.style.right = "auto";
      shell.style.bottom = "auto";
      shell.style.width = `${width}px`;
      shell.style.height = `${height}px`;
    };

    const releaseShell = () => {
      const shell = getShell();
      if (!shell) return;
      shell.style.removeProperty("top");
      shell.style.removeProperty("left");
      shell.style.removeProperty("right");
      shell.style.removeProperty("bottom");
      shell.style.removeProperty("width");
      shell.style.removeProperty("height");
      // iOS can leave the document scrolled after a keyboard dismiss, which
      // reveals the Safari URL bar. The body is pinned, so this is a no-op in
      // the normal case, but it guards the edge where a stray scroll lingers.
      if (window.scrollY > 0 || window.pageYOffset > 0) {
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      }
    };

    const measure = () => {
      const viewport = window.visualViewport;
      const activeElement = document.activeElement as HTMLElement | null;
      const metrics = resolveCRMViewportMetrics({
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        visualViewportHeight: viewport?.height,
        visualViewportWidth: viewport?.width,
        visualViewportOffsetTop: viewport?.offsetTop,
        visualViewportOffsetLeft: viewport?.offsetLeft,
        screenHeight: window.screen?.height,
        isIosWebKit: iosRuntime.isIosWebKit,
        isIosStandalone: iosRuntime.isIosStandalone,
        activeElementTagName: activeElement?.tagName,
        activeElementInputType: activeElement instanceof HTMLInputElement ? activeElement.type : null,
        activeElementIsContentEditable: activeElement?.isContentEditable,
      });

      setViewportVar("--crm-visual-viewport-height", `${metrics.height}px`);
      setViewportVar("--crm-keyboard-inset", `${metrics.keyboardInset}px`);
      root.classList.toggle("is-crm-keyboard-open", metrics.isKeyboardOpen);

      if (metrics.isKeyboardOpen) {
        pinShellToVisibleArea(metrics.offsetTop, metrics.offsetLeft, metrics.width, metrics.height);
      } else {
        releaseShell();
      }

      const debugEl = viewportDebugRef.current;
      if (debugEl) {
        const shell = document.querySelector<HTMLElement>(".crm-conversation-shell.is-mobile-thread-open");
        const shellH = shell ? Math.round(shell.getBoundingClientRect().height) : -1;
        const theme = getShell();
        const themeH = theme ? Math.round(theme.getBoundingClientRect().height) : -1;
        debugEl.textContent =
          `build=kb16 ios=${iosRuntime.isIosWebKit ? 1 : 0} std=${iosRuntime.isIosStandalone ? 1 : 0} ` +
          `scr=${Math.round(window.screen?.height ?? -1)} dpr=${window.devicePixelRatio} ` +
          `inner=${Math.round(window.innerHeight)} vv=${Math.round(viewport?.height ?? -1)} ` +
          `off=${Math.round(viewport?.offsetTop ?? -1)} occ=${metrics.keyboardInset} ` +
          `kbOpen=${metrics.isKeyboardOpen ? 1 : 0} h=${metrics.height} top=${metrics.offsetTop} ` +
          `pt=${themeH} shell=${shellH} scrollY=${Math.round(window.scrollY)} focus=${(activeElement?.tagName || "-").toLowerCase()}`;
      }
    };

    const updateViewportVars = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
      // Re-measure after the keyboard finishes animating. iOS fires viewport
      // events mid-animation and only settles the final geometry (height +
      // offsetTop) ~300ms later; reading once latched onto a transient value, so
      // the layout oscillated between correct and wrong on each open/close in the
      // installed PWA. Sampling the settled state makes it deterministic.
      settleTimers.forEach((t) => window.clearTimeout(t));
      settleTimers.length = 0;
      [120, 280, 480].forEach((delay) => {
        settleTimers.push(window.setTimeout(() => window.requestAnimationFrame(measure), delay));
      });
    };

    updateViewportVars();
    window.visualViewport?.addEventListener("resize", updateViewportVars);
    window.visualViewport?.addEventListener("scroll", updateViewportVars);
    window.addEventListener("resize", updateViewportVars);
    window.addEventListener("orientationchange", updateViewportVars);
    window.addEventListener("pageshow", updateViewportVars);
    // Losing focus on the editable field dismisses the keyboard; re-measure so
    // we release the pin promptly even if visualViewport.offsetTop is slow (or,
    // on iOS 26, fails) to reset to 0.
    window.addEventListener("focusout", updateViewportVars);

    return () => {
      window.cancelAnimationFrame(frame);
      settleTimers.forEach((t) => window.clearTimeout(t));
      window.visualViewport?.removeEventListener("resize", updateViewportVars);
      window.visualViewport?.removeEventListener("scroll", updateViewportVars);
      window.removeEventListener("resize", updateViewportVars);
      window.removeEventListener("orientationchange", updateViewportVars);
      window.removeEventListener("pageshow", updateViewportVars);
      window.removeEventListener("focusout", updateViewportVars);
      root.classList.remove("is-crm-keyboard-open");
      releaseShell();
      removeViewportVar("--crm-visual-viewport-height");
      removeViewportVar("--crm-keyboard-inset");
    };
  }, [docScrollEnabled]);

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
    <div className="crm-plus-theme">
      {/* Hidden diagnostic hotspot: 5 quick taps toggle the viewport debug
          overlay. Lets us read the live metrics inside an installed PWA where
          the ?kbdebug URL flag isn't reachable. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={handleDebugHotspot}
        style={{
          // Sit inside the status-bar strip (above the header controls) so it
          // never intercepts the back/menu buttons.
          position: "fixed",
          top: 0,
          left: 0,
          width: 72,
          height: 40,
          zIndex: 10000,
          background: "transparent",
          border: 0,
          padding: 0,
          opacity: 0,
        }}
      />
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
            <div className="crm-brand-lockup">
              <BrandLogo variant="full" className="h-12 w-auto object-contain" />
              <div>
                <p className="crm-brand-title">CRM Plus</p>
                <p className="crm-brand-subtitle">iPhoneRepasse</p>
              </div>
            </div>
            <button
              type="button"
              className="crm-sidebar-icon-toggle"
              onClick={() => setIsSidebarHidden(true)}
              aria-label="Ocultar menu lateral"
              title="Ocultar menu"
            >
              <X size={17} />
            </button>
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
