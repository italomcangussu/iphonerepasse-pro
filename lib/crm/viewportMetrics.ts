type CRMViewportMetricsInput = {
  innerHeight: number;
  visualViewportHeight?: number | null;
  visualViewportOffsetTop?: number | null;
  activeElementTagName?: string | null;
  activeElementInputType?: string | null;
  activeElementIsContentEditable?: boolean;
};

type CRMViewportMetrics = {
  height: number;
  offsetTop: number;
  keyboardInset: number;
  isKeyboardOpen: boolean;
};

const KEYBOARD_INSET_THRESHOLD = 80;
const TEXT_INPUT_TYPES = new Set([
  "",
  "email",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "url",
]);

const hasEditableFocus = ({
  activeElementTagName,
  activeElementInputType,
  activeElementIsContentEditable,
}: CRMViewportMetricsInput): boolean => {
  if (activeElementIsContentEditable) return true;
  const tagName = String(activeElementTagName || "").toUpperCase();
  if (tagName === "TEXTAREA") return true;
  if (tagName !== "INPUT") return false;
  return TEXT_INPUT_TYPES.has(String(activeElementInputType || "").toLowerCase());
};

export const resolveCRMViewportMetrics = (input: CRMViewportMetricsInput): CRMViewportMetrics => {
  const innerHeight = Math.max(0, Math.round(input.innerHeight));
  const visualViewportHeight = Math.max(0, Math.round(input.visualViewportHeight ?? innerHeight));
  const visualViewportOffsetTop = Math.max(0, Math.round(input.visualViewportOffsetTop ?? 0));
  // Total area the keyboard removes from the layout viewport. We use the raw
  // shrink (innerHeight - visualViewport.height) instead of subtracting
  // offsetTop: on iOS the browser may *pan* the visual viewport (offsetTop > 0)
  // rather than only insetting from the bottom. The old bottom-inset formula
  // collapsed to ~0 under panning, so the keyboard went undetected and the
  // fixed chat surface was left where the pan had pushed it (off-screen).
  const occlusion = Math.max(0, innerHeight - visualViewportHeight);
  const isKeyboardOpen = hasEditableFocus(input) && occlusion > KEYBOARD_INSET_THRESHOLD;

  return {
    // Height + offsetTop describe the currently visible region in layout-viewport
    // coordinates: a surface placed at `top: offsetTop; height: height` maps onto
    // exactly the area the user can see, whether the keyboard insets from the
    // bottom (offsetTop 0) or iOS panned the viewport (offsetTop > 0).
    height: isKeyboardOpen ? visualViewportHeight : innerHeight,
    offsetTop: isKeyboardOpen ? visualViewportOffsetTop : 0,
    keyboardInset: isKeyboardOpen ? occlusion : 0,
    isKeyboardOpen,
  };
};
