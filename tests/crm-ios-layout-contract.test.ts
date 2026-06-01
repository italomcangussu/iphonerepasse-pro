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
    expect(source).toContain("crm-mobile-composer-hint");
    expect(source).toContain('paddingBottom: "var(--crm-mobile-composer-height)"');
    expect(layout).toContain("is-crm-conversation-route");
    expect(css).toContain(".is-crm-conversation-route .crm-layout-header");
    expect(css).toContain(".is-crm-conversation-route .crm-conversation-shell");
    expect(css).toContain(".is-crm-conversation-route .crm-chat-list-panel");
    expect(css).toContain(".crm-mobile-composer-hint");
    expect(css).toContain("bottom: var(--crm-keyboard-inset)");
    expect(css).toContain("padding-bottom: var(--crm-mobile-composer-height)");
  });
});
