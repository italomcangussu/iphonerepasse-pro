// Geometry for the Combobox listbox.
//
// The listbox is portaled to <body> and placed with `position: absolute` in
// PAGE coordinates (client rect + scroll offset). `position: fixed` is not
// reliable here: while the iOS keyboard is open, Safari keeps fixed boxes
// anchored to the pre-scroll layout viewport, so a fixed listbox drifts away
// from its input by the amount the page scrolled and ends up on top of it.

const GAP = 4;
const EDGE = 8;
const COMFORTABLE_SPACE = 240;
const MIN_HEIGHT = 140;
const MAX_HEIGHT = 320;
const WIDE_ROW_WIDTH = 320;

interface ClientRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

interface VisibleArea {
  width: number;
  /** Top/bottom of what the user can actually see, in client coordinates. */
  top: number;
  bottom: number;
}

export interface ListboxPosition {
  left: number;
  width: number;
  /** Page y of the edge next to the trigger: the listbox top, or its bottom when `openUp`. */
  anchorTop: number;
  maxHeight: number;
  openUp: boolean;
}

interface ListboxGeometry {
  trigger: ClientRect;
  visible: VisibleArea;
  scroll: { x: number; y: number };
}

export const computeListboxPosition = ({ trigger, visible, scroll }: ListboxGeometry): ListboxPosition => {
  const spaceBelow = visible.bottom - trigger.bottom;
  const spaceAbove = trigger.top - visible.top;
  const openUp = spaceBelow < COMFORTABLE_SPACE && spaceAbove > spaceBelow;
  const available = (openUp ? spaceAbove : spaceBelow) - GAP - EDGE;

  // May grow wider than a narrow trigger so rich rows don't truncate, but
  // never leaves the viewport.
  const width = Math.max(trigger.width, Math.min(WIDE_ROW_WIDTH, visible.width - 2 * EDGE));
  const left = Math.min(trigger.left, Math.max(EDGE, visible.width - EDGE - width));

  return {
    left: left + scroll.x,
    width,
    anchorTop: openUp ? trigger.top + scroll.y - GAP : trigger.bottom + scroll.y + GAP,
    maxHeight: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, available)),
    openUp,
  };
};

/**
 * The part of the page the user can see, in client coordinates. With the
 * on-screen keyboard open the visual viewport excludes the keyboard, while
 * `window.innerHeight` still counts it.
 */
export const readVisibleArea = (): VisibleArea => {
  const vv = window.visualViewport;
  if (!vv) return { width: window.innerWidth, top: 0, bottom: window.innerHeight };
  const top = vv.pageTop - window.scrollY;
  return { width: window.innerWidth, top, bottom: top + vv.height };
};
