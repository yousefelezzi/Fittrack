import { useState, useCallback } from 'react';

/**
 * Like useState, but synced to localStorage under `key`.
 * Falls back to `initialValue` when the key is missing or the stored
 * value is unparseable.
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      try {
        const next = value instanceof Function ? value(storedValue) : value;
        setStoredValue(next);
        localStorage.setItem(key, JSON.stringify(next));
      } catch (err) {
        console.error('useLocalStorage setValue error:', err);
      }
    },
    [key, storedValue]
  );

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      localStorage.removeItem(key);
    } catch (err) {
      console.error('useLocalStorage removeValue error:', err);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}