type CRMViewportMetricsInput = {
  innerHeight: number;
  innerWidth?: number | null;
  visualViewportHeight?: number | null;
  visualViewportWidth?: number | null;
  visualViewportOffsetTop?: number | null;
  visualViewportOffsetLeft?: number | null;
  screenHeight?: number | null;
  isIosWebKit?: boolean;
  isIosStandalone?: boolean;
  activeElementTagName?: string | null;
  activeElementInputType?: string | null;
  activeElementIsContentEditable?: boolean;
};

type CRMViewportMetrics = {
  // Height the inner content should fill: the shrunk visible region while the
  // keyboard is open, otherwise the full (floored) shell height.
  height: number;
  // Top-left of the visible region in layout-viewport coordinates. The fixed
  // shell is pinned here so it maps exactly onto the area above the keyboard,
  // whether iOS insets from the bottom (offsetTop 0) or pans (offsetTop > 0).
  offsetTop: number;
  offsetLeft: number;
  width: number;
  keyboardInset: number;
  isKeyboardOpen: boolean;
};

const KEYBOARD_INSET_THRESHOLD = 80;
const IOS_BROWSER_SAFE_AREA_SHORTFALL_MIN = 32;
const IOS_BROWSER_SAFE_AREA_SHORTFALL_MAX = 160;
const IOS_MOBILE_WIDTH_MAX = 540;
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
  const innerWidth = Math.max(0, Math.round(input.innerWidth ?? 0));
  const visualViewportHeight = Math.max(0, Math.round(input.visualViewportHeight ?? innerHeight));
  const visualViewportWidth = Math.max(0, Math.round(input.visualViewportWidth ?? innerWidth));
  const visualViewportOffsetTop = Math.max(0, Math.round(input.visualViewportOffsetTop ?? 0));
  const visualViewportOffsetLeft = Math.max(0, Math.round(input.visualViewportOffsetLeft ?? 0));
  const screenHeight = Math.max(0, Math.round(input.screenHeight ?? 0));

  // Total area the keyboard removes from the layout viewport. We use the raw
  // shrink (innerHeight - visualViewport.height) instead of subtracting
  // offsetTop: on iOS the browser may *pan* the visual viewport (offsetTop > 0)
  // rather than only insetting from the bottom.
  const occlusion = Math.max(0, innerHeight - visualViewportHeight);

  // Geometry says the keyboard is up when the visible viewport shrank OR iOS
  // panned it up. Mirroring the known-good iOS shell, we trigger on *either*
  // signal so a pan-only resize (occlusion ~0) is still caught.
  const keyboardGeometry =
    visualViewportOffsetTop > KEYBOARD_INSET_THRESHOLD || occlusion > KEYBOARD_INSET_THRESHOLD;

  // Focus is only a RELEASE guard, never the primary signal: a Safari URL-bar
  // collapse also shrinks the visual viewport, and when nothing editable is
  // focused the keyboard cannot be open. Requiring focus here also recovers
  // from the iOS 26 bug where visualViewport.offsetTop fails to reset on
  // dismiss — once focus leaves the field we always release the pin.
  const isKeyboardOpen = hasEditableFocus(input) && keyboardGeometry;

  // Closed-state height. On iOS WebKit/PWA, `100dvh`/visualViewport.height can
  // report the smaller URL-bar-visible value, leaving a dead band at the bottom.
  // screen.height is the real WebView height; we only floor to it for installed
  // iOS PWAs or for a narrow iOS mobile shortfall that matches the reserved
  // browser safe area. Everywhere else we keep the layout-viewport height
  // (innerHeight), preserving the prior shell sizing. When the keyboard is open
  // we instead use the shrunk visible height so content never hides behind it.
  const closedViewportHeight = Math.max(innerHeight, visualViewportHeight);
  const viewportShortfall = Math.max(0, screenHeight - closedViewportHeight);
  const shouldFloorClosedIosHeight =
    screenHeight > 0 &&
    !isKeyboardOpen &&
    (input.isIosStandalone ||
      (input.isIosWebKit &&
        innerWidth > 0 &&
        innerWidth <= IOS_MOBILE_WIDTH_MAX &&
        visualViewportOffsetTop === 0 &&
        viewportShortfall >= IOS_BROWSER_SAFE_AREA_SHORTFALL_MIN &&
        viewportShortfall <= IOS_BROWSER_SAFE_AREA_SHORTFALL_MAX));
  const flooredFullHeight = shouldFloorClosedIosHeight
    ? Math.max(innerHeight, visualViewportHeight, screenHeight)
    : innerHeight;

  return {
    height: isKeyboardOpen ? visualViewportHeight : flooredFullHeight,
    offsetTop: isKeyboardOpen ? visualViewportOffsetTop : 0,
    offsetLeft: isKeyboardOpen ? visualViewportOffsetLeft : 0,
    width: isKeyboardOpen ? visualViewportWidth : innerWidth,
    keyboardInset: isKeyboardOpen ? occlusion : 0,
    isKeyboardOpen,
  };
};
