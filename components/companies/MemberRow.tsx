import React from 'react';
import { Trash2 } from 'lucide-react';
import { ROLE_LABELS } from '../../lib/permissions';
import type { TenantMember } from '../../services/tenants';

type MemberRowProps = {
  member: TenantMember;
  isSelf: boolean;
  blockedReason: string | null;
  onRemove: () => void;
};

export const memberName = (member: TenantMember) => member.display_name || member.email || 'Sem nome';

const secondaryLine = (member: TenantMember) =>
  `${ROLE_LABELS[member.role]}${member.display_name && member.email ? ` · ${member.email}` : ''}`;

const MemberRow: React.FC<MemberRowProps> = ({ member, isSelf, blockedReason, onRemove }) => {
  return (
    <li className="flex min-h-[60px] items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-ios-subhead font-semibold text-gray-900 dark:text-white">
          {memberName(member)}
          {isSelf && <span className="ml-1 font-normal text-gray-500">(você)</span>}
        </p>
        <p className="truncate text-ios-caption text-gray-500 dark:text-surface-dark-500">{secondaryLine(member)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={blockedReason !== null}
        title={blockedReason ?? 'Tirar o acesso a esta empresa'}
        aria-label={`Remover ${memberName(member)}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-300 dark:hover:bg-red-900/20 dark:disabled:text-surface-dark-400"
      >
        <Trash2 size={18} />
      </button>
    </li>
  );
};

export default MemberRow;
