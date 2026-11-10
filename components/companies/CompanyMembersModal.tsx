import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/ToastProvider';
import { useAsyncHandler } from '../../hooks/useAsyncHandler';
import { ROLE_LABELS } from '../../lib/permissions';
import type { AppRole } from '../../types';
import {
  addTenantMember,
  listTenantMembers,
  removeTenantMember,
  shareTenantMembers,
  type ShareableMember,
  type TenantMember,
  type TenantSummary,
} from '../../services/tenants';
import AddMemberForm from './AddMemberForm';
import MemberRow, { memberName } from './MemberRow';
import SharedMembersSection, { ALL, shareableName } from './SharedMembersSection';

type CompanyMembersModalProps = {
  company: TenantSummary | null;
  currentUserId: string | null;
  // Só quem administra a iPhone Repasse pode liberar os funcionários dela.
  canShareFromPrimary: boolean;
  onClose: () => void;
};

const LAST_ADMIN_REASON = 'A empresa precisa de pelo menos um administrador.';
const MUTED = 'mt-2 text-sm text-gray-500 dark:text-surface-dark-500';

const useMembers = (companyId: string | null) => {
  const [members, setMembers] = useState<TenantMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    if (!companyId) return;
    setError(null);
    try {
      setMembers(await listTenantMembers(companyId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as pessoas.');
    }
  }, [companyId]);

  useEffect(() => {
    setMembers(null);
    void load();
  }, [load]);

  // Depois de uma mudança: recarrega a equipe e avisa a lista de funcionários da principal.
  const refresh = useCallback(async () => {
    await load();
    setVersion((current) => current + 1);
  }, [load]);

  return { members, error, load, refresh, version };
};

// Libera funcionários da principal nesta empresa; busyKey diz qual botão mostra o carregando.
const useShareMembers = (company: TenantSummary | null, refresh: () => Promise<void>) => {
  const toast = useToast();
  const run = useAsyncHandler();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const share = async (toShare: ShareableMember[]) => {
    if (!company) return;
    const single = toShare.length === 1;
    setBusyKey(single ? toShare[0].user_id : ALL);
    try {
      await run(async () => {
        await shareTenantMembers(company.id, toShare.map((member) => member.user_id));
        const who = single ? `${shareableName(toShare[0])} agora vê` : `${toShare.length} funcionários agora veem`;
        toast.success(`${who} a ${company.name}.`);
        await refresh();
      });
    } finally {
      setBusyKey(null);
    }
  };

  return { busyKey, share };
};

function MembersList({ members, error, currentUserId, onRetry, onRemove }: {
  members: TenantMember[] | null;
  error: string | null;
  currentUserId: string | null;
  onRetry: () => void;
  onRemove: (member: TenantMember) => void;
}) {
  if (error) {
    return (
      <div className="mt-2 rounded-ios-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/10 dark:text-red-300">
        {error}{' '}
        <button type="button" onClick={onRetry} className="min-h-11 font-semibold underline">
          Tentar de novo
        </button>
      </div>
    );
  }
  if (members === null) return <p className={MUTED}>Carregando…</p>;
  if (members.length === 0) return <p className={MUTED}>Ninguém ainda. Adicione o primeiro administrador acima.</p>;

  const adminCount = members.filter((member) => member.role === 'admin').length;
  return (
    <>
      <ul className="mt-2 divide-y divide-gray-100 rounded-ios-lg border border-gray-200 dark:divide-surface-dark-300 dark:border-surface-dark-300">
        {members.map((member) => (
          <MemberRow
            key={member.user_id}
            member={member}
            isSelf={member.user_id === currentUserId}
            blockedReason={member.role === 'admin' && adminCount <= 1 ? LAST_ADMIN_REASON : null}
            onRemove={() => onRemove(member)}
          />
        ))}
      </ul>
      {adminCount === 1 && (
        <p className="mt-2 text-ios-caption text-gray-500 dark:text-surface-dark-500">
          O único administrador não pode ser removido: a empresa ficaria sem ninguém para cuidar dela.
        </p>
      )}
    </>
  );
}

export default function CompanyMembersModal({ company, currentUserId, canShareFromPrimary, onClose }: CompanyMembersModalProps) {
  const toast = useToast();
  const run = useAsyncHandler();
  const { members, error, load, refresh, version } = useMembers(company?.id ?? null);
  const [isAdding, setIsAdding] = useState(false);
  const [toRemove, setToRemove] = useState<TenantMember | null>(null);
  const sharing = useShareMembers(company, refresh);

  if (!company) return null;

  const handleAdd = async ({ email, role }: { email: string; role: AppRole }) => {
    let added = false;
    await run(
      async () => {
        await addTenantMember(company.id, email, role);
        toast.success(`${email} agora é ${ROLE_LABELS[role].toLowerCase()} da ${company.name}.`);
        added = true;
        await refresh();
      },
      { setLoading: setIsAdding },
    );
    return added;
  };

  const handleRemove = async () => {
    const member = toRemove;
    setToRemove(null);
    if (!member) return;
    await run(async () => {
      await removeTenantMember(company.id, member.user_id);
      toast.success(`${memberName(member)} saiu da ${company.name}.`);
      await refresh();
    });
  };

  const unshareRequest = (member: ShareableMember) => {
    const current = members?.find((candidate) => candidate.user_id === member.user_id);
    if (current) setToRemove(current);
  };

  const showSharing = canShareFromPrimary && !company.isPrimary;

  return (
    <>
      <Modal open onClose={onClose} title={`Pessoas da ${company.name}`} size="md">
        <div className="space-y-5">
          <AddMemberForm key={company.id} adding={isAdding} onAdd={handleAdd} />
          <section aria-labelledby="members-title">
            <h3 id="members-title" className="text-ios-caption font-bold uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
              Quem tem acesso
            </h3>
            <MembersList members={members} error={error} currentUserId={currentUserId} onRetry={() => void load()} onRemove={setToRemove} />
          </section>
          {showSharing && (
            <SharedMembersSection
              company={company}
              version={version}
              busyKey={sharing.busyKey}
              onShare={(toShare) => void sharing.share(toShare)}
              onUnshare={unshareRequest}
            />
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={toRemove !== null}
        onClose={() => setToRemove(null)}
        title="Remover acesso?"
        description={toRemove ? `${memberName(toRemove)} deixa de ver a ${company.name}. O acesso às outras empresas não muda.` : undefined}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={() => void handleRemove()}
      />
    </>
  );
}
