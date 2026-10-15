import React from 'react';

export const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-bold uppercase tracking-wide app-text-muted">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

export const Field: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-ios-lg app-surface-soft px-3 py-2">
    <p className="text-xs app-text-muted">{label}</p>
    <p className="text-sm font-semibold app-text-primary tabular-nums">{value}</p>
    {hint && <p className="text-xs app-text-muted">{hint}</p>}
  </div>
);
