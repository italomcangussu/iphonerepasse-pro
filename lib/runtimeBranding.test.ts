import { beforeEach, describe, expect, it } from "vitest";
import { applyRuntimeBranding } from "./runtimeBranding";

function manifestHref() {
  return document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.getAttribute("href");
}

function iconHref(size: string) {
  return document.head.querySelector<HTMLLinkElement>(`link[rel="icon"][sizes="${size}"]`)?.getAttribute("href");
}

function appleTouchIconHref() {
  return document.head.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.getAttribute("href");
}

function metaContent(name: string) {
  return document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.getAttribute("content");
}

describe("applyRuntimeBranding", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <link rel="icon" type="image/png" sizes="16x16" href="/brand/favicon-16.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon.png" />
      <link rel="manifest" href="/app.webmanifest" />
      <meta name="theme-color" content="#f5f7fb" />
      <meta name="apple-mobile-web-app-title" content="iPhoneRepasse" />
    `;
    document.title = "iPhoneRepasse Pro";
  });

  it("uses the app manifest by default for the main app PWA", () => {
    window.history.replaceState(null, "", "/#/inventory");

    applyRuntimeBranding();

    expect(manifestHref()).toBe("/app.webmanifest");
    expect(document.title).toBe("iPhoneRepasse Pro");
  });

  it("uses a path-specific CRM manifest when the app is opened through the crmplus hash route", () => {
    window.history.replaceState(null, "", "/#/crmplus");

    applyRuntimeBranding();

    expect(manifestHref()).toBe("/crmplus.webmanifest");
    expect(iconHref("16x16")).toBe("/brand/crm/favicon-16.png");
    expect(iconHref("32x32")).toBe("/brand/crm/favicon-32.png");
    expect(appleTouchIconHref()).toBe("/brand/crm/apple-touch-icon.png");
    expect(document.title).toBe("CRM Plus | iPhoneRepasse");
  });

  it("sets CRM Plus install metadata with a single canonical manifest", () => {
    document.head.insertAdjacentHTML(
      "beforeend",
      `
        <link rel="manifest" href="/stale.webmanifest" />
        <meta name="application-name" content="Stale App" />
        <meta name="theme-color" content="#000000" />
      `,
    );
    window.history.replaceState(null, "", "/#/crmplus");

    applyRuntimeBranding();

    const manifests = document.head.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]');
    const themeColors = document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');

    expect(manifests).toHaveLength(1);
    expect(manifestHref()).toBe("/crmplus.webmanifest");
    expect(metaContent("apple-mobile-web-app-title")).toBe("CRM Plus");
    expect(metaContent("application-name")).toBe("CRM Plus iPhoneRepasse");
    expect(themeColors).toHaveLength(1);
    expect(metaContent("theme-color")).toBe("#1d4ed8");
  });
});
