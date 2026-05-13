import { beforeEach, describe, expect, it } from "vitest";
import { applyRuntimeBranding } from "./runtimeBranding";

function manifestHref() {
  return document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.getAttribute("href");
}

describe("applyRuntimeBranding", () => {
  beforeEach(() => {
    document.head.innerHTML = `
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
    expect(document.title).toBe("CRM Plus | iPhoneRepasse");
  });
});
