import { useState, useCallback } from 'react';

/**
 * Thin pagination helper.
 *
 * Usage:
 *   const { page, totalPages, canNext, canPrev, next, prev, setPage, setTotal } = usePagination();
 */
export function usePagination(initialPage = 1, pageSize = 10) {
  const [page, setPage]           = useState(initialPage);
  const [totalItems, setTotalItems] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const canNext    = page < totalPages;
  const canPrev    = page > 1;

  const next  = useCallback(() => setPage((p) => Math.min(p + 1, totalPages)), [totalPages]);
  const prev  = useCallback(() => setPage((p) => Math.max(p - 1, 1)), []);
  const reset = useCallback(() => setPage(1), []);

  return { page, totalPages, totalItems, canNext, canPrev, next, prev, setPage, setTotal: setTotalItems, reset };
}