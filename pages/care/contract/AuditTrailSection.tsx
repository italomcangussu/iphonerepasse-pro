import React from 'react';
import { signatureEventLabel } from '../../../lib/care/careLabels';
import type { CareSignatureEvent } from '../../../lib/care/careTypes';
import { Section } from './Section';

const fortaleza = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });

const geoText = (e: CareSignatureEvent): string | null => {
  if (e.geo_permission === 'concedida' && e.geo_lat != null) return `📍 ${e.geo_lat}, ${e.geo_lon}${e.geo_accuracy_m != null ? ` (±${e.geo_accuracy_m} m)` : ''}`;
  if (e.geo_permission === 'nao_compartilhada') return 'Localização não compartilhada';
  if (e.geo_permission === 'indisponivel') return 'Localização indisponível no aparelho';
  return null;
};

// Trilha append-only da assinatura; cada evento mostra hora do servidor (UTC e Fortaleza), origem e rede.
const AuditTrailSection: React.FC<{ events: CareSignatureEvent[] }> = ({ events }) => (
  <Section title="Trilha de auditoria">
    {events.length === 0 ? (
      <p className="text-sm app-text-muted">Sem eventos ainda.</p>
    ) : (
      <ol className="relative space-y-3 border-l border-gray-200 pl-4 dark:border-surface-dark-300">
        {events.map((e) => (
          <li key={e.id} className="space-y-0.5">
            <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden />
            <p className="text-sm font-semibold app-text-primary">{signatureEventLabel(e.event_type)}</p>
            <p className="text-xs app-text-muted">
              {fortaleza(e.occurred_at)} (Fortaleza) · {new Date(e.occurred_at).toISOString()} UTC · {e.source}
            </p>
            {(e.source_ip || e.whatsapp_message_id) && (
              <p className="text-xs app-text-muted">
                {e.source_ip ? `IP ${e.source_ip}` : ''}{e.source_ip && e.whatsapp_message_id ? ' · ' : ''}{e.whatsapp_message_id ? `msg ${e.whatsapp_message_id}` : ''}
              </p>
            )}
            {geoText(e) && <p className="text-xs app-text-muted">{geoText(e)}</p>}
            {e.user_agent && <p className="truncate text-xs app-text-muted" title={e.user_agent}>{e.user_agent}</p>}
            <p className="truncate font-mono text-xs app-text-muted" title={e.evidence_hash}>#{e.evidence_hash.slice(0, 16)}…</p>
          </li>
        ))}
      </ol>
    )}
  </Section>
);

export default AuditTrailSection;
