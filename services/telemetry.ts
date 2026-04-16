import type { UxEvent } from '../types';
import type { AppRole } from '../types';
import { supabase } from './supabase';

const MAX_BUFFER_SIZE = 200;
const uxEventsBuffer: UxEvent[] = [];
const DB_BATCH_LIMIT = 30;
const dbQueue: UxEvent[] = [];
let flushTimer: number | null = null;
let isFlushing = false;

const pushToBuffer = (event: UxEvent) => {
  uxEventsBuffer.push(event);
  if (uxEventsBuffer.length > MAX_BUFFER_SIZE) {
    uxEventsBuffer.shift();
  }
};

const resolveRoleOrNull = (value: unknown): AppRole | null => {
  if (value === 'admin' || value === 'manager' || value === 'seller') return value;
  return null;
};

const resolveCategory = (eventName: string): string => {
  const normalized = eventName.toLowerCase();
  if (normalized.includes('sale') || normalized.includes('pdv') || normalized.includes('venda')) return 'vendas';
  if (normalized.includes('debt') || normalized.includes('finance') || normalized.includes('transaction')) return 'financeiro';
  if (normalized.includes('remove') || normalized.includes('delete') || normalized.includes('cancel')) return 'cancelamentos';
  if (normalized.includes('inventory') || normalized.includes('stock') || normalized.includes('part') || normalized.includes('warranty')) return 'estoque';
  if (normalized.includes('navigation') || normalized.includes('route')) return 'navegacao';
  return 'outros';
};

const scheduleFlush = () => {
  if (typeof window === 'undefined') return;
  if (flushTimer !== null) return;

  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushDbQueue();
  }, 1200);
};

const flushDbQueue = async () => {
  if (isFlushing || dbQueue.length === 0) return;
  isFlushing = true;

  const batch = dbQueue.splice(0, DB_BATCH_LIMIT);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData.session?.user;
    if (!currentUser) return;

    const role =
      resolveRoleOrNull(currentUser.user_metadata?.app_role) ||
      resolveRoleOrNull(currentUser.app_metadata?.app_role) ||
      resolveRoleOrNull(currentUser.app_metadata?.role) ||
      'seller';

    const rows = batch.map((event) => ({
      user_id: currentUser.id,
      user_email: currentUser.email || null,
      app_role: event.role || role,
      category: resolveCategory(event.name),
      action: event.name,
      screen: event.screen,
      metadata: event.metadata || {},
      occurred_at: event.ts,
    }));

    const { error } = await supabase.from('app_user_activity_logs').insert(rows);
    if (error) {
      throw error;
    }
  } catch {
    // No-op: telemetry should never block user actions.
  } finally {
    isFlushing = false;
    if (dbQueue.length > 0) scheduleFlush();
  }
};

export const trackUxEvent = (event: UxEvent): void => {
  try {
    const normalizedEvent: UxEvent = {
      ...event,
      ts: event.ts || new Date().toISOString(),
    };
    pushToBuffer(normalizedEvent);
    dbQueue.push(normalizedEvent);
    if (dbQueue.length > MAX_BUFFER_SIZE) {
      dbQueue.shift();
    }
    scheduleFlush();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ux:event', { detail: normalizedEvent }));
    }
  } catch {
    // No-op: telemetry must never block business flows.
  }
};

export const getUxEventsSnapshot = (): UxEvent[] => [...uxEventsBuffer];
