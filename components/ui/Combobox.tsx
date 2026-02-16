import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check, ChevronDown } from 'lucide-react';

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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

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
        // Reset query when closing, but keep it if we want to search again
        // Actually, maybe better to clear query if we have a selected value?
        // Let's keep the query empty so the full list helps context when reopening, 
        // unless we want to persist the search. Let's clear it for now.
        setQuery('');
    }
  }, [isOpen]);

  const normalizedQuery = query.trim().toLowerCase();
  const hasMinQueryLength = normalizedQuery.length >= minSearchChars;

  const filteredOptions =
    normalizedQuery === ''
      ? (minSearchChars > 0 ? [] : options)
      : hasMinQueryLength
        ? options.filter((opt) =>
            opt.label.toLowerCase().includes(normalizedQuery) ||
            opt.subLabel?.toLowerCase().includes(normalizedQuery)
          )
        : [];

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && <label className="ios-label">{label}</label>}
      
      <div 
        className="relative"
        onClick={() => {
            setIsOpen(!isOpen); 
            // If opening, focus the input if possible? 
            // In this design, the button IS the trigger. 
            // But we want a search input. 
        }}
      >
        {!isOpen ? (
            <button
                type="button"
                className="ios-input w-full text-left flex justify-between items-center bg-white dark:bg-surface-dark-200"
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
                    type="text"
                    className="w-full p-3 outline-none border-none bg-transparent"
                    placeholder={searchPlaceholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-surface-dark-100 rounded-ios-lg shadow-ios-xl border border-gray-200 dark:border-surface-dark-200 max-h-60 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-surface-dark-500 text-sm">
                {!hasMinQueryLength && minSearchChars > 0
                  ? (minSearchMessage || `Digite ao menos ${minSearchChars} caracteres.`)
                  : noResultsMessage}
            </div>
          ) : (
            <ul className="py-1">
              {filteredOptions.map((option) => (
                <li
                  key={option.id}
                  className={`px-4 py-2 hover:bg-gray-100 dark:hover:bg-surface-dark-200 cursor-pointer flex justify-between items-center ${
                    value === option.id ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600' : 'text-gray-900 dark:text-white'
                  }`}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                    setQuery('');
                  }}
                >
                  <div>
                    <div className="font-medium">{option.label}</div>
                    {option.subLabel && <div className="text-xs text-gray-500">{option.subLabel}</div>}
                  </div>
                  {value === option.id && <Check size={16} />}
                </li>
              ))}
            </ul>
          )}
          
          {onAddNew && (
            <button
                type="button"
                className="w-full p-3 border-t border-gray-100 dark:border-surface-dark-300 text-brand-500 font-medium hover:bg-gray-50 dark:hover:bg-surface-dark-200 flex items-center justify-center gap-2 transition-colors"
                onClick={() => {
                    onAddNew();
                    setIsOpen(false);
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
