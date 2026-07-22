import React, { useEffect, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, m, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import { iosFastEase, iosSnappySpring } from '../motion/transitions';

interface ComboboxOption {
  id: string;
  label: string;
  subLabel?: string;
  /** Rich second line for the listbox row. When present it replaces the
   * rendered subLabel — subLabel stays as the plain-text search source. */
  description?: React.ReactNode;
  /** Right-aligned slot on the listbox row (e.g. price). Inherits the row's
   * text color, so it turns brand-tinted when the option is selected. */
  trailing?: React.ReactNode;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  filterOptions?: (options: ComboboxOption[], query: string) => ComboboxOption[];
  placeholder?: string;
  label?: string;
  searchPlaceholder?: string;
  minSearchChars?: number;
  minSearchMessage?: string;
  noResultsMessage?: string;
  onAddNew?: () => void;
  addNewLabel?: string;
  className?: string;
  ariaLabel?: string;
  errorMessage?: string;
  onSearchOpen?: () => void;
}

export const Combobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onChange,
  filterOptions,
  placeholder = 'Selecione...',
  label,
  searchPlaceholder = 'Buscar...',
  minSearchChars = 0,
  minSearchMessage,
  noResultsMessage = 'Nenhum resultado encontrado.',
  onAddNew,
  addNewLabel = 'Adicionar Novo',
  className = '',
  ariaLabel,
  errorMessage,
  onSearchOpen
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [shakeKey, setShakeKey] = useState(0);
  const reducedMotion = useReducedMotion();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // The listbox is portaled to <body> (so it never gets clipped by a parent
  // with overflow:hidden, e.g. inside a Modal) and positioned with fixed
  // coordinates derived from the trigger, flipping upward when there isn't
  // enough room below.
  const [dropdownPos, setDropdownPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
    openUp: boolean;
  }>({ left: 0, width: 0, top: 0, maxHeight: 240, openUp: false });

  const updateDropdownPosition = useCallback(() => {
    const el = wrapperRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const margin = 4;
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const available = (openUp ? spaceAbove : spaceBelow) - margin - 8;
    setDropdownPos({
      left: rect.left,
      width: rect.width,
      openUp,
      top: openUp ? undefined : rect.bottom + margin,
      bottom: openUp ? viewportH - rect.top + margin : undefined,
      maxHeight: Math.min(240, Math.max(140, available)),
    });
  }, []);

  // Trigger shake when a new error appears (not on initial render).
  const prevErrorRef = useRef<string | undefined>(errorMessage);
  useEffect(() => {
    if (errorMessage && errorMessage !== prevErrorRef.current && !reducedMotion) {
      setShakeKey((k) => k + 1);
    }
    prevErrorRef.current = errorMessage;
  }, [errorMessage, reducedMotion]);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const labelId = `${baseId}-label`;
  const errorId = `${baseId}-error`;

  const selectedOption = options.find((opt) => opt.id === value);
  const normalizedQuery = query.trim().toLowerCase();
  const hasMinQueryLength = normalizedQuery.length >= minSearchChars;

  const filteredOptions = useMemo(() => {
    if (filterOptions) return filterOptions(options, normalizedQuery);
    if (normalizedQuery === '') return minSearchChars > 0 ? [] : options;
    if (!hasMinQueryLength) return [];
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(normalizedQuery) ||
        opt.subLabel?.toLowerCase().includes(normalizedQuery)
    );
  }, [options, normalizedQuery, hasMinQueryLength, minSearchChars]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // The listbox is portaled outside the wrapper, so exclude it too.
      if (wrapperRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Position the portaled listbox under (or above) the trigger and keep it
  // pinned while the user scrolls or resizes.
  useLayoutEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    const onReflow = () => updateDropdownPosition();
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setHighlightedIndex(-1);
      return;
    }

    onSearchOpen?.();
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, onSearchOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (filteredOptions.length === 0) {
      setHighlightedIndex(-1);
      return;
    }
    setHighlightedIndex((prev) => {
      if (prev < 0 || prev >= filteredOptions.length) return 0;
      return prev;
    });
  }, [filteredOptions, isOpen]);

  const closeAndReturnFocus = () => {
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  const selectOption = (option: ComboboxOption) => {
    onChange(option.id);
    setIsOpen(false);
    setQuery('');
    setHighlightedIndex(-1);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndReturnFocus();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredOptions.length === 0) return;
      setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filteredOptions.length === 0) return;
      setHighlightedIndex((prev) => (prev <= 0 ? filteredOptions.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Enter') {
      // Always swallow Enter while the listbox is open so it selects the
      // highlighted option instead of submitting an enclosing <form>.
      event.preventDefault();
      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        selectOption(filteredOptions[highlightedIndex]);
      }
    }
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && (
        <label id={labelId} className="ios-label">
          {label}
        </label>
      )}

      <div key={shakeKey} className={errorMessage && shakeKey > 0 ? 'animate-ios-shake' : ''}>
        {!isOpen ? (
          <button
            ref={triggerRef}
            type="button"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-labelledby={label ? labelId : undefined}
            aria-label={ariaLabel}
            aria-invalid={!!errorMessage}
            aria-describedby={errorMessage ? errorId : undefined}
            className={`ios-input w-full text-left flex justify-between items-center bg-white dark:bg-surface-dark-200 ${
              errorMessage ? 'ios-input-error' : ''
            }`}
            onClick={() => setIsOpen(true)}
            onKeyDown={onTriggerKeyDown}
          >
            <span className={selectedOption ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronDown size={16} className="text-gray-400" />
          </button>
        ) : (
          <div className="ios-input w-full p-0 flex items-center overflow-hidden ring-2 ring-brand-500 border-brand-500">
            <Search size={18} className="ml-3 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={listboxId}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-labelledby={label ? labelId : undefined}
              aria-label={ariaLabel}
              aria-invalid={!!errorMessage}
              aria-describedby={errorMessage ? errorId : undefined}
              aria-activedescendant={
                highlightedIndex >= 0 && filteredOptions[highlightedIndex]
                  ? `${baseId}-option-${filteredOptions[highlightedIndex].id}`
                  : undefined
              }
              className="w-full p-3 outline-none border-none bg-transparent"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {errorMessage && (
          <m.p
            id={errorId}
            aria-label={errorMessage}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="mt-1 text-xs text-red-600 dark:text-red-400"
            role="alert"
          >
            {errorMessage}
          </m.p>
        )}
      </AnimatePresence>

      {createPortal(
      <AnimatePresence>
        {isOpen && (
          <m.div
            ref={dropdownRef}
            id={listboxId}
            role="listbox"
            initial={{ opacity: 0, y: dropdownPos.openUp ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropdownPos.openUp ? 4 : -4, scale: 0.98, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
            transition={{ ...iosFastEase, duration: 0.2 }}
            style={{
              position: 'fixed',
              left: dropdownPos.left,
              width: dropdownPos.width,
              top: dropdownPos.top,
              bottom: dropdownPos.bottom,
              maxHeight: dropdownPos.maxHeight,
              originY: dropdownPos.openUp ? 1 : 0,
            }}
            className="z-[60] bg-elevation-3 rounded-ios-lg shadow-ios26-lg border border-gray-200/70 dark:border-surface-dark-200 overflow-y-auto will-change-transform"
          >
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-surface-dark-500 text-sm">
                {!hasMinQueryLength && minSearchChars > 0
                  ? minSearchMessage || `Digite ao menos ${minSearchChars} caracteres.`
                  : noResultsMessage}
              </div>
            ) : (
              <LayoutGroup id={`${baseId}-combobox-highlight`}>
                <ul className="py-1 relative">
                  {filteredOptions.map((option, index) => {
                    const isSelected = value === option.id;
                    const isHighlighted = index === highlightedIndex;
                    return (
                      <li
                        key={option.id}
                        id={`${baseId}-option-${option.id}`}
                        role="option"
                        aria-selected={isSelected}
                        className={`relative px-4 py-2 min-h-11 flex justify-between items-center gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'text-brand-600 dark:text-brand-300'
                            : 'text-gray-900 dark:text-white'
                        }`}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => selectOption(option)}
                      >
                        {isHighlighted && (
                          <m.span
                            layoutId={`${baseId}-highlight`}
                            aria-hidden="true"
                            className="absolute inset-x-1 inset-y-0.5 rounded-ios bg-gray-100 dark:bg-surface-dark-200 z-0"
                            transition={iosSnappySpring}
                          />
                        )}
                        <div className="relative z-10 min-w-0">
                          <div className="font-medium truncate">{option.label}</div>
                          {option.description ? (
                            <div className="text-xs text-gray-500 dark:text-surface-dark-500 mt-0.5">{option.description}</div>
                          ) : option.subLabel ? (
                            <div className="text-xs text-gray-500 dark:text-surface-dark-500">{option.subLabel}</div>
                          ) : null}
                        </div>
                        {(option.trailing || isSelected) && (
                          <div className="relative z-10 shrink-0 flex items-center gap-1.5">
                            {option.trailing}
                            {isSelected && <Check size={16} />}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </LayoutGroup>
            )}

            {onAddNew && (
              <button
                type="button"
                className="w-full p-3 border-t border-gray-100 dark:border-surface-dark-300 text-brand-500 font-medium hover:bg-gray-50 dark:hover:bg-surface-dark-200 flex items-center justify-center gap-2 transition-colors"
                onClick={() => {
                  onAddNew();
                  setIsOpen(false);
                  setHighlightedIndex(-1);
                }}
              >
                <Plus size={16} />
                {addNewLabel}
              </button>
            )}
          </m.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  );
};
