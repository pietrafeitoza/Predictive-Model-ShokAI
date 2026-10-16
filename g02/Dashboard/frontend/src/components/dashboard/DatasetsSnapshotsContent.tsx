import type { DatasetSnapshot, DatasetSnapshotStatus, DatasetSource } from '@shokai/contracts';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { useDatasetCatalog } from '../../hooks/useDatasetCatalog';
import type { DashboardApiService } from '../../services/dashboard.service';

interface DatasetsSnapshotsContentProps {
  accessToken: string;
  onUnauthorized(): void;
  service: DashboardApiService;
}

interface SnapshotRow {
  source: DatasetSource;
  snapshot: DatasetSnapshot;
}

type SnapshotSortKey =
  | 'source'
  | 'version'
  | 'rowCount'
  | 'columnCount'
  | 'period'
  | 'status'
  | 'storagePath';

type SortDirection = 'asc' | 'desc';

interface SortState {
  direction: SortDirection;
  key: SnapshotSortKey;
}

const snapshotsStatusStyles: Record<DatasetSnapshotStatus, string> = {
  available: 'border-leaf/40 bg-leaf-100 text-leaf-700',
  pending: 'border-citrine/60 bg-citrine-100 text-citrine-700',
  deprecated: 'border-grey-200 bg-grey-100 text-grey-800',
};

const snapshotStatusLabels: Record<DatasetSnapshotStatus, string> = {
  available: 'Available',
  pending: 'Pending',
  deprecated: 'Deprecated',
};

const snapshotStatusOptions: DatasetSnapshotStatus[] = ['available', 'pending', 'deprecated'];

const count = new Intl.NumberFormat('en-US');

