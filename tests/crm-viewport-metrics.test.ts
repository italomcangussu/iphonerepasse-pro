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

  it("does not shrink the CRM shell while the keyboard is open", () => {
    const metrics = resolveCRMViewportMetrics({
      innerHeight: 844,
      visualViewportHeight: 620,
      visualViewportOffsetTop: 0,
      activeElementTagName: "TEXTAREA",
      activeElementIsContentEditable: false,
    });

    expect(metrics.height).toBe(844);
    expect(metrics.keyboardInset).toBe(224);
    expect(metrics.isKeyboardOpen).toBe(true);
  });
});
