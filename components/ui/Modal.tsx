import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

function maxWidthFor(size: ModalSize): string {
  switch (size) {
    case 'sm':
      return 'max-w-sm';
    case 'md':
      return 'max-w-md';
    case 'lg':
      return 'max-w-2xl';
    case 'xl':
      return 'max-w-4xl';
    default:
      return 'max-w-md';
  }
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar"
      />

      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidthFor(size)} rounded-ios-2xl bg-white dark:bg-surface-dark-100 shadow-ios-xl border border-gray-200 dark:border-surface-dark-200 overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="p-6 border-b border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200 flex justify-between items-center">
            <h3 className="text-ios-title-2 font-bold text-gray-900 dark:text-white">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-surface-dark-300 text-gray-600 dark:text-surface-dark-600"
              aria-label="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        )}

        <div className="p-6">{children}</div>

        {footer && (
          <div className="p-6 border-t border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

