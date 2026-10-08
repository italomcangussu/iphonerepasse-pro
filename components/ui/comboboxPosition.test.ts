import { afterEach, describe, expect, it } from 'vitest';
import { computeListboxPosition, readVisibleArea } from './comboboxPosition';

const trigger = { top: 178, bottom: 226, left: 16, width: 280 };

describe('computeListboxPosition', () => {
  it('anchors below the trigger in page coordinates', () => {
    const pos = computeListboxPosition({
      trigger,
      visible: { width: 402, top: 0, bottom: 714 },
      scroll: { x: 0, y: 214 },
    });

    expect(pos.openUp).toBe(false);
    // client bottom (226) + scrollY (214) + gap (4): page y, not client y
    expect(pos.anchorTop).toBe(444);
  });

  it('fits the space above the on-screen keyboard, not the full window height', () => {
    // iOS keyboard open: innerHeight still counts the keyboard, the visual viewport does not.
    const pos = computeListboxPosition({
      trigger,
      visible: { width: 402, top: 0, bottom: 404 },
      scroll: { x: 0, y: 214 },
    });

    expect(pos.openUp).toBe(false);
    expect(pos.maxHeight).toBe(404 - 226 - 4 - 8);
  });

  it('opens upward when the visible area below is short and above is larger', () => {
    const pos = computeListboxPosition({
      trigger: { top: 600, bottom: 648, left: 16, width: 280 },
      visible: { width: 402, top: 0, bottom: 714 },
      scroll: { x: 0, y: 100 },
    });

    expect(pos.openUp).toBe(true);
    // the anchor is the listbox bottom edge: trigger top + scrollY - gap
    expect(pos.anchorTop).toBe(696);
  });

  it('never makes the list shorter than the minimum, even with little room', () => {
    const pos = computeListboxPosition({
      trigger: { top: 40, bottom: 88, left: 16, width: 280 },
      visible: { width: 402, top: 0, bottom: 200 },
      scroll: { x: 0, y: 0 },
    });

    expect(pos.maxHeight).toBe(140);
  });

  it('widens a narrow trigger and keeps the list inside the viewport', () => {
    const pos = computeListboxPosition({
      trigger: { top: 100, bottom: 148, left: 300, width: 80 },
      visible: { width: 390, top: 0, bottom: 800 },
      scroll: { x: 5, y: 0 },
    });

    expect(pos.width).toBe(320);
    // clamped left (390 - 8 - 320 = 62) plus horizontal scroll
    expect(pos.left).toBe(67);
  });
});

describe('readVisibleArea', () => {
  const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');

  afterEach(() => {
    if (originalVisualViewport) {
      Object.defineProperty(window, 'visualViewport', originalVisualViewport);
    } else {
      Reflect.deleteProperty(window, 'visualViewport');
    }
  });

  it('falls back to the window size without a visual viewport', () => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });

    expect(readVisibleArea()).toEqual({
      width: window.innerWidth,
      top: 0,
      bottom: window.innerHeight,
    });
  });

  it('uses the visual viewport so the keyboard is excluded', () => {
    Object.defineProperty(window, 'visualViewport', {
      value: { pageTop: 214, height: 404 },
      configurable: true,
    });
    Object.defineProperty(window, 'scrollY', { value: 214, configurable: true });

    expect(readVisibleArea()).toMatchObject({ top: 0, bottom: 404 });

    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });
});
