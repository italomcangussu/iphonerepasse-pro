import React, { useState } from 'react';
import IOSButton from '../../../components/ui/IOSButton';
import { useToast } from '../../../components/ui/ToastProvider';
import { updateCareSettings } from '../../../services/careApi';
import type { CareSettings } from '../../../lib/care/careTypes';
import { DecimalField, TextField } from '../CareFields';

type NumericKey = 'otp_ttl_minutes' | 'otp_max_attempts' | 'otp_resend_cooldown_seconds' | 'otp_max_sends' | 'signature_link_ttl_hours' | 'suspension_grace_days';

const LIMITS: Array<{ key: NumericKey; label: string; suffix: string; min: number; max: number }> = [
  { key: 'otp_ttl_minutes', label: 'Validade do código', suffix: 'min', min: 1, max: 30 },
  { key: 'otp_max_attempts', label: 'Tentativas por código', suffix: 'x', min: 1, max: 10 },
  { key: 'otp_resend_cooldown_seconds', label: 'Espera para reenviar', suffix: 's', min: 0, max: 900 },
  { key: 'otp_max_sends', label: 'Envios de código por link', suffix: 'x', min: 1, max: 20 },
  { key: 'signature_link_ttl_hours', label: 'Validade do link', suffix: 'h', min: 1, max: 720 },
  { key: 'suspension_grace_days', label: 'Atraso que suspende', suffix: 'dias', min: 1, max: 60 },
];

// Só o que o administrador edita (a versão das cláusulas acompanha o código do contrato).
const editableSettings = (d: CareSettings): Partial<CareSettings> => ({
  contractor_legal_name: d.contractor_legal_name,
  contractor_cnpj: d.contractor_cnpj,
  contractor_address: d.contractor_address,
  default_services_description: d.default_services_description,
  default_usage_limits: d.default_usage_limits,
  privacy_contact: d.privacy_contact,
  preventive_checkup_months: d.preventive_checkup_months,
  ...Object.fromEntries(LIMITS.map((l) => [l.key, Number(d[l.key])])),
});

const CareSettingsSection: React.FC<{ settings: CareSettings; onSaved: () => void }> = ({ settings, onSaved }) => {
  const toast = useToast();
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const outOfRange = LIMITS.filter((l) => !(Number(draft[l.key]) >= l.min && Number(draft[l.key]) <= l.max));

  const save = async () => {
    setBusy(true);
    try {
      await updateCareSettings(editableSettings(draft));
      toast.success('Configurações do Repasse Care+ salvas.');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-bold app-text-primary">Contrato e assinatura</h3>
        <p className="text-sm app-text-muted">Identificação da contratada no PDF e regras do código de 6 dígitos. Cláusulas na versão {settings.clauses_version}.</p>
      </div>
      <div className="ios-card space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Razão social" value={draft.contractor_legal_name ?? ''} onChange={(v) => setDraft({ ...draft, contractor_legal_name: v || null })} hint="Vazio = nome do perfil da loja" />
          <TextField label="CNPJ" value={draft.contractor_cnpj ?? ''} onChange={(v) => setDraft({ ...draft, contractor_cnpj: v || null })} />
          <div className="sm:col-span-2">
            <TextField label="Endereço" value={draft.contractor_address ?? ''} onChange={(v) => setDraft({ ...draft, contractor_address: v || null })} />
          </div>
          <div className="sm:col-span-2">
            <TextField multiline label="Serviços contemplados (texto padrão)" value={draft.default_services_description ?? ''} onChange={(v) => setDraft({ ...draft, default_services_description: v || null })} hint="Lista fechada do que é feito. Usado quando a regra do aparelho não define a sua; sem ela, a contratação fica bloqueada." />
          </div>
          <div className="sm:col-span-2">
            <TextField label="Limites de utilização (texto padrão)" value={draft.default_usage_limits ?? ''} onChange={(v) => setDraft({ ...draft, default_usage_limits: v || null })} placeholder="Ex.: 1 troca de bateria e 1 troca de tela por vigência" hint="Obrigatório (aqui ou na regra do aparelho) para emitir contrato." />
          </div>
          <TextField label="Contato do encarregado de dados (LGPD)" value={draft.privacy_contact ?? ''} onChange={(v) => setDraft({ ...draft, privacy_contact: v || null })} placeholder="E-mail ou WhatsApp" />
          <DecimalField
            label="Check-up preventivo a cada"
            suffix="meses"
            maxDecimals={0}
            max={12}
            value={draft.preventive_checkup_months ? String(draft.preventive_checkup_months) : ''}
            onChange={(v) => setDraft({ ...draft, preventive_checkup_months: v ? Number(v) : null })}
            hint="Serviço entregue mesmo sem defeito; reforça que o plano é de serviço, não seguro. Vazio = não oferecido."
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {LIMITS.map((l) => (
            <DecimalField
              key={l.key}
              label={l.label}
              suffix={l.suffix}
              maxDecimals={0}
              value={String(draft[l.key] ?? '')}
              onChange={(v) => setDraft({ ...draft, [l.key]: Number(v || 0) })}
              error={outOfRange.includes(l) ? `De ${l.min} a ${l.max}` : null}
            />
          ))}
        </div>
        <div className="flex justify-end">
          <IOSButton variant="primary" type="button" loading={busy} disabled={outOfRange.length > 0} onClick={save}>Salvar configurações</IOSButton>
        </div>
      </div>
    </section>
  );
};

export default CareSettingsSection;
