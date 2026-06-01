import { describe, expect, it } from "vitest";
import { resolveCRMViewportMetrics } from "../lib/crm/viewportMetrics";

describe("resolveCRMViewportMetrics", () => {
  it("keeps the full window height when visualViewport is smaller but no editable field is focused", () => {
    const metrics = resolveCRMViewportMetrics({
      innerHeight: 844,
      visualViewportHeight: 620,
      visualViewportOffsetTop: 0,
      activeElementTagName: "BODY",
      activeElementIsContentEditable: false,
    });

    expect(metrics.height).toBe(844);
    expect(metrics.keyboardInset).toBe(0);
    expect(metrics.isKeyboardOpen).toBe(false);
  });

  it("shrinks the CRM shell to the visual viewport while the keyboard is open", () => {
    const metrics = resolveCRMViewportMetrics({
      innerHeight: 844,
      visualViewportHeight: 620,
      visualViewportOffsetTop: 0,
      activeElementTagName: "TEXTAREA",
      activeElementIsContentEditable: false,
    });

    // innerHeight does not shrink on iOS when the keyboard opens, so the shell
    // must follow the visual viewport to stay above the keyboard.
    expect(metrics.height).toBe(620);
    expect(metrics.keyboardInset).toBe(224);
    expect(metrics.isKeyboardOpen).toBe(true);
  });
});
