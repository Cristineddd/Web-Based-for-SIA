import { useState, useEffect } from 'react';

/**
 * Debounce a value so it only updates after `delay` ms of inactivity.
 * Useful for search inputs to avoid re-filtering on every keystroke.
 */
export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
