import React from 'react';
import { Building2, Pencil, Users } from 'lucide-react';
import { ROLE_LABELS } from '../../lib/permissions';
import type { TenantSummary } from '../../services/tenants';

type CompanyRowProps = {
  company: TenantSummary;
  isActive: boolean;
  onView: () => void;
  onMembers: () => void;
  onRename: () => void;
};

const ICON_BUTTON =
  'flex h-11 w-11 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 dark:text-surface-dark-600 dark:hover:bg-surface-dark-300';

const rowChrome = (isActive: boolean) =>
  isActive ? 'border-brand-300 bg-brand-50/60 dark:border-brand-700 dark:bg-brand-900/20' : 'border-gray-200 dark:border-surface-dark-300';

const CompanyRow: React.FC<CompanyRowProps> = ({ company, isActive, onView, onMembers, onRename }) => {
  const roleText = `Você é ${ROLE_LABELS[company.role].toLowerCase()}${isActive ? ' · você está vendo esta' : ''}`;
  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-ios-lg border px-4 py-3 ${rowChrome(isActive)}`}>
      <Building2 size={20} className="shrink-0 text-brand-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-ios-subhead font-semibold text-gray-900 dark:text-white">
          {company.name}
          {company.isPrimary && (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-ios-caption font-medium text-gray-600 dark:bg-surface-dark-300 dark:text-surface-dark-600">
              Principal
            </span>
          )}
        </p>
        <p className="text-ios-caption text-gray-500 dark:text-surface-dark-500">{roleText}</p>
      </div>
      <div className="flex gap-1">
        {!isActive && (
          <button
            type="button"
            onClick={onView}
            className="min-h-11 rounded-full px-3 text-sm font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/20"
          >
            Ver esta
          </button>
        )}
        {company.role === 'admin' && (
          <>
            <button type="button" onClick={onMembers} aria-label={`Pessoas da ${company.name}`} title="Pessoas" className={ICON_BUTTON}>
              <Users size={18} />
            </button>
            <button type="button" onClick={onRename} aria-label={`Renomear ${company.name}`} title="Renomear" className={ICON_BUTTON}>
              <Pencil size={18} />
            </button>
          </>
        )}
      </div>
    </li>
  );
};

export default CompanyRow;
