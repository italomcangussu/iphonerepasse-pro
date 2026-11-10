import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import IOSButton from '../ui/IOSButton';

type CompanyNameModalProps = {
  open: boolean;
  isRename: boolean;
  initialName: string;
  saving: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
};

export default function CompanyNameModal({ open, isRename, initialName, saving, onClose, onSave }: CompanyNameModalProps) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSave(name.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title={isRename ? 'Renomear empresa' : 'Nova empresa'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="block text-ios-subhead font-semibold text-gray-900 dark:text-white">Nome</span>
          <input
            autoFocus
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: GR Imports Matriz"
            className="ios-input mt-1 min-h-12 w-full text-base"
          />
        </label>
        {!isRename && (
          <p className="text-ios-caption text-gray-500 dark:text-surface-dark-500">
            A empresa nasce vazia. Depois você adiciona os administradores e transfere lojas ou aparelhos para ela.
          </p>
        )}
        <IOSButton type="submit" variant="primary" loading={saving} disabled={!name.trim()} className="w-full min-h-12">
          {isRename ? 'Salvar nome' : 'Criar empresa'}
        </IOSButton>
      </form>
    </Modal>
  );
}
