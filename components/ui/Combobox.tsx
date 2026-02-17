import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';

interface ComboboxOption {
  id: string;
  label: string;
  subLabel?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
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

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const labelId = `${baseId}-label`;
  const errorId = `${baseId}-error`;

  const selectedOption = options.find((opt) => opt.id === value);
  const normalizedQuery = query.trim().toLowerCase();
  const hasMinQueryLength = normalizedQuery.length >= minSearchChars;

  const filteredOptions = useMemo(() => {
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
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        event.preventDefault();
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
            errorMessage ? 'border-red-500 focus:border-red-500' : ''
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

      {errorMessage && (
        <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white dark:bg-surface-dark-100 rounded-ios-lg shadow-ios-xl border border-gray-200 dark:border-surface-dark-200 max-h-60 overflow-y-auto"
        >
          {filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-surface-dark-500 text-sm">
              {!hasMinQueryLength && minSearchChars > 0
                ? minSearchMessage || `Digite ao menos ${minSearchChars} caracteres.`
                : noResultsMessage}
            </div>
          ) : (
            <ul className="py-1">
              {filteredOptions.map((option, index) => {
                const isSelected = value === option.id;
                const isHighlighted = index === highlightedIndex;
                return (
                  <li
                    key={option.id}
                    id={`${baseId}-option-${option.id}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`px-4 py-2 flex justify-between items-center cursor-pointer ${
                      isHighlighted ? 'bg-gray-100 dark:bg-surface-dark-200' : ''
                    } ${
                      isSelected
                        ? 'text-brand-600 dark:text-brand-300'
                        : 'text-gray-900 dark:text-white'
                    }`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectOption(option)}
                  >
                    <div>
                      <div className="font-medium">{option.label}</div>
                      {option.subLabel && <div className="text-xs text-gray-500">{option.subLabel}</div>}
                    </div>
                    {isSelected && <Check size={16} />}
                  </li>
                );
              })}
            </ul>
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
        </div>
      )}
    </div>
  );
};
