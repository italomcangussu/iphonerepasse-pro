import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { iosFastEase } from '../motion/transitions';

/**
 * InfoTooltip — affordance de explicação (o "?" ao lado de um rótulo).
 *
 * Existe porque telas de estatística usam jargão (GMROI, sell-through, ABC…) e o
 * usuário não deveria precisar saber o termo de fora (Krug: "não me faça pensar").
 * Abre em hover, foco (teclado) e toque/clique (mobile não tem hover), fecha com
 * Escape ou clique fora. Superfície reúsa `liquid-glass` + `shadow-ios26-lg`.
 *
 * Acessibilidade: o gatilho é um <button> com `aria-label`; o conteúdo é ligado
 * por `aria-describedby` e exposto com `role="tooltip"`.
 */
interface InfoTooltipProps {
  /** Nome acessível do gatilho, ex.: "O que é GMROI". */
  label: string;
  children: React.ReactNode;
  /** Alinhamento do balão relativo ao gatilho (evita corte na borda da tela). */
  align?: 'start' | 'end';
  className?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ label, children, align = 'start', className = '' }) => {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={close}
        className="inline-flex items-center justify-center rounded-full p-1 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-surface-dark-500 dark:hover:text-surface-dark-700"
      >
        <HelpCircle size={14} aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <m.span
            id={tipId}
            role="tooltip"
            initial={reducedMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={iosFastEase}
            className={`liquid-glass shadow-ios26-lg absolute top-full z-50 mt-1 block w-60 max-w-[16rem] rounded-ios-xl p-3 text-left text-ios-footnote font-normal normal-case leading-snug tracking-normal text-gray-700 dark:text-surface-dark-700 ${
              align === 'end' ? 'right-0' : 'left-0'
            }`}
          >
            {children}
          </m.span>
        )}
      </AnimatePresence>
    </span>
  );
};

export default InfoTooltip;
