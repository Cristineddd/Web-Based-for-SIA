'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Fuse from 'fuse.js';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X, User } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SearchableStudent {
  studentId: string;
  studentName: string;
  section?: string | null;
  email?: string | null;
  /** Extra metadata that passes through to onSelect */
  [key: string]: unknown;
}

export interface StudentSearchComboboxProps {
  /** The full dataset to search */
  students: SearchableStudent[];
  /** Current raw search text (controlled) */
  value: string;
  /** Called whenever the raw input text changes */
  onChange: (query: string) => void;
  /** Called when a suggestion is clicked */
  onSelect?: (student: SearchableStudent) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum suggestions to show */
  maxSuggestions?: number;
  /** Debounce delay in ms (default 200) */
  debounceMs?: number;
  /** Extra className on the root wrapper */
  className?: string;
  /** Whether to show the "X results" badge */
  showResultCount?: boolean;
  /** Total filtered count (when parent does filtering) */
  filteredCount?: number;
}

// ─── Fuse config ────────────────────────────────────────────────────────────

const FUSE_OPTIONS = {
  keys: [
    { name: 'studentId' as const, weight: 0.4 },
    { name: 'studentName' as const, weight: 0.5 },
    { name: 'section' as const, weight: 0.05 },
    { name: 'email' as const, weight: 0.05 },
  ],
  threshold: 0.35,       // tolerant enough for typos
  distance: 100,
  includeScore: true,
  minMatchCharLength: 1,
  shouldSort: true,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function StudentSearchCombobox({
  students,
  value,
  onChange,
  onSelect,
  placeholder = 'Search by ID, name…',
  maxSuggestions = 8,
  debounceMs = 200,
  className = '',
  showResultCount = false,
  filteredCount,
}: StudentSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce the search text for Fuse (avoids re-indexing on every keystroke)
  const debouncedQuery = useDebounce(value, debounceMs);

  // Build Fuse index — memoised so it only rebuilds when data changes
  const fuse = useMemo(() => new Fuse(students, FUSE_OPTIONS), [students]);

  // Run the fuzzy search
  const suggestions = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return fuse
      .search(debouncedQuery)
      .slice(0, maxSuggestions)
      .map((r) => ({ ...r.item, _score: r.score }));
  }, [fuse, debouncedQuery, maxSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightIdx(-1);
  }, [suggestions]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-suggestion]');
      items[highlightIdx]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightIdx((prev) => (prev + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
            handleSelect(suggestions[highlightIdx]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, suggestions, highlightIdx],
  );

  const handleSelect = (student: SearchableStudent) => {
    onChange(student.studentName);
    setIsOpen(false);
    onSelect?.(student);
  };

  /** Highlight the matched portion of text */
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-amber-200/70 text-inherit rounded-sm px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value.trim()) {
              setIsOpen(true);
            } else {
              setIsOpen(false);
            }
          }}
          onFocus={() => {
            if (value.trim() && suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-20"
          autoComplete="off"
        />

        {/* Right-side badges / clear button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {showResultCount && value.trim() && filteredCount !== undefined && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
              {filteredCount} result{filteredCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full bg-popover border rounded-lg shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
          role="listbox"
        >
          <div className="px-2.5 py-1.5 border-b bg-muted/40">
            <span className="text-[11px] text-muted-foreground font-medium">
              Suggestions — {suggestions.length} match{suggestions.length !== 1 ? 'es' : ''}
            </span>
          </div>
          <div className="max-h-[260px] overflow-y-auto py-1">
            {suggestions.map((s, idx) => (
              <button
                key={s.studentId}
                data-suggestion
                type="button"
                className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors cursor-pointer ${
                  idx === highlightIdx
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted/60'
                }`}
                onMouseEnter={() => setHighlightIdx(idx)}
                onClick={() => handleSelect(s)}
                role="option"
                aria-selected={idx === highlightIdx}
              >
                <div className="w-8 h-8 rounded-full bg-[#1a472a]/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-[#1a472a]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {highlightMatch(s.studentName, debouncedQuery)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {highlightMatch(s.studentId, debouncedQuery)}
                    {s.section && ` • ${s.section}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
