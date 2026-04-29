import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({ page, totalPages, totalItems, pageSize, onPageChange, className = '' }) => {
  if (totalPages <= 1) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalItems);

  return (
    <div className={`flex items-center justify-between gap-4 px-4 py-3 border-t border-gray-200 dark:border-surface-dark-200 ${className}`}>
      <p className="text-xs text-gray-500 dark:text-surface-dark-500 tabular-nums">
        {from}–{to} de {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className="p-1.5 rounded-ios text-gray-500 hover:bg-gray-100 dark:hover:bg-surface-dark-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-medium text-gray-700 dark:text-surface-dark-700 px-2 tabular-nums">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
          className="p-1.5 rounded-ios text-gray-500 hover:bg-gray-100 dark:hover:bg-surface-dark-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Próxima página"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
