import { describe, expect, it } from "vitest";
import { resolveCRMViewportMetrics } from "../lib/crm/viewportMetrics";

describe("resolveCRMViewportMetrics", () => {
  it("keeps the layout-viewport height when visualViewport is smaller but no editable field is focused", () => {
    const metrics = resolveCRMViewportMetrics({
      innerHeight: 844,
      innerWidth: 390,
      visualViewportHeight: 620,
      visualViewportOffsetTop: 0,
      activeElementTagName: "BODY",
      activeElementIsContentEditable: false,
    });

    // Focus is a release guard: a URL-bar collapse (no editable focus) must not
    // pin the shell to the keyboard rectangle.
    expect(metrics.height).toBe(844);
    expect(metrics.offsetTop).toBe(0);
    expect(metrics.keyboardInset).toBe(0);
    expect(metrics.isKeyboardOpen).toBe(false);
  });

  it("maps the shell onto the visual viewport while the keyboard is open", () => {
    const metrics = resolveCRMViewportMetrics({
      innerHeight: 844,
      innerWidth: 390,
      visualViewportHeight: 620,
      visualViewportWidth: 390,
      visualViewportOffsetTop: 0,
      activeElementTagName: "TEXTAREA",
      activeElementIsContentEditable: false,
    });

    // innerHeight does not shrink on iOS when the keyboard opens, so the shell
    // must follow the visual viewport to stay above the keyboard.
    expect(metrics.height).toBe(620);
    expect(metrics.width).toBe(390);
    expect(metrics.keyboardInset).toBe(224);
    expect(metrics.isKeyboardOpen).toBe(true);
  });

  it("detects the keyboard and maps the visible region even when iOS pans the viewport", () => {
    // iOS may pan the visual viewport (offsetTop > 0) instead of insetting from
    // the bottom. occlusion (inner - vv) stays correct, and the pin uses the
    // panned top so the surface lands exactly on the visible region.
    const metrics = resolveCRMViewportMetrics({
      innerHeight: 844,
      innerWidth: 390,
      visualViewportHeight: 520,
      visualViewportWidth: 390,
      visualViewportOffsetTop: 300,
      visualViewportOffsetLeft: 0,
      activeElementTagName: "TEXTAREA",
      activeElementIsContentEditable: false,
    });

    expect(metrics.isKeyboardOpen).toBe(true);
    expect(metrics.keyboardInset).toBe(324); // 844 - 520, robust to the pan
    expect(metrics.height).toBe(520); // visible height
    expect(metrics.offsetTop).toBe(300); // place the surface at the panned top
  });

  it("detects a pan-only resize where the visible height barely shrinks", () => {
    // A pan with negligible bottom inset collapses `occlusion` to ~0; the old
    // occlusion-only gate missed it entirely and left the shell at top:0 while
    // iOS had panned the content up (the "conversa em branco"). offsetTop alone
    // now triggers the pin.
    const metrics = resolveCRMViewportMetrics({
      innerHeight: 844,
      innerWidth: 390,
      visualViewportHeight: 824,
      visualViewportWidth: 390,
      visualViewportOffsetTop: 220,
      activeElementTagName: "TEXTAREA",
      activeElementIsContentEditable: false,
    });

    expect(metrics.isKeyboardOpen).toBe(true);
    expect(metrics.offsetTop).toBe(220);
    expect(metrics.height).toBe(824);
  });

  it("floors the closed-state shell height to screen.height on an installed iOS PWA", () => {
    // iOS standalone can report a URL-bar-sized visual viewport even when
    // launched from the home screen, leaving a dead band at the bottom. We floor
    // to the real WebView height (screen.height).
    const metrics = resolveCRMViewportMetrics({
      innerHeight: 800,
      innerWidth: 390,
      visualViewportHeight: 800,
      visualViewportOffsetTop: 0,
      screenHeight: 844,
      isIosStandalone: true,
      activeElementTagName: "BODY",
      activeElementIsContentEditable: false,
    });

    expect(metrics.isKeyboardOpen).toBe(false);
    expect(metrics.height).toBe(844);
  });

  it("floors a closed iOS WebKit mobile viewport when the reported height is short by the browser safe area", () => {
    // Some iOS WebKit/PWA states do not reliably report standalone, but still
    // expose a WebView-sized screen.height while innerHeight/visualViewport are
    // shorter by the reserved bottom browser area. With no editable focus and
    // no viewport pan, the CRM shell should fill the real screen height.
    const metrics = resolveCRMViewportMetrics({
      innerHeight: 894,
      innerWidth: 440,
      visualViewportHeight: 894,
      visualViewportWidth: 440,
      visualViewportOffsetTop: 0,
      screenHeight: 956,
      isIosWebKit: true,
      isIosStandalone: false,
      activeElementTagName: "BODY",
      activeElementIsContentEditable: false,
    });

    expect(metrics.isKeyboardOpen).toBe(false);
    expect(metrics.keyboardInset).toBe(0);
    expect(metrics.height).toBe(956);
  });

  it("does not floor a closed non-iOS viewport just because screen.height is taller", () => {
    const metrics = resolveCRMViewportMetrics({
      innerHeight: 894,
      innerWidth: 440,
      visualViewportHeight: 894,
      visualViewportWidth: 440,
      visualViewportOffsetTop: 0,
      screenHeight: 956,
      isIosWebKit: false,
      isIosStandalone: false,
      activeElementTagName: "BODY",
      activeElementIsContentEditable: false,
    });

    expect(metrics.isKeyboardOpen).toBe(false);
    expect(metrics.height).toBe(894);
  });
});
