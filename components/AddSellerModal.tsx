import React, { useState } from 'react';
import Modal from './ui/Modal';
import IOSButton from './ui/IOSButton';
import { useData } from '../services/dataContext';
import { useToast } from './ui/ToastProvider';
import { adminProvisionUser } from '../services/adminProvision';

interface AddSellerModalProps {
  open: boolean;
  onClose: () => void;
  onSellerAdded: (sellerId: string) => void;
}

export const AddSellerModal: React.FC<AddSellerModalProps> = ({ open, onClose, onSellerAdded }) => {
  const { refreshData } = useData();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ form?: string; name?: string; email?: string; password?: string }>({});

  const handleSubmit = async () => {
    const nextErrors: typeof fieldErrors = {};
    if (!name.trim()) nextErrors.name = 'Informe o nome do vendedor.';
    if (!email.trim()) nextErrors.email = 'Informe o e-mail de acesso.';
    if (!password) nextErrors.password = 'Informe a senha inicial.';
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors({ ...nextErrors, form: 'Informe nome, e-mail e senha inicial.' });
      return;
    }

    if (password.length < 6) {
      setFieldErrors({
        password: 'Use pelo menos 6 caracteres.',
        form: 'A senha inicial precisa ter pelo menos 6 caracteres.'
      });
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      const result = await adminProvisionUser({
        email: email.trim(),
        password,
        role: 'seller',
        name: name.trim()
      });

      await refreshData();

      if (result.seller?.id) {
        onSellerAdded(result.seller.id);
      }

      toast.success('Vendedor cadastrado com sucesso!');
      setName('');
      setEmail('');
      setPassword('');
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível cadastrar vendedor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo Vendedor"
      centered={false}
      onSubmit={() => { void handleSubmit(); }}
      footer={
        <div className="flex justify-end gap-2">
          <IOSButton variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </IOSButton>
          <IOSButton variant="primary" type="submit" loading={isSubmitting}>
            Cadastrar Vendedor
          </IOSButton>
        </div>
      }
    >
      <div className="space-y-4">
        {fieldErrors.form && (
          <p role="alert" className="rounded-ios border border-red-200 bg-red-50 px-3 py-2 text-ios-footnote text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {fieldErrors.form}
          </p>
        )}
        <div>
          <label htmlFor="new-seller-name" className="ios-label">Nome do Vendedor *</label>
          <input
            id="new-seller-name"
            type="text"
            required
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? 'new-seller-name-error' : undefined}
            className={`ios-input ${fieldErrors.name ? 'ios-input-error' : ''}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="Ex: Vendedor 01"
          />
          {fieldErrors.name && (
            <p id="new-seller-name-error" className="mt-1 text-ios-footnote text-red-600 dark:text-red-400">
              {fieldErrors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-seller-email" className="ios-label">Email de Acesso *</label>
          <input
            id="new-seller-email"
            type="email"
            required
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'new-seller-email-error' : undefined}
            className={`ios-input ${fieldErrors.email ? 'ios-input-error' : ''}`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="vendedor@email.com"
          />
          {fieldErrors.email && (
            <p id="new-seller-email-error" className="mt-1 text-ios-footnote text-red-600 dark:text-red-400">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-seller-password" className="ios-label">Senha Inicial *</label>
          <input
            id="new-seller-password"
            type="password"
            required
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'new-seller-password-error' : undefined}
            className={`ios-input ${fieldErrors.password ? 'ios-input-error' : ''}`}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            placeholder="Mínimo de 6 caracteres"
          />
          {fieldErrors.password && (
            <p id="new-seller-password-error" className="mt-1 text-ios-footnote text-red-600 dark:text-red-400">
              {fieldErrors.password}
            </p>
          )}
        </div>
        
      </div>
    </Modal>
  );
};
