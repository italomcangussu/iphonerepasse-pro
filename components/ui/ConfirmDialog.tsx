import React from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { AlertCircle, HelpCircle, AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import { iosSpring } from '../motion/transitions';

export type ConfirmVariant = 'default' | 'danger' | 'warning';

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
  variant?: ConfirmVariant;
  onConfirm: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  const iconClass = isDanger
    ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
    : isWarning
    ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
    : 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-300';

  const Icon = isDanger ? AlertCircle : isWarning ? AlertTriangle : HelpCircle;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      centered={true}
      footer={
        <div className="flex flex-col sm:flex-row justify-end gap-3 w-full">
          <button 
            type="button"
            className="ios-button-secondary w-full sm:w-auto order-2 sm:order-1" 
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${isDanger ? 'ios-button-destructive' : 'ios-button-primary'} w-full sm:w-auto order-1 sm:order-2`}
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
      <div className="flex flex-col items-center text-center gap-5 py-2">
        <m.div
          initial={reducedMotion ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...iosSpring, delay: 0.05 }}
          className={`shrink-0 w-16 h-16 rounded-full flex items-center justify-center ${iconClass} shadow-premium-sm mb-2`}
          aria-hidden="true"
        >
          <Icon size={32} strokeWidth={2.25} />
        </m.div>
        <div className="flex-1 space-y-3">
          {description && (
            <p className="text-[17px] font-medium text-gray-600 dark:text-surface-dark-600 leading-relaxed px-2">
              {description}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
