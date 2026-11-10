import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import IOSButton from '../ui/IOSButton';
import { ROLE_LABELS } from '../../lib/permissions';
import type { AppRole } from '../../types';

const ROLE_CHOICES: AppRole[] = ['admin', 'manager', 'seller'];

type AddMemberFormProps = {
  adding: boolean;
  onAdd: (member: { email: string; role: AppRole }) => Promise<boolean>;
};

const AddMemberForm: React.FC<AddMemberFormProps> = ({ adding, onAdd }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('admin');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    if (await onAdd({ email: normalized, role })) setEmail('');
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
      <div>
        <label htmlFor="member-email" className="block text-ios-subhead font-semibold text-gray-900 dark:text-white">
          Adicionar pessoa
        </label>
        <p id="member-email-hint" className="mt-0.5 text-ios-caption text-gray-500 dark:text-surface-dark-500">
          Use o e-mail de quem já tem acesso ao app. Para criar um acesso novo, troque para esta empresa no topo e use Contas de acesso.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="member-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nome@exemplo.com"
          aria-describedby="member-email-hint"
          className="ios-input min-h-12 flex-1 text-base"
        />
        <select
          aria-label="Papel na empresa"
          value={role}
          onChange={(event) => setRole(event.target.value as AppRole)}
          className="ios-input min-h-12 text-base sm:w-40"
        >
          {ROLE_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {ROLE_LABELS[choice]}
            </option>
          ))}
        </select>
      </div>
      <IOSButton type="submit" variant="primary" loading={adding} disabled={!email.trim()} leftIcon={<UserPlus size={18} />} className="w-full min-h-12">
        Adicionar
      </IOSButton>
    </form>
  );
};

export default AddMemberForm;
