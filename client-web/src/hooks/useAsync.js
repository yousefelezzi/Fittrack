import { useState, useCallback, useRef } from 'react';

/**
 * Wraps an async function and tracks its loading / error / data state.
 *
 * Usage:
 *   const { run, data, loading, error, reset } = useAsync();
 *   await run(() => workoutAPI.getAll({ page: 1 }));
 */
export function useAsync() {
  const [state, setState] = useState({ data: null, loading: false, error: null });
  const mountedRef = useRef(true);

  // Mark unmounted so we never setState after unmount
  // (call cleanup() in a useEffect return)
  const cleanup = useCallback(() => { mountedRef.current = false; }, []);

  const run = useCallback(async (asyncFn) => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await asyncFn();
      const data = result?.data ?? result;
      if (mountedRef.current) setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Something went wrong';
      if (mountedRef.current) setState({ data: null, loading: false, error: message });
      throw err;
    }
  }, []);

  const reset = useCallback(() => setState({ data: null, loading: false, error: null }), []);

  return { ...state, run, reset, cleanup };
}