import React from 'react';
import { Inbox } from 'lucide-react';
import Banner from '../../components/ui/Banner';

export const CareLoading: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div aria-busy aria-label="Carregando" className="space-y-3">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="h-16 rounded-ios-lg app-surface-soft animate-pulse" />)}
  </div>
);

export const CareLoadError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <Banner kind="error" title="Não carregou" message={message} action={{ label: 'Tentar de novo', onClick: onRetry }} />
);

export const CareEmpty: React.FC<{ title: string; message: string; action?: React.ReactNode }> = ({ title, message, action }) => (
  <div className="ios-card flex flex-col items-center gap-2 p-8 text-center">
    <Inbox size={32} className="app-text-muted" aria-hidden />
    <p className="font-semibold app-text-primary">{title}</p>
    <p className="max-w-sm text-sm app-text-muted">{message}</p>
    {action}
  </div>
);
