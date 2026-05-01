import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePaginatedRows } from './usePaginatedRows';

describe('usePaginatedRows', () => {
  it('returns the current page slice and clamps page after item count changes', () => {
    const { result, rerender } = renderHook(
      ({ rows }) => usePaginatedRows(rows, { pageSize: 2, resetKey: 'same' }),
      { initialProps: { rows: [1, 2, 3, 4, 5] } },
    );

    expect(result.current.rows).toEqual([1, 2]);
    expect(result.current.totalPages).toBe(3);

    act(() => result.current.setPage(2));
    expect(result.current.rows).toEqual([5]);

    rerender({ rows: [1, 2, 3] });

    expect(result.current.page).toBe(1);
    expect(result.current.rows).toEqual([3]);
  });

  it('resets page when reset key changes', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => usePaginatedRows([1, 2, 3, 4], { pageSize: 2, resetKey }),
      { initialProps: { resetKey: 'first' } },
    );

    act(() => result.current.setPage(1));
    expect(result.current.rows).toEqual([3, 4]);

    rerender({ resetKey: 'second' });

    expect(result.current.page).toBe(0);
    expect(result.current.rows).toEqual([1, 2]);
  });
});
