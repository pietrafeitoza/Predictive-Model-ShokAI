import { Eraser, Flame, ListFilter, RotateCcw, Table2, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useDashboardState } from './dashboard-state';

export const OPEN_COMMAND_PALETTE_EVENT = 'shokai:open-command-palette';

interface Command {
  group: string;
  icon: LucideIcon;
  keywords: string;
  label: string;
  run(): void;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function CommandPalette() {
  const { clearFilters, setFilterValues } = useDashboardState();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;

      return (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (event.key === '/' && !isEditableTarget(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    }

    function handleOpenEvent() {
      setOpen(true);
    }

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
    };
  }, []);

  const commands = useMemo<Command[]>(
    () => [
      {
        group: 'Filters',
        icon: Flame,
        keywords: 'high opportunity tier priority',
        label: 'Show high-opportunity records only',
        run: () => setFilterValues('opportunityTiers', ['high']),
      },
      {
        group: 'Filters',
        icon: Eraser,
        keywords: 'clear reset remove all',
        label: 'Clear all filters',
        run: () => clearFilters(),
      },
      {
        group: 'Filters',
        icon: ListFilter,
        keywords: 'open refine controls',
        label: 'Go to filters',
        run: () => scrollToSection('dashboard-filters-title'),
      },
      {
        group: 'Navigation',
        icon: Table2,
        keywords: 'ranking records table',
        label: 'Go to opportunity ranking',
        run: () => scrollToSection('dashboard-ranking-title'),
      },
      {
        group: 'Navigation',
        icon: RotateCcw,
        keywords: 'top summary indicators overview',
        label: 'Go to summary indicators',
        run: () => scrollToSection('dashboard-summary-title'),
      },
    ],
    [clearFilters, setFilterValues],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return commands;

    return commands.filter((command) =>
      `${command.label} ${command.keywords}`.toLowerCase().includes(normalized),
    );
  }, [commands, query]);

  function runCommand(command: Command) {
    command.run();
    setOpen(false);
    setQuery('');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery('');
      }}
    >
      <DialogContent className="p-0" onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search for dashboard actions and run them with Enter.
        </DialogDescription>

        <div className="border-b border-border px-4 py-3">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && filtered[0]) {
                event.preventDefault();
                runCommand(filtered[0]);
              }
            }}
            placeholder="Search actions…"
            aria-label="Search actions"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-grey-400"
          />
        </div>

        <div className="max-h-[22rem] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No actions match “{query}”.
            </p>
          ) : (
            <ul className="grid gap-0.5">
              {filtered.map((command) => {
                const Icon = command.icon;

                return (
                  <li key={command.label}>
                    <button
                      type="button"
                      onClick={() => runCommand(command)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-grey-50 focus-visible:bg-grey-50 focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          'grid size-7 shrink-0 place-items-center rounded-md bg-ocean-50 text-ocean-700',
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink">{command.label}</span>
                      <span className="shrink-0 font-mono text-[0.625rem] tracking-[0.1em] text-grey-400 uppercase">
                        {command.group}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-grey-50/60 px-4 py-2 text-[0.6875rem] text-muted-foreground">
          <span>Actions</span>
          <span className="font-mono">
            <kbd className="rounded border border-border bg-white px-1.5 py-0.5">↵</kbd> to run
            <span className="mx-2 text-grey-300">·</span>
            <kbd className="rounded border border-border bg-white px-1.5 py-0.5">esc</kbd> to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
