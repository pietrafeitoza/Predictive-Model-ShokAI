import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export interface FilterOption {
  label: string;
  value: string;
}

interface MultiSelectFilterProps {
  disabled?: boolean;
  label: string;
  onClear(): void;
  onToggle(value: string): void;
  options: FilterOption[];
  searchable?: boolean;
  values: string[];
}

export function MultiSelectFilter({
  disabled,
  label,
  onClear,
  onToggle,
  options,
  searchable,
  values,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const showSearch = searchable ?? options.length > 9;

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;

    const normalizedQuery = query.trim().toLowerCase();

    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  const selectedLabels = values
    .map((value) => options.find((option) => option.value === value)?.label ?? value)
    .filter(Boolean);

  const triggerLabel =
    selectedLabels.length === 0
      ? 'All'
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} selected`;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-[0.8125rem] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-colors outline-none',
          'focus-visible:border-ocean focus-visible:ring-2 focus-visible:ring-ocean-100',
          'disabled:cursor-not-allowed disabled:bg-grey-50 disabled:text-grey-400',
          values.length > 0 ? 'border-ocean/45 text-navy' : 'border-border text-grey-600',
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-grey-400 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute top-[calc(100%+0.375rem)] left-0 z-50 w-full min-w-[15rem] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-grey-50/70 px-3 py-2">
            <span className="font-mono text-[0.625rem] tracking-[0.1em] text-grey-600 uppercase">
              {label}
            </span>
            {values.length > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="text-[0.6875rem] font-medium text-ocean-700 hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>

          {showSearch ? (
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="size-3.5 shrink-0 text-grey-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label}`}
                className="w-full bg-transparent text-[0.8125rem] text-ink outline-none placeholder:text-grey-400"
              />
            </div>
          ) : null}

          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="max-h-64 overflow-y-auto p-1"
          >
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">No matches.</p>
            ) : (
              filteredOptions.map((option) => {
                const selected = values.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onToggle(option.value)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[0.8125rem] transition-colors',
                      'focus-visible:bg-accent focus-visible:outline-none',
                      selected ? 'bg-ocean-50 text-navy' : 'text-grey-800 hover:bg-grey-50',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors',
                        selected ? 'border-ocean bg-ocean text-white' : 'border-grey-200 bg-white',
                      )}
                      aria-hidden="true"
                    >
                      {selected ? <Check className="size-3" /> : null}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
