import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("CRM iOS layout contract", () => {
  it("uses visualViewport-driven sizing for the CRM shell", () => {
    const layout = read("components/crm/CRMStandaloneLayout.tsx");
    const css = read("index.css");
    const html = read("index.html");

    expect(layout).toContain("visualViewport");
    expect(css).toContain("--crm-visual-viewport-height");
    expect(css).toContain("--crm-keyboard-inset");
    expect(css).toContain("touch-action: pan-y");
    expect(html).toContain("user-scalable=no");
    expect(html).toContain("maximum-scale=1");
  });

  it("keeps the conversation surface inside the mobile viewport without sticky composer gaps", () => {
    const source = read("pages/crm/ConversationsPage.tsx");
    const layout = read("components/crm/CRMStandaloneLayout.tsx");
    const css = read("index.css");

    expect(source).not.toContain("calc(100dvh - 88px)");
    expect(source).not.toContain("sticky bottom-0");
    expect(source).toContain("crm-conversation-shell");
    expect(source).toContain("crm-conversation-composer");
    expect(source).toContain("composerRef");
    expect(source).toContain("ResizeObserver");
    expect(source).toContain("crm-mobile-composer-hint");
    expect(source).toContain('paddingBottom: "var(--crm-mobile-composer-obstruction-height)"');
    expect(source).toContain("mt-auto");
    expect(layout).toContain("is-crm-conversation-route");
    expect(css).toContain(".is-crm-conversation-route .crm-layout-header");
    expect(css).toContain(".is-crm-conversation-route .crm-conversation-shell");
    expect(css).toContain(".is-crm-conversation-route .crm-chat-list-panel");
    expect(css).toContain(".crm-mobile-composer-hint");
    // Standalone PWA keeps bottom:0 (iOS auto-lifts it above the keyboard); the
    // manual keyboard-inset lift is gated to non-standalone contexts only.
    expect(css).toContain("bottom: 0");
    expect(css).toContain("@media (display-mode: browser)");
    expect(css).toContain("bottom: calc(var(--crm-keyboard-inset) + var(--crm-visual-viewport-offset-top))");
    expect(css).toContain("--crm-mobile-composer-gap");
    expect(css).toContain("--crm-mobile-composer-obstruction-height: calc(var(--crm-mobile-composer-height) + var(--crm-keyboard-inset) + var(--crm-mobile-composer-gap))");
    expect(css).toContain("scroll-padding-bottom: var(--crm-mobile-composer-obstruction-height)");
    expect(css).toContain("padding-bottom: var(--crm-mobile-composer-obstruction-height)");
  });

  it("keeps CRM mobile chrome inside iOS safe areas with 44px tap targets", () => {
    const css = read("index.css");

    expect(css).toContain("--crm-ios-hit-target: 44px");
    expect(css).toContain("padding-top: max(0.5rem, env(safe-area-inset-top, 0px))");
    expect(css).toContain("min-height: var(--crm-ios-hit-target)");
    expect(css).toContain("min-width: var(--crm-ios-hit-target)");
    expect(css).toContain(".crm-mobile-filter-chip");
    expect(css).toContain(".crm-mobile-sheet-action");
    expect(css).toContain("font-size: 11px");
  });

  it("uses native mobile list alternatives instead of wide tables for CRM admin data", () => {
    const crud = read("components/crm/CRMSimpleCrud.tsx");
    const ads = read("pages/crm/AdsPage.tsx");
    const cashback = read("pages/crm/CashbackPage.tsx");

    expect(crud).toContain("crm-mobile-data-list");
    expect(crud).toContain("crm-desktop-data-table");
    expect(ads).toContain("crm-mobile-data-list");
    expect(ads).toContain("crm-desktop-data-table");
    expect(cashback).toContain("crm-mobile-data-list");
    expect(cashback).toContain("crm-desktop-data-table");
  });
});
