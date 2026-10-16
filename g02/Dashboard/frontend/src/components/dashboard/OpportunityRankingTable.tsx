import type {
  DashboardFilters,
  OpportunityTier,
  PredictionRecord,
} from '@shokai/contracts';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { formatFullNumber } from './charts/chart-format';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Download,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

const PAGE_SIZE = 10;

const treatmentLineLabels: Record<PredictionRecord['treatmentLine'], string> = {
  staging: 'Staging',
  neoadjuvant: 'Neoadjuvant',
  adjuvant: 'Adjuvant',
  advanced: 'Advanced',
  unknown: 'Unknown',
};

const opportunityTierLabels: Record<OpportunityTier, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const opportunityTierOrder: Record<OpportunityTier, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const tierBadgeClasses: Record<OpportunityTier, string> = {
  low: 'border-grey-200 bg-grey-100 text-grey-800',
  medium: 'border-citrine/60 bg-citrine-100 text-citrine-700',
  high: 'border-leaf/50 bg-leaf-100 text-leaf-700',
};

const tierIcons: Record<OpportunityTier, LucideIcon> = {
  low: ArrowDown,
  medium: ArrowRight,
  high: ArrowUp,
};

type SortKey =
  | 'operator'
  | 'providerState'
  | 'treatmentLine'
  | 'forecastMonth'
  | 'predictedDemandVolume'
  | 'opportunityTier';

interface OpportunityRankingTableProps {
  error: boolean;
  filters: DashboardFilters;
  isLoading: boolean;
  isRefreshing: boolean;
  onClearFilters(): void;
  onRetry(): void;
  predictions?: readonly PredictionRecord[];
}

