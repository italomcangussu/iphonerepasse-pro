import React, { useState, useSyncExternalStore } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { clearPasswordRecovery, isPasswordRecoveryPending, subscribePasswordRecovery } from '../../services/passwordRecovery';
import { useToast } from '../ui/ToastProvider';

const MIN_PASSWORD_LENGTH = 6;

const validatePasswords = (password: string, confirmation: string): string | null => {
  if (password.length < MIN_PASSWORD_LENGTH) return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password !== confirmation) return 'As duas senhas não são iguais.';
  return null;
};

/** Depois de abrir o link de "esqueci minha senha", pede a nova senha antes de liberar o app. */
const PasswordRecoveryGate: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const pending = useSyncExternalStore(subscribePasswordRecovery, isPasswordRecoveryPending, () => false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!pending || !isAuthenticated) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validatePasswords(password, confirmation);
    setError(validationError);
    if (validationError) return;

    setIsSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSaving(false);
    if (updateError) {
      setError('Não foi possível salvar a nova senha. Tente de novo ou peça outro link.');
      return;
    }
    clearPasswordRecovery();
    toast.success('Senha alterada. Você já está dentro do app.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-recovery-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-light-100 p-4 dark:bg-surface-dark-50"
    >
      <form onSubmit={handleSubmit} className="ios-card w-full max-w-md space-y-4 p-6" noValidate>
        <div className="flex items-center gap-3">
          <KeyRound size={22} className="text-brand-500" aria-hidden="true" />
          <h1 id="password-recovery-title" className="text-ios-title-2 font-bold app-text-primary">
            Defina sua nova senha
          </h1>
        </div>
        <div>
          <label htmlFor="recovery-password" className="ios-label">Nova senha</label>
          <input
            id="recovery-password"
            type="password"
            className="ios-input min-h-12"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="recovery-password-hint"
          />
          <p id="recovery-password-hint" className="mt-1 text-ios-footnote app-text-muted">
            Pelo menos {MIN_PASSWORD_LENGTH} caracteres.
          </p>
        </div>
        <div>
          <label htmlFor="recovery-password-confirmation" className="ios-label">Repita a nova senha</label>
          <input
            id="recovery-password-confirmation"
            type="password"
            className="ios-input min-h-12"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button type="submit" disabled={isSaving} className="ios-button-primary w-full">
          {isSaving ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  );
};

export default PasswordRecoveryGate;
