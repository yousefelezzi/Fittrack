import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

// Searchable replacement for a <select> of exercises.
// `value` is the selected exercise _id (string, '' when empty);
// `onChange` is called with the new _id. `excludeIds` are left out of the list
// (e.g. exercises already in the same plan day).
export default function ExerciseCombobox({ exercises: allExercises, value, onChange, placeholder = 'Pick exercise', className = '', excludeIds = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const excludeKey = excludeIds.join(',');
  const exercises = useMemo(
    () => allExercises.filter((e) => e._id === value || !excludeKey.split(',').includes(e._id)),
    [allExercises, value, excludeKey],
  );
  const selected = exercises.find((e) => e._id === value);

  // Match on name, muscle groups and equipment so "chest" or "dumbbell" work too.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    const terms = q.split(/\s+/);
    return exercises.filter((e) => {
      const haystack = [e.name, ...(e.muscleGroups || []), e.equipment || ''].join(' ').toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [exercises, query]);

  // Close when clicking anywhere outside the component.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) close(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Keep the highlighted row in view while using the arrow keys.
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.children[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const openList = () => {
    setOpen(true);
    setQuery('');
    const idx = exercises.findIndex((e) => e._id === value);
    setHighlight(idx >= 0 ? idx : 0);
  };

  const close = () => { setOpen(false); setQuery(''); };

  const pick = (ex) => {
    onChange(ex._id);
    close();
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { e.preventDefault(); openList(); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight]) pick(filtered[highlight]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); inputRef.current?.blur(); }
    else if (e.key === 'Tab') close();
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="relative">
        {open && <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
        <input
          ref={inputRef}
          className={`input text-xs pr-7 ${open ? 'pl-7' : ''} ${!selected && !open ? 'text-gray-400 dark:text-gray-500' : ''}`}
          // Closed: show the chosen exercise. Open: show what the user is typing.
          value={open ? query : (selected?.name ?? '')}
          placeholder={open ? 'Search exercises…' : placeholder}
          onFocus={openList}
          onClick={() => { if (!open) openList(); }}
          onChange={(e) => { setQuery(e.target.value); setHighlight(0); if (!open) setOpen(true); }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {selected && !open ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onChange('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Clear"
          >
            <X size={12} />
          </button>
        ) : (
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        )}
      </div>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 w-full min-w-[12rem] max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No exercises match “{query}”</li>
          ) : (
            filtered.map((ex, i) => (
              <li
                key={ex._id}
                role="option"
                aria-selected={ex._id === value}
                // mousedown (not click) so the pick happens before the input loses focus
                onMouseDown={(e) => { e.preventDefault(); pick(ex); }}
                onMouseEnter={() => setHighlight(i)}
                className={`px-3 py-1.5 cursor-pointer ${i === highlight ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
              >
                <p className={`text-xs ${ex._id === value ? 'font-semibold text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100'}`}>{ex.name}</p>
                {ex.muscleGroups?.length > 0 && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">{ex.muscleGroups.join(', ')}</p>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
