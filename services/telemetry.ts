import type { UxEvent } from '../types';

const MAX_BUFFER_SIZE = 200;
const uxEventsBuffer: UxEvent[] = [];

const pushToBuffer = (event: UxEvent) => {
  uxEventsBuffer.push(event);
  if (uxEventsBuffer.length > MAX_BUFFER_SIZE) {
    uxEventsBuffer.shift();
  }
};

export const trackUxEvent = (event: UxEvent): void => {
  try {
    pushToBuffer(event);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ux:event', { detail: event }));
    }
  } catch {
    // No-op: telemetry must never block business flows.
  }
};

export const getUxEventsSnapshot = (): UxEvent[] => [...uxEventsBuffer];
