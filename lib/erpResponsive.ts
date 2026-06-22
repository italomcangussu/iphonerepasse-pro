export const ERP_PHONE_MAX_WIDTH = 767;
export const ERP_TABLET_MIN_WIDTH = 768;
export const ERP_TABLET_MAX_WIDTH = 1279;
export const ERP_DESKTOP_MIN_WIDTH = 1280;
export const ERP_COMPACT_CONTENT_MAX_WIDTH = 1023;

export type ErpViewportClass = 'phone' | 'tablet' | 'desktop';

export const classifyErpViewport = (width: number): ErpViewportClass => {
  if (width <= ERP_PHONE_MAX_WIDTH) return 'phone';
  if (width <= ERP_TABLET_MAX_WIDTH) return 'tablet';
  return 'desktop';
};

export const isCompactOperationalViewport = (width: number): boolean =>
  width <= ERP_COMPACT_CONTENT_MAX_WIDTH;
