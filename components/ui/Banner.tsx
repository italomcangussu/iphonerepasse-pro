import React from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { iosFastEase } from '../motion/transitions';

export type BannerKind = 'success' | 'error' | 'warning' | 'info';

interface BannerProps {
  kind?: BannerKind;
  title?: string;
  message: React.ReactNode;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const KINDS: Record<BannerKind, { icon: any; chrome: string; iconClass: string }> = {
  success: {
    icon: CheckCircle2,
    chrome: 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800/50',
    iconClass: 'text-green-600 dark:text-green-400',
  },
  error: {
    icon: AlertCircle,
    chrome: 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800/50',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    chrome: 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/50',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: Info,
    chrome: 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800/50',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
};

const Banner: React.FC<BannerProps> = ({
  kind = 'info',
  title,
  message,
  onClose,
  action,
  className = '',
}) => {
  const reducedMotion = useReducedMotion();
  const { icon: Icon, chrome, iconClass } = KINDS[kind];

  return (
    <m.div
      initial={reducedMotion ? false : { opacity: 0, scale: 0.98, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      transition={iosFastEase}
      className={`ios-card p-4 flex gap-4 items-start ${chrome} ${className}`}
    >
      <div className={`mt-0.5 shrink-0 ${iconClass}`}>
        <Icon size={20} />
      </div>
      
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="text-ios-subhead font-bold text-gray-900 dark:text-white mb-1">
            {title}
          </h4>
        )}
        <div className="text-sm text-gray-700 dark:text-surface-dark-600 leading-relaxed font-medium">
          {message}
        </div>
        
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-2 text-sm font-semibold text-brand-600 dark:text-brand-300 hover:underline transition-all"
          >
            {action.label}
          </button>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 dark:text-surface-dark-400 transition-colors"
          aria-label="Dispensar alerta"
        >
          <X size={16} />
        </button>
      )}
    </m.div>
  );
};

export default Banner;