const formatMonth = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${value}-01T00:00:00Z`));

const columns: ColumnDef<PredictionRecord>[] = [
  { id: 'rank', header: 'Rank' },
  {
    id: 'operator',
    accessorFn: (row) => row.operatorName ?? row.operatorId,
    header: 'Operator',
    sortingFn: (left, right) =>
      (left.original.operatorName ?? left.original.operatorId).localeCompare(
        right.original.operatorName ?? right.original.operatorId,
      ) || left.original.operatorId.localeCompare(right.original.operatorId),
  },
  { id: 'providerState', accessorKey: 'providerState', header: 'Provider state' },
  {
    id: 'treatmentLine',
    accessorFn: (row) => treatmentLineLabels[row.treatmentLine],
    header: 'Treatment line',
    sortingFn: (left, right) =>
      treatmentLineLabels[left.original.treatmentLine].localeCompare(
        treatmentLineLabels[right.original.treatmentLine],
      ),
  },
  { id: 'forecastMonth', accessorKey: 'forecastMonth', header: 'Forecast month' },
  {
    id: 'predictedDemandVolume',
    accessorKey: 'predictedDemandVolume',
    header: 'Estimated demand volume',
  },
  {
    id: 'opportunityTier',
    accessorFn: (row) => opportunityTierOrder[row.opportunityTier],
    header: 'Opportunity tier',
    sortDescFirst: false,
  },
];

const headerCellClass =
  'h-12 bg-grey-50/80 px-3.5 text-left font-mono text-[0.625rem] tracking-[0.1em] whitespace-nowrap text-grey-600 uppercase backdrop-blur first:pl-[22px] last:pr-[22px]';

interface SortableHeaderProps {
  align?: 'left' | 'right';
  column: Column<PredictionRecord, unknown>;
  label: string;
}

function SortableHeader({ align = 'left', column, label }: SortableHeaderProps) {
  const sorted = column.getIsSorted();
  const isActive = sorted !== false;
  const nextDirection = isActive && sorted === 'asc' ? 'descending' : 'ascending';

  return (
    <TableHead
      scope="col"
      aria-sort={isActive ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn(headerCellClass, align === 'right' && 'text-right')}
    >
      <button
        type="button"
        aria-label={`Sort by ${label.toLowerCase()} ${nextDirection}`}
        onClick={column.getToggleSortingHandler()}
        className={cn(
          'inline-flex min-h-10 w-full items-center gap-1.5 rounded-[5px] text-left text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean',
          align === 'right' && 'justify-end',
        )}
      >
        <span>{label}</span>
        <span className={cn('text-xs', isActive ? 'text-ocean' : 'text-grey-400')} aria-hidden="true">
          {isActive ? (sorted === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </TableHead>
  );
}

export function OpportunityRankingTable({
  error,
  filters,
  isLoading,
  isRefreshing,
  onClearFilters,
  onRetry,
  predictions = [],
}: OpportunityRankingTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'predictedDemandVolume', desc: true },
  ]);
  const [selectedRecord, setSelectedRecord] = useState<PredictionRecord | null>(null);
  const filterKey = JSON.stringify(filters);
  const hasActiveFilters = Object.values(filters).some((values) => Boolean(values?.length));

  const table = useReactTable({
    data: predictions as PredictionRecord[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  useEffect(() => {
    table.setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, sorting]);

  const rows = table.getRowModel().rows;
  const totalRows = table.getPrePaginationRowModel().rows.length;
  const pageCount = Math.max(1, table.getPageCount());
  const { pageIndex, pageSize } = table.getState().pagination;
  const startIndex = pageIndex * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRows);

  const resultText = error && totalRows === 0
    ? 'Opportunity records unavailable'
    : totalRows === 0
      ? 'Showing 0 records'
      : `Showing ${startIndex + 1}–${endIndex} of ${totalRows} records`;

  const operatorColumn = table.getColumn('operator')!;
  const providerStateColumn = table.getColumn('providerState')!;
  const treatmentLineColumn = table.getColumn('treatmentLine')!;
  const forecastMonthColumn = table.getColumn('forecastMonth')!;
  const predictedDemandColumn = table.getColumn('predictedDemandVolume')!;
  const opportunityTierColumn = table.getColumn('opportunityTier')!;

  function handleDownloadCsv() {
    const rows = table.getSortedRowModel().rows.map((row, index) => {
      const prediction = row.original;

      return [
        index + 1,
        prediction.operatorName ?? '',
        prediction.operatorId,
        prediction.providerState,
        treatmentLineLabels[prediction.treatmentLine],
        prediction.forecastMonth,
        prediction.predictedDemandVolume,
        opportunityTierLabels[prediction.opportunityTier],
      ];
    });

    downloadCsv('opportunity-ranking.csv', [
      [
        'Rank',
        'Operator',
        'Operator ID',
        'Provider state',
        'Treatment line',
        'Forecast month',
        'Estimated demand volume',
        'Opportunity tier',
      ],
      ...rows,
    ]);
  }

  return (
    <section
      className="relative grid min-w-0 overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(5,46,92,0.04),0_16px_34px_-26px_rgba(5,46,92,0.45)]"
      aria-labelledby="dashboard-ranking-title"
      aria-busy={isLoading || isRefreshing}
    >
      <div className="flex min-h-[100px] items-start justify-between gap-4 border-b border-border px-[22px] py-[18px] max-sm:min-h-0 max-sm:px-[18px]">
        <div className="grid gap-1.5">
          <span className="text-[0.75rem] font-medium text-ocean-600">
            Prioritized records
          </span>
          <h2
            id="dashboard-ranking-title"
            className="font-heading text-lg font-bold tracking-[-0.02em] text-navy"
          >
            Opportunity ranking
          </h2>
          <p id="dashboard-ranking-description" className="max-w-[72ch] text-[0.8125rem] leading-normal text-muted-foreground">
            Each record represents estimated demand volume by operator, treatment line, provider
            state, and forecast month.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isRefreshing ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-ocean-50 px-2.5 py-1 font-mono text-[0.6875rem] text-ocean-700"
              role="status"
            >
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              Refreshing…
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={isLoading || totalRows === 0}
            aria-label="Download filtered records as CSV"
          >
            <Download />
            <span className="max-sm:hidden">Download CSV</span>
          </Button>
        </div>
      </div>

      {error ? (
        <div
          className="mx-[22px] mt-4 flex items-center justify-between gap-4 rounded-lg border border-danger-border bg-danger-surface px-3.5 py-3 text-[0.8125rem] text-danger"
          role="alert"
        >
          <span>We could not load the opportunity records.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-current text-danger hover:bg-card hover:text-danger"
          >
            Retry
          </Button>
        </div>
      ) : null}

      <div
        className="min-w-0 overflow-x-auto overscroll-x-contain focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[#dcedf9]"
        tabIndex={0}
        aria-label="Opportunity ranking table"
      >
        <table
          className="w-full min-w-[1040px] border-collapse caption-bottom text-[0.8125rem] text-grey-800"
          aria-describedby="dashboard-ranking-description"
        >
          <TableCaption className="sr-only">
            Opportunity ranking of estimated demand-volume prediction records. Rank follows the
            current display sort and does not represent unique operators.
          </TableCaption>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead scope="col" className={headerCellClass}>
                Rank
              </TableHead>
              <SortableHeader column={operatorColumn} label="Operator" />
              <SortableHeader column={providerStateColumn} label="Provider state" />
              <SortableHeader column={treatmentLineColumn} label="Treatment line" />
              <SortableHeader column={forecastMonthColumn} label="Forecast month" />
              <SortableHeader
                align="right"
                column={predictedDemandColumn}
                label="Estimated demand volume"
              />
              <SortableHeader column={opportunityTierColumn} label="Opportunity tier" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index} data-testid="ranking-skeleton-row">
                  {Array.from({ length: 7 }, (__, cellIndex) => (
                    <TableCell key={cellIndex} className="h-[54px] px-3.5 first:pl-[22px] last:pr-[22px]">
                      <span className="block h-3.5 w-[76%] animate-pulse rounded bg-grey-100" aria-hidden="true" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error && predictions.length === 0 ? (
              <TableRow>
                <TableCell className="h-[250px] p-7" colSpan={7}>
                  <div className="grid place-items-center gap-2 text-center text-muted-foreground">
                    <strong className="text-sm text-navy">
                      Opportunity records are temporarily unavailable.
                    </strong>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((row, index) => {
                const prediction = row.original;
                const operatorLabel = prediction.operatorName ?? prediction.operatorId;
                const TierIcon = tierIcons[prediction.opportunityTier];

                return (
                  <TableRow
                    key={prediction.predictionId}
                    className="cursor-pointer border-border/70 transition-colors hover:bg-ocean-50/70"
                    onClick={() => setSelectedRecord(prediction)}
                  >
                    <TableCell className="h-[54px] px-3.5 font-mono text-ocean tabular-nums first:pl-[22px]">
                      {startIndex + index + 1}
                    </TableCell>
                    <TableCell className="h-[54px] px-3.5">
                      <span className="block font-medium whitespace-nowrap text-ink">
                        {operatorLabel}
                      </span>
                      {prediction.operatorName ? (
                        <span className="mt-0.5 block font-mono text-[0.6875rem] whitespace-nowrap text-grey-400">
                          {prediction.operatorId}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="h-[54px] px-3.5">{prediction.providerState}</TableCell>
                    <TableCell className="h-[54px] px-3.5">{treatmentLineLabels[prediction.treatmentLine]}</TableCell>
                    <TableCell className="h-[54px] px-3.5 font-mono whitespace-nowrap tabular-nums">
                      <time
                        dateTime={prediction.forecastMonth}
                        title={prediction.forecastMonth}
                        aria-label={`${formatMonth(prediction.forecastMonth)} (${prediction.forecastMonth})`}
                      >
                        {formatMonth(prediction.forecastMonth)}
                      </time>
                    </TableCell>
                    <TableCell className="h-[54px] px-3.5 text-right font-mono tabular-nums">
                      <data value={prediction.predictedDemandVolume} className="font-medium text-navy">
                        {formatFullNumber(prediction.predictedDemandVolume)}
                      </data>
                    </TableCell>
                    <TableCell className="h-[54px] px-3.5 last:pr-[22px]">
                      <Badge
                        variant="outline"
                        className={cn(
                          'h-[26px] min-w-[70px] justify-center gap-1.5 rounded-full text-xs font-medium',
                          tierBadgeClasses[prediction.opportunityTier],
                        )}
                      >
                        <TierIcon className="size-3.5" aria-hidden="true" />
                        {opportunityTierLabels[prediction.opportunityTier]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell className="h-[250px] p-7" colSpan={7}>
                  <div className="grid place-items-center gap-2 text-center text-muted-foreground" role="status">
                    <strong className="text-sm text-navy">
                      {hasActiveFilters
                        ? 'No opportunity records match the selected filters.'
                        : 'No opportunity records are available.'}
                    </strong>
                    {hasActiveFilters ? (
                      <>
                        <span>Clear the filters to return to the full dataset.</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={onClearFilters}
                          className="mt-1"
                        >
                          Clear filters
                        </Button>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>

      <div
        className="flex min-h-16 items-center justify-between gap-4 border-t border-border px-[22px] py-3 text-[0.8125rem] text-muted-foreground max-sm:flex-col max-sm:items-stretch max-sm:px-[18px] max-sm:pt-3.5 max-sm:pb-[18px]"
        aria-label="Opportunity ranking pagination"
      >
        <span aria-live="polite">
          {isLoading ? 'Loading opportunity records…' : resultText}
        </span>
        <div className="flex gap-2 max-sm:grid max-sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Show previous opportunity records"
            disabled={isLoading || !table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            className="max-sm:w-full"
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Show next opportunity records"
            disabled={isLoading || !table.getCanNextPage()}
            onClick={() => table.nextPage()}
            className="max-sm:w-full"
          >
            Next
          </Button>
        </div>
      </div>

      {selectedRecord ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSelectedRecord(null);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogTitle className="font-heading text-lg font-bold text-navy">
              {selectedRecord.operatorName ?? selectedRecord.operatorId}
            </DialogTitle>
            <DialogDescription className="text-[0.8125rem] text-muted-foreground">
              One estimated-demand record for {treatmentLineLabels[selectedRecord.treatmentLine]} ·{' '}
              {selectedRecord.providerState} · {formatMonth(selectedRecord.forecastMonth)}.
            </DialogDescription>

            <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <RecordField label="Operator ID" value={selectedRecord.operatorId} mono />
              <RecordField label="Provider state" value={selectedRecord.providerState} />
              <RecordField
                label="Treatment line"
                value={treatmentLineLabels[selectedRecord.treatmentLine]}
              />
              <RecordField label="Opportunity tier" value={opportunityTierLabels[selectedRecord.opportunityTier]} />
              <RecordField label="Forecast month" value={formatMonth(selectedRecord.forecastMonth)} />
              <RecordField label="Reference month" value={formatMonth(selectedRecord.referenceMonth)} />
              <RecordField
                label="Estimated demand volume"
                value={formatFullNumber(selectedRecord.predictedDemandVolume)}
                mono
              />
              <RecordField
                label="Observed volume"
                value={
                  selectedRecord.observedDemandVolume === null ||
                  selectedRecord.observedDemandVolume === undefined
                    ? 'Not recorded'
                    : formatFullNumber(selectedRecord.observedDemandVolume)
                }
                mono
              />
            </dl>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              <FlagBadge label="Target measured" value={selectedRecord.targetMeasured} />
              <FlagBadge label="Structural zero" value={selectedRecord.isStructuralZero} />
              <FlagBadge label="Recent history" value={selectedRecord.hasRecentHistory} />
              <span className="rounded-full border border-border bg-grey-50 px-2.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
                {selectedRecord.modelId} · {selectedRecord.modelVersion}
              </span>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}

function RecordField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-0.5">
      <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className={cn('text-[0.875rem] font-medium text-ink', mono && 'font-mono tabular-nums')}>
        {value}
      </dd>
    </div>
  );
}

function FlagBadge({ label, value }: { label: string; value?: boolean }) {
  if (value === undefined) return null;
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium',
        value
          ? 'border-leaf/40 bg-leaf-100 text-leaf-700'
          : 'border-grey-200 bg-grey-100 text-grey-800',
      )}
    >
      {label}: {value ? 'Yes' : 'No'}
    </span>
  );
}
