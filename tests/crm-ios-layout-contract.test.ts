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
    const messagesPanel = read("components/crm/ConversationMessagesPanel.tsx");
    const layout = read("components/crm/CRMStandaloneLayout.tsx");
    const css = read("index.css");

    expect(source).not.toContain("calc(100dvh - 88px)");
    expect(source).not.toContain("sticky bottom-0");
    expect(source).toContain("crm-conversation-shell");
    expect(source).toContain("crm-conversation-composer");
    expect(source).toContain("composerRef");
    expect(source).toContain("ResizeObserver");
    expect(source).toContain("crm-mobile-composer-hint");
    expect(messagesPanel).toContain('paddingBottom: "var(--crm-mobile-composer-obstruction-height)"');
    expect(messagesPanel).toContain("mt-auto");
    expect(layout).toContain("is-crm-conversation-route");
    expect(css).toContain(".is-crm-conversation-route .crm-layout-header");
    expect(css).toContain(".is-crm-conversation-route .crm-conversation-shell");
    expect(css).toContain(".is-crm-conversation-route .crm-chat-list-panel");
    expect(css).toContain(".crm-mobile-composer-hint");
    // iOS shell: the ONLY pinned element is the fixed .crm-plus-theme; the
    // conversation fills it in normal flow (it must NOT itself be position:fixed).
    // iOS does not resize the layout viewport for the keyboard — it shrinks the
    // visual viewport and may PAN it (visualViewport.offsetTop > 0). While the
    // keyboard is open the layout JS pins the fixed shell onto the visual-
    // viewport rectangle (top/left/width/height in px); when closed it clears the
    // inline box and falls back to the CSS height var.
    expect(css).toContain(".crm-conversation-shell.is-mobile-thread-open {");
    expect(css).toContain("height: var(--crm-visual-viewport-height)");
    expect(layout).toContain("pinShellToVisibleArea");
    expect(layout).toContain("releaseShell");
    expect(layout).toContain("isIosStandalone");
    // The old transform/offset-var hack is gone — the shell is pinned via inline
    // top/left/width/height instead.
    expect(css).not.toContain("--crm-visual-viewport-offset-top");
    // <body> is pinned while the CRM shell is mounted so iOS cannot scroll/pan
    // the document under the keyboard.
    expect(css).toContain("body.crm-standalone-locked");
    const layoutSrc = read("components/crm/CRMStandaloneLayout.tsx");
    expect(layoutSrc).toContain("crm-standalone-locked");
    expect(css).toContain("--crm-mobile-composer-gap");
    expect(css).toContain("body.crm-standalone-locked");
    expect(css).toContain("bottom: 0;");
    expect(css).toContain("background: var(--ds-color-surface);");
    expect(css).not.toContain("padding-bottom: max(env(safe-area-inset-bottom, 0px) - var(--crm-keyboard-inset), 0px)");
    expect(css).toContain(".crm-conversation-shell.is-mobile-thread-open .crm-conversation-composer {\n      padding-bottom: calc(0.35rem + max(env(safe-area-inset-bottom, 0px) - var(--crm-keyboard-inset), 0px))");
    expect(css).not.toContain(".crm-conversation-shell.is-mobile-thread-open .crm-conversation-composer::after");
    // The composer is in normal flow now, so the message obstruction is just a
    // small breathing gap — it must not re-add the composer height or keyboard
    // inset, or the thread would show an empty band and look blank.
    expect(css).toContain("--crm-mobile-composer-obstruction-height: var(--crm-mobile-composer-gap)");
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
