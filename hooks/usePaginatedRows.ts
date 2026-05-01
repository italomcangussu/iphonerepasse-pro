import { useEffect, useMemo, useState } from 'react';

interface UsePaginatedRowsOptions {
  pageSize: number;
  resetKey?: string | number | boolean | null;
}

export function usePaginatedRows<T>(
  rows: readonly T[],
  { pageSize, resetKey }: UsePaginatedRowsOptions,
) {
  const [page, setPage] = useState(0);
  const safePageSize = Math.max(1, pageSize);
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));

  useEffect(() => {
    setPage(0);
  }, [resetKey]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  const paginatedRows = useMemo(() => {
    const start = page * safePageSize;
    return rows.slice(start, start + safePageSize);
  }, [page, rows, safePageSize]);

  return {
    page,
    setPage,
    rows: paginatedRows,
    totalItems,
    totalPages,
    pageSize: safePageSize,
  };
}
