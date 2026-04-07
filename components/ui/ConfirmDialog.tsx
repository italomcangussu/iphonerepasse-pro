import React from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import Modal from './Modal';
import IOSButton from './IOSButton';
import { iosSpring } from '../motion/transitions';

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
  const reducedMotion = useReducedMotion();
  const isDanger = variant === 'danger';

  const iconClass = isDanger
    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    : 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400';

  const Icon = isDanger ? AlertTriangle : HelpCircle;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <IOSButton variant="secondary" onClick={onClose}>
            {cancelLabel}
          </IOSButton>
          <IOSButton
            variant={isDanger ? 'destructive' : 'primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </IOSButton>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <m.div
          initial={reducedMotion ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...iosSpring, delay: 0.06 }}
          className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${iconClass}`}
          aria-hidden="true"
        >
          <Icon className="w-6 h-6" />
        </m.div>
        {description && (
          <p className="text-ios-body text-gray-600 dark:text-surface-dark-600 flex-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </Modal>
  );
}