const selectClassName =
  'h-9 rounded-lg border border-border bg-white px-2.5 text-[0.8125rem] text-grey-700 outline-none transition-colors hover:border-ocean/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function formatPeriod(start: string | null, end: string | null): string {
  if (start && end) return `${start} → ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return '—';
}

function compareRows(left: SnapshotRow, right: SnapshotRow, key: SnapshotSortKey): number {
  switch (key) {
    case 'source':
      return left.source.name.localeCompare(right.source.name);
    case 'version':
      return left.snapshot.version.localeCompare(right.snapshot.version, undefined, {
        numeric: true,
      });
    case 'rowCount':
      return (left.snapshot.rowCount ?? -1) - (right.snapshot.rowCount ?? -1);
    case 'columnCount':
      return (left.snapshot.columnCount ?? -1) - (right.snapshot.columnCount ?? -1);
    case 'period':
      return (left.snapshot.periodStart ?? '').localeCompare(right.snapshot.periodStart ?? '');
    case 'status':
      return left.snapshot.status.localeCompare(right.snapshot.status);
    case 'storagePath':
      return (left.snapshot.storagePath ?? '').localeCompare(right.snapshot.storagePath ?? '');
  }
}

interface SortableHeadProps {
  align?: 'left' | 'right';
  label: string;
  onSort(key: SnapshotSortKey): void;
  sortKey: SnapshotSortKey;
  sortState: SortState;
}

function SortableHead({ align = 'left', label, onSort, sortKey, sortState }: SortableHeadProps) {
  const isActive = sortState.key === sortKey;
  const Icon = !isActive ? ArrowUpDown : sortState.direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <TableHead
      scope="col"
      aria-sort={isActive ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn(align === 'right' && 'text-right')}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex w-full items-center gap-1.5 rounded text-left font-mono text-[0.625rem] tracking-[0.1em] uppercase transition-colors hover:text-navy',
          align === 'right' && 'justify-end',
        )}
      >
        <span>{label}</span>
        <Icon
          className={cn('size-3.5', isActive ? 'text-ocean' : 'text-grey-400')}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  );
}

export function DatasetsSnapshotsContent({
  accessToken,
  onUnauthorized,
  service,
}: DatasetsSnapshotsContentProps) {
  const { error, isLoading, response, retry } = useDatasetCatalog(service, accessToken, onUnauthorized);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DatasetSnapshotStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortState, setSortState] = useState<SortState>({ key: 'source', direction: 'asc' });

  const sources = response?.data.sources ?? [];
  const allRows = useMemo<SnapshotRow[]>(
    () => sources.flatMap((source) => source.snapshots.map((snapshot) => ({ source, snapshot }))),
    [sources],
  );

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = allRows.filter(({ source, snapshot }) => {
      if (status !== 'all' && snapshot.status !== status) return false;
      if (sourceFilter !== 'all' && source.key !== sourceFilter) return false;
      if (!query) return true;

      return [source.name, snapshot.version, snapshot.storagePath ?? ''].some((value) =>
        value.toLowerCase().includes(query),
      );
    });

    return [...filtered].sort((left, right) => {
      const result = compareRows(left, right, sortState.key);
      return sortState.direction === 'asc' ? result : -result;
    });
  }, [allRows, search, sortState, sourceFilter, status]);

  function handleSort(key: SnapshotSortKey) {
    setSortState((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  }

  function handleExport() {
    downloadCsv('shokai-dataset-snapshots.csv', [
      ['Source', 'Version', 'Rows', 'Columns', 'Period start', 'Period end', 'Status', 'Storage path', 'Checksum'],
      ...visibleRows.map(({ source, snapshot }) => [
        source.name,
        snapshot.version,
        snapshot.rowCount,
        snapshot.columnCount,
        snapshot.periodStart,
        snapshot.periodEnd,
        snapshot.status,
        snapshot.storagePath,
        snapshot.checksum,
      ]),
    ]);
  }

  if (isLoading) {
    return (
      <div className="min-h-22 rounded-2xl border border-border bg-white/70 p-6 text-muted-foreground" role="status" aria-busy="true">
        Loading dataset snapshots…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full max-w-[480px] items-center justify-between gap-4 rounded-xl border border-danger-border bg-danger-surface p-4 text-[0.8125rem] text-danger" role="alert">
        <span>We could not load the dataset snapshots.</span>
        <Button type="button" variant="outline" size="sm" onClick={retry} className="border-current text-danger hover:bg-card hover:text-danger">
          Retry
        </Button>
      </div>
    );
  }

  if (allRows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white/70 p-6 text-[0.8125rem] text-muted-foreground" role="status">
        No snapshots are catalogued yet.
      </div>
    );
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-white p-5" aria-labelledby="dataset-snapshots-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="dataset-snapshots-title" className="font-heading text-lg font-bold text-navy">
          Snapshots
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={visibleRows.length === 0}
          className="h-9"
        >
          <Download className="size-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex min-w-[200px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search snapshots…"
            aria-label="Search snapshots"
            className="h-9 pl-8"
          />
        </div>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as DatasetSnapshotStatus | 'all')}
          aria-label="Filter by status"
          className={selectClassName}
        >
          <option value="all">All statuses</option>
          {snapshotStatusOptions.map((option) => (
            <option key={option} value={option}>
              {snapshotStatusLabels[option]}
            </option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
          aria-label="Filter by source"
          className={cn(selectClassName, 'max-w-[220px]')}
        >
          <option value="all">All sources</option>
          {sources.map((source) => (
            <option key={source.key} value={source.key}>
              {source.name}
            </option>
          ))}
        </select>

        <span className="ml-auto font-mono text-[0.6875rem] text-grey-600">
          {visibleRows.length.toLocaleString('en-US')} of {allRows.length.toLocaleString('en-US')}
        </span>
      </div>

      {visibleRows.length === 0 ? (
        <div className="animate-fade-in rounded-xl border border-border bg-white/70 p-6 text-[0.8125rem] text-muted-foreground" role="status">
          No snapshots match the current search and filters.
        </div>
      ) : (
        <div className="animate-fade-in overflow-x-auto" tabIndex={0} role="region" aria-label="Dataset snapshots table">
          <table className="w-full border-collapse text-left text-[0.8125rem]">
            <TableHeader>
              <TableRow>
                <SortableHead label="Source" sortKey="source" sortState={sortState} onSort={handleSort} />
                <SortableHead label="Version" sortKey="version" sortState={sortState} onSort={handleSort} />
                <SortableHead label="Rows" sortKey="rowCount" sortState={sortState} onSort={handleSort} align="right" />
                <SortableHead label="Columns" sortKey="columnCount" sortState={sortState} onSort={handleSort} align="right" />
                <SortableHead label="Period" sortKey="period" sortState={sortState} onSort={handleSort} />
                <SortableHead label="Status" sortKey="status" sortState={sortState} onSort={handleSort} />
                <SortableHead label="Storage path" sortKey="storagePath" sortState={sortState} onSort={handleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map(({ source, snapshot }) => (
                <TableRow key={`${source.key}:${snapshot.version}`}>
                  <TableCell className="font-medium text-navy">{source.name}</TableCell>
                  <TableCell className="font-mono text-[0.75rem]">{snapshot.version}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {typeof snapshot.rowCount === 'number' ? count.format(snapshot.rowCount) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {typeof snapshot.columnCount === 'number' ? count.format(snapshot.columnCount) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatPeriod(snapshot.periodStart, snapshot.periodEnd)}</TableCell>
                  <TableCell>
                    <Badge className={cn('border', snapshotsStatusStyles[snapshot.status])}>
                      {snapshotStatusLabels[snapshot.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[0.6875rem] text-muted-foreground [overflow-wrap:anywhere]">
                    {snapshot.storagePath ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      )}
    </section>
  );
}
