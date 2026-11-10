import React, { useCallback, useEffect, useState } from 'react';
import IOSButton from '../ui/IOSButton';
import { ROLE_LABELS } from '../../lib/permissions';
import { listShareableMembers, type ShareableMember, type TenantSummary } from '../../services/tenants';

type SharedMembersSectionProps = {
  company: TenantSummary;
  // Muda quando a lista de pessoas da empresa muda, para recarregar o status de cada um.
  version: number;
  busyKey: string | null;
  onShare: (members: ShareableMember[]) => void;
  onUnshare: (member: ShareableMember) => void;
};

const MUTED = 'text-ios-caption text-gray-500 dark:text-surface-dark-500';
const ROW_BUTTON = 'min-h-11 shrink-0 px-4 text-ios-subhead';

export const ALL = 'all';

export const shareableName = (member: ShareableMember) => member.display_name || member.email || 'Sem nome';

const useShareableMembers = (companyId: string, version: number) => {
  const [members, setMembers] = useState<ShareableMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMembers(await listShareableMembers(companyId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os funcionários.');
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load, version]);

  return { members, error, load };
};

type ShareRowProps = {
  member: ShareableMember;
  disabled: boolean;
  loading: boolean;
  onShare: () => void;
  onUnshare: () => void;
};

const ShareRow: React.FC<ShareRowProps> = ({ member, disabled, loading, onShare, onUnshare }) => (
  <li className="flex min-h-[60px] items-center gap-3 px-3 py-2">
    <div className="min-w-0 flex-1">
      <p className="truncate text-ios-subhead font-semibold text-gray-900 dark:text-white">{shareableName(member)}</p>
      <p className={`truncate ${MUTED}`}>{ROLE_LABELS[member.role]} na iPhone Repasse</p>
    </div>
    {member.access === 'member' && <span className={`shrink-0 ${MUTED}`}>Já tem acesso</span>}
    {member.access === 'shared' && (
      <IOSButton variant="secondary" className={ROW_BUTTON} onClick={onUnshare} disabled={disabled} loading={loading} aria-label={`Tirar ${shareableName(member)}`}>
        Tirar
      </IOSButton>
    )}
    {member.access === null && (
      <IOSButton className={ROW_BUTTON} onClick={onShare} disabled={disabled} loading={loading} aria-label={`Liberar ${shareableName(member)}`}>
        Liberar
      </IOSButton>
    )}
  </li>
);

type ShareListProps = {
  members: ShareableMember[] | null;
  error: string | null;
  busyKey: string | null;
  onRetry: () => void;
  onShare: (members: ShareableMember[]) => void;
  onUnshare: (member: ShareableMember) => void;
};

const ShareList: React.FC<ShareListProps> = ({ members, error, busyKey, onRetry, onShare, onUnshare }) => {
  if (error) {
    return (
      <p className="rounded-ios-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/10 dark:text-red-300">
        {error}{' '}
        <button type="button" onClick={onRetry} className="min-h-11 font-semibold underline">
          Tentar de novo
        </button>
      </p>
    );
  }
  if (members === null) return <p className={MUTED}>Carregando…</p>;
  if (members.length === 0) return <p className={MUTED}>A iPhone Repasse ainda não tem funcionários.</p>;

  return (
    <ul className="divide-y divide-gray-100 rounded-ios-lg border border-gray-200 dark:divide-surface-dark-300 dark:border-surface-dark-300">
      {members.map((member) => (
        <ShareRow
          key={member.user_id}
          member={member}
          disabled={busyKey !== null}
          loading={busyKey === member.user_id}
          onShare={() => onShare([member])}
          onUnshare={() => onUnshare(member)}
        />
      ))}
    </ul>
  );
};

const SharedMembersSection: React.FC<SharedMembersSectionProps> = ({ company, version, busyKey, onShare, onUnshare }) => {
  const { members, error, load } = useShareableMembers(company.id, version);
  const withoutAccess = (members ?? []).filter((member) => member.access === null);

  return (
    <section aria-labelledby="shared-members-title" className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 id="shared-members-title" className="text-ios-caption font-bold uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
            Funcionários da iPhone Repasse
          </h3>
          <p className={`mt-0.5 ${MUTED}`}>
            Quem você liberar vê a {company.name} no seletor do topo, com o mesmo papel que tem na iPhone Repasse.
          </p>
        </div>
        {withoutAccess.length > 1 && (
          <IOSButton variant="secondary" className={ROW_BUTTON} onClick={() => onShare(withoutAccess)} disabled={busyKey !== null} loading={busyKey === ALL}>
            Liberar todos
          </IOSButton>
        )}
      </div>

      <ShareList members={members} error={error} busyKey={busyKey} onRetry={() => void load()} onShare={onShare} onUnshare={onUnshare} />
    </section>
  );
};

export default SharedMembersSection;
