export function newId(prefix: string): string {
  // Prefer stable UUIDs in modern browsers; fall back to timestamp+random for older environments.
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch {
    // ignore
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

