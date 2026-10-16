import type { DatasetKind, DatasetSensitivity, DatasetSource } from '@shokai/contracts';
import { ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useDatasetCatalog } from '../../hooks/useDatasetCatalog';
import type { DashboardApiService } from '../../services/dashboard.service';

interface DatasetsSourcesContentProps {
  accessToken: string;
  onUnauthorized(): void;
  service: DashboardApiService;
}

const kindLabels: Record<DatasetKind, string> = {
  raw: 'Raw',
  interim: 'Interim',
  processed: 'Processed',
  reference: 'Reference',
  model_artifact: 'Model artifact',
};

const kindOptions: DatasetKind[] = ['raw', 'interim', 'processed', 'reference', 'model_artifact'];

const sensitivityStyles: Record<DatasetSensitivity, string> = {
  public: 'border-leaf/40 bg-leaf-100 text-leaf-700',
  internal: 'border-ocean-100 bg-ocean-50 text-ocean-700',
  partner_confidential: 'border-danger-border bg-danger-surface text-danger',
};

const sensitivityLabels: Record<DatasetSensitivity, string> = {
  public: 'Public',
  internal: 'Internal',
  partner_confidential: 'Partner confidential',
};

const sensitivityOptions: DatasetSensitivity[] = ['public', 'internal', 'partner_confidential'];

