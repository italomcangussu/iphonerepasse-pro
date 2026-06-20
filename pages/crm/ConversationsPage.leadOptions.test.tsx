import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('pages/crm/ConversationsPage.tsx', 'utf8');

describe('ConversationsPage lead options bottom sheet layout', () => {
  it('imports createPortal from react-dom', () => {
    expect(source).toMatch(/import\s*\{\s*createPortal\s*\}\s*from\s*["']react-dom["']/);
  });

  it('portals the mobile lead-options sheet to document.body', () => {
    // The conversation header uses `liquid-glass-strong` (backdrop-filter),
    // which makes it the containing block for any position:fixed descendant.
    // Rendering the bottom sheet inside it anchored the `bottom-0` sheet to the
    // header at the top of the screen, so it slid up into the non-visible area.
    // Portaling to <body> restores viewport-relative positioning.
    const portalMatch = source.match(/createPortal\(([\s\S]*?),\s*document\.body,?\s*\)/);
    expect(portalMatch, 'expected a createPortal(..., document.body) call').not.toBeNull();

    const portaledMarkup = portalMatch![1];
    // The portaled subtree must be the mobile lead-options bottom sheet.
    expect(portaledMarkup).toContain('Opções do Lead');
    expect(portaledMarkup).toContain('fixed inset-x-0 bottom-0');
  });

  it('keeps the desktop dropdown anchored to the trigger (not portaled)', () => {
    // The desktop menu is absolutely positioned relative to the trigger wrapper,
    // so it must stay inline (inside leadOptionsRef) for the outside-click guard.
    expect(source).toContain('!isMobileViewport && (');
    expect(source).toContain('absolute right-0 top-full');
  });

  it('disables the outside-click guard on mobile where the portaled sheet has its own backdrop', () => {
    expect(source).toContain('if (!isLeadOptionsOpen || isMobileViewport) return undefined;');
  });
});
