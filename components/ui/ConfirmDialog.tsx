import React from 'react';
import Modal from './Modal';

export default function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
}) {
  const confirmClass =
    variant === 'danger'
      ? 'ios-button bg-red-600 hover:bg-red-700 text-white'
      : 'ios-button-primary';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" className="ios-button-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmClass}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      {description && <p className="text-ios-body text-gray-600 dark:text-surface-dark-600">{description}</p>}
    </Modal>
  );
}