const selectClassName =
  'h-9 rounded-lg border border-border bg-white px-2.5 text-[0.8125rem] text-grey-700 outline-none transition-colors hover:border-ocean/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function DatasetsSourcesContent({
  accessToken,
  onUnauthorized,
  service,
}: DatasetsSourcesContentProps) {
  const { error, isLoading, response, retry } = useDatasetCatalog(service, accessToken, onUnauthorized);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<DatasetKind | 'all'>('all');
  const [sensitivity, setSensitivity] = useState<DatasetSensitivity | 'all'>('all');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  const sources = response?.data.sources ?? [];

  const filteredSources = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sources.filter((source) => {
      if (kind !== 'all' && source.kind !== kind) return false;
      if (sensitivity !== 'all' && source.sensitivity !== sensitivity) return false;
      if (!query) return true;

      return [source.name, source.key, source.provider ?? '', source.description ?? ''].some(
        (value) => value.toLowerCase().includes(query),
      );
    });
  }, [sources, kind, search, sensitivity]);

  const allExpanded =
    filteredSources.length > 0 && filteredSources.every((source) => expandedKeys.has(source.key));

  function toggleExpanded(key: string) {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setExpandedKeys(new Set(filteredSources.map((source) => source.key)));
  }

  function collapseAll() {
    setExpandedKeys(new Set());
  }

  if (isLoading) {
    return (
      <div className="min-h-22 rounded-2xl border border-border bg-white/70 p-6 text-muted-foreground" role="status" aria-busy="true">
        Loading dataset sources…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full max-w-[480px] items-center justify-between gap-4 rounded-xl border border-danger-border bg-danger-surface p-4 text-[0.8125rem] text-danger" role="alert">
        <span>We could not load the dataset catalog.</span>
        <Button type="button" variant="outline" size="sm" onClick={retry} className="border-current text-danger hover:bg-card hover:text-danger">
          Retry
        </Button>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white/70 p-6 text-[0.8125rem] text-muted-foreground" role="status">
        The dataset catalog is available when the dashboard is connected to Supabase.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <section
        className="sticky top-[4.75rem] z-20 grid gap-3 rounded-2xl border border-border bg-white/90 p-3.5 shadow-[0_1px_2px_rgba(5,46,92,0.04),0_14px_30px_-24px_rgba(5,46,92,0.4)] backdrop-blur-xl"
        aria-label="Dataset filters"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex min-w-[200px] flex-1 items-center">
            <Search className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search datasets…"
              aria-label="Search datasets"
              className="h-9 pl-8"
            />
          </div>

          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as DatasetKind | 'all')}
            aria-label="Filter by kind"
            className={selectClassName}
          >
            <option value="all">All kinds</option>
            {kindOptions.map((option) => (
              <option key={option} value={option}>
                {kindLabels[option]}
              </option>
            ))}
          </select>

          <select
            value={sensitivity}
            onChange={(event) =>
              setSensitivity(event.target.value as DatasetSensitivity | 'all')
            }
            aria-label="Filter by sensitivity"
            className={selectClassName}
          >
            <option value="all">All sensitivities</option>
            {sensitivityOptions.map((option) => (
              <option key={option} value={option}>
                {sensitivityLabels[option]}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[0.6875rem] text-grey-600">
              {filteredSources.length} of {sources.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={allExpanded ? collapseAll : expandAll}
              disabled={filteredSources.length === 0}
              className="h-9"
            >
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </Button>
          </div>
        </div>
      </section>

      {filteredSources.length === 0 ? (
        <div className="animate-fade-in rounded-2xl border border-border bg-white/70 p-6 text-[0.8125rem] text-muted-foreground" role="status">
          No datasets match the current search and filters.
        </div>
      ) : (
        filteredSources.map((source) => (
          <SourceCard
            key={source.key}
            source={source}
            isExpanded={expandedKeys.has(source.key)}
            onToggle={() => toggleExpanded(source.key)}
          />
        ))
      )}
    </div>
  );
}

interface SourceCardProps {
  isExpanded: boolean;
  onToggle(): void;
  source: DatasetSource;
}

function SourceCard({ isExpanded, onToggle, source }: SourceCardProps) {
  return (
    <section className="grid animate-fade-up gap-3 rounded-2xl border border-border bg-white p-5" aria-label={source.name}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-bold text-navy">{source.name}</h2>
            <Badge className="border border-border bg-grey-100 text-grey-800">{kindLabels[source.kind]}</Badge>
            <Badge className={cn('border', sensitivityStyles[source.sensitivity])}>
              {sensitivityLabels[source.sensitivity]}
            </Badge>
          </div>
          <span className="font-mono text-[0.6875rem] text-muted-foreground">{source.key}</span>
        </div>
        <div className="grid gap-0.5 text-right text-[0.75rem] text-muted-foreground">
          {source.provider ? <span>{source.provider}</span> : null}
          {source.updateFrequency ? <span>Updated {source.updateFrequency}</span> : null}
        </div>
      </div>

      {source.description ? (
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">{source.description}</p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-[0.75rem] text-muted-foreground">
        {source.snapshots.map((snapshot) => (
          <span key={snapshot.version} className="rounded-md border border-border bg-grey-50 px-2 py-0.5 font-mono">
            {snapshot.version}
            {typeof snapshot.rowCount === 'number' ? ` · ${snapshot.rowCount.toLocaleString('en-US')} rows` : ''}
            {typeof snapshot.columnCount === 'number' ? ` · ${snapshot.columnCount} cols` : ''}
          </span>
        ))}
      </div>

      {source.columns.length > 0 ? (
        <div className="border-t border-border pt-2">
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={onToggle}
            className="flex w-fit items-center gap-1.5 rounded text-[0.8125rem] font-medium text-ocean-700 transition-colors hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
          >
            <ChevronRight
              className={cn('size-4 transition-transform', isExpanded && 'rotate-90')}
              aria-hidden="true"
            />
            {source.columns.length} documented columns
          </button>

          {isExpanded ? (
            <div className="mt-2 animate-fade-in overflow-x-auto" tabIndex={0} role="region" aria-label={`${source.name} columns`}>
              <table className="w-full border-collapse text-left text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-4 font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">Column</th>
                    <th scope="col" className="py-2 pr-4 font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">Type</th>
                    <th scope="col" className="py-2 pr-4 font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">Class</th>
                    <th scope="col" className="py-2 font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">Origin</th>
                  </tr>
                </thead>
                <tbody>
                  {source.columns.map((column) => (
                    <tr key={column.name} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 pr-4 font-mono text-ink">{column.name}</td>
                      <td className="py-1.5 pr-4 text-muted-foreground">{column.dataType ?? '—'}</td>
                      <td className="py-1.5 pr-4 text-muted-foreground">{column.classification ?? '—'}</td>
                      <td className="py-1.5 text-muted-foreground">{column.origin ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
