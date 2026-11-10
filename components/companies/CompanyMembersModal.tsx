import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/ToastProvider';
import { useAsyncHandler } from '../../hooks/useAsyncHandler';
import { ROLE_LABELS } from '../../lib/permissions';
import type { AppRole } from '../../types';
import { addTenantMember, listTenantMembers, removeTenantMember, type TenantMember, type TenantSummary } from '../../services/tenants';
import AddMemberForm from './AddMemberForm';
import MemberRow, { memberName } from './MemberRow';

type CompanyMembersModalProps = {
  company: TenantSummary | null;
  currentUserId: string | null;
  onClose: () => void;
};

const LAST_ADMIN_REASON = 'A empresa precisa de pelo menos um administrador.';
const MUTED = 'mt-2 text-sm text-gray-500 dark:text-surface-dark-500';

const useMembers = (companyId: string | null) => {
  const [members, setMembers] = useState<TenantMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return { members, error, load };
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

export default function CompanyMembersModal({ company, currentUserId, onClose }: CompanyMembersModalProps) {
  const toast = useToast();
  const run = useAsyncHandler();
  const { members, error, load } = useMembers(company?.id ?? null);
  const [isAdding, setIsAdding] = useState(false);
  const [toRemove, setToRemove] = useState<TenantMember | null>(null);

  if (!company) return null;

  const handleAdd = async ({ email, role }: { email: string; role: AppRole }) => {
    let added = false;
    await run(
      async () => {
        await addTenantMember(company.id, email, role);
        toast.success(`${email} agora é ${ROLE_LABELS[role].toLowerCase()} da ${company.name}.`);
        added = true;
        await load();
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
      await load();
    });
  };

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
