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
  const rawKeyboardInset = Math.max(0, Math.round(innerHeight - visualViewportHeight - visualViewportOffsetTop));
  const isKeyboardOpen = hasEditableFocus(input) && rawKeyboardInset > KEYBOARD_INSET_THRESHOLD;

  return {
    // While the keyboard is open on iOS, window.innerHeight stays at the full
    // screen height (it does not shrink), so we must fall back to the visual
    // viewport height to size the shell to the area that is actually visible
    // above the keyboard. Outside the keyboard-open state we keep innerHeight to
    // avoid shrinking the shell when Safari merely collapses its toolbars.
    height: isKeyboardOpen ? visualViewportHeight : innerHeight,
    offsetTop: isKeyboardOpen ? visualViewportOffsetTop : 0,
    keyboardInset: isKeyboardOpen ? rawKeyboardInset : 0,
    isKeyboardOpen,
  };
};
