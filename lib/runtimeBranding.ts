import { isCRMPlusHashRoute, isCRMStandaloneHost } from "./crmRouting";

interface RuntimeBrandConfig {
  icon16: string;
  icon32: string;
  appleTouchIcon: string;
  manifest: string;
  themeColor: string;
  appName: string;
  appShortName: string;
  pageTitle?: string;
}

const DEFAULT_BRAND_CONFIG: RuntimeBrandConfig = {
  icon16: "/brand/favicon-16.png",
  icon32: "/brand/favicon-32.png",
  appleTouchIcon: "/brand/apple-touch-icon.png",
  manifest: "/app.webmanifest",
  themeColor: "#f5f7fb",
  appName: "iPhoneRepasse Pro",
  appShortName: "iPhoneRepasse",
};

const CRM_BRAND_CONFIG: RuntimeBrandConfig = {
  icon16: "/brand/crm/favicon-16.png",
  icon32: "/brand/crm/favicon-32.png",
  appleTouchIcon: "/brand/crm/apple-touch-icon.png",
  manifest: "/crm.webmanifest",
  themeColor: "#1d4ed8",
  appName: "CRM Plus iPhoneRepasse",
  appShortName: "CRM Plus",
  pageTitle: "CRM Plus | iPhoneRepasse",
};

const CRM_HASH_BRAND_CONFIG: RuntimeBrandConfig = {
  ...CRM_BRAND_CONFIG,
  manifest: "/crmplus.webmanifest",
};

function upsertLink(selector: string, attributes: Record<string, string>): void {
  const existing = Array.from(document.head.querySelectorAll<HTMLLinkElement>(selector));
  const link = existing[0] || document.createElement("link");

  Object.entries(attributes).forEach(([key, value]) => {
    link.setAttribute(key, value);
  });

  existing.slice(1).forEach((duplicate) => duplicate.remove());

  if (!existing.length) {
    document.head.appendChild(link);
  }
}

function upsertMeta(selector: string, attributes: Record<string, string>): void {
  const existing = Array.from(document.head.querySelectorAll<HTMLMetaElement>(selector));
  const meta = existing[0] || document.createElement("meta");

  Object.entries(attributes).forEach(([key, value]) => {
    meta.setAttribute(key, value);
  });

  existing.slice(1).forEach((duplicate) => duplicate.remove());

  if (!existing.length) {
    document.head.appendChild(meta);
  }
}

function resolveRuntimeBrandConfig(hostname: string, hash: string): RuntimeBrandConfig {
  if (isCRMStandaloneHost(hostname)) {
    return CRM_BRAND_CONFIG;
  }

  if (isCRMPlusHashRoute(hash)) {
    return CRM_HASH_BRAND_CONFIG;
  }

  return DEFAULT_BRAND_CONFIG;
}

export function applyRuntimeBranding(): void {
  if (typeof window === "undefined") return;

  const brand = resolveRuntimeBrandConfig(window.location.hostname, window.location.hash);

  upsertLink('link[rel="icon"][sizes="16x16"]', {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: brand.icon16,
  });

  upsertLink('link[rel="icon"][sizes="32x32"]', {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: brand.icon32,
  });

  upsertLink('link[rel="apple-touch-icon"]', {
    rel: "apple-touch-icon",
    sizes: "180x180",
    href: brand.appleTouchIcon,
  });

  upsertLink('link[rel="manifest"]', {
    rel: "manifest",
    href: brand.manifest,
  });

  upsertMeta('meta[name="theme-color"]', {
    name: "theme-color",
    content: brand.themeColor,
  });

  upsertMeta('meta[name="application-name"]', {
    name: "application-name",
    content: brand.appName,
  });

  upsertMeta('meta[name="apple-mobile-web-app-title"]', {
    name: "apple-mobile-web-app-title",
    content: brand.appShortName,
  });

  if (brand.pageTitle) {
    document.title = brand.pageTitle;
  }
}

export function bindRuntimeBranding(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const sync = () => applyRuntimeBranding();
  sync();

  window.addEventListener("hashchange", sync);
  window.addEventListener("popstate", sync);
  window.addEventListener("pageshow", sync);

  return () => {
    window.removeEventListener("hashchange", sync);
    window.removeEventListener("popstate", sync);
    window.removeEventListener("pageshow", sync);
  };
}
