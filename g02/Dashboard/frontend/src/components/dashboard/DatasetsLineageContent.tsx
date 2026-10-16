import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDatasetCatalog } from '../../hooks/useDatasetCatalog';
import type { DashboardApiService } from '../../services/dashboard.service';

interface DatasetsLineageContentProps {
  accessToken: string;
  onUnauthorized(): void;
  service: DashboardApiService;
}

export function DatasetsLineageContent({
  accessToken,
  onUnauthorized,
  service,
}: DatasetsLineageContentProps) {
  const { error, isLoading, response, retry } = useDatasetCatalog(service, accessToken, onUnauthorized);

  if (isLoading) {
    return (
      <div className="min-h-22 rounded-2xl border border-border bg-white/70 p-6 text-muted-foreground" role="status" aria-busy="true">
        Loading dataset lineage…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full max-w-[480px] items-center justify-between gap-4 rounded-xl border border-danger-border bg-danger-surface p-4 text-[0.8125rem] text-danger" role="alert">
        <span>We could not load the dataset lineage.</span>
        <Button type="button" variant="outline" size="sm" onClick={retry} className="border-current text-danger hover:bg-card hover:text-danger">
          Retry
        </Button>
      </div>
    );
  }

  const sources = response?.data.sources ?? [];
  const lineage = response?.data.lineage ?? [];
  const nameByKey = new Map(sources.map((source) => [source.key, source.name]));

  if (lineage.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white/70 p-6 text-[0.8125rem] text-muted-foreground" role="status">
        No lineage edges are catalogued yet.
      </div>
    );
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-white p-5" aria-labelledby="dataset-lineage-title">
      <div className="grid gap-1">
        <h2 id="dataset-lineage-title" className="font-heading text-lg font-bold text-navy">
          Lineage
        </h2>
        <p className="text-[0.8125rem] text-muted-foreground">
          How the documented pipeline artifacts feed one another, from raw ANS claims to the shipped
          prediction base.
        </p>
      </div>

      <ul className="grid gap-2">
        {lineage.map((edge) => (
          <li
            key={`${edge.upstreamKey}:${edge.upstreamVersion}->${edge.downstreamKey}:${edge.downstreamVersion}:${edge.relation}`}
            className="grid gap-2 rounded-xl border border-border bg-white/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center"
          >
            <div className="grid gap-0.5">
              <span className="text-[0.8125rem] font-medium text-navy">
                {nameByKey.get(edge.upstreamKey) ?? edge.upstreamKey}
              </span>
              <span className="font-mono text-[0.6875rem] text-muted-foreground">{edge.upstreamVersion}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
              <span className="rounded-full border border-border bg-grey-50 px-2 py-0.5 font-mono text-[0.625rem] tracking-[0.08em] uppercase">
                {edge.relation}
              </span>
            </div>
            <div className="grid gap-0.5 sm:text-right">
              <span className="text-[0.8125rem] font-medium text-navy">
                {nameByKey.get(edge.downstreamKey) ?? edge.downstreamKey}
              </span>
              <span className="font-mono text-[0.6875rem] text-muted-foreground">{edge.downstreamVersion}</span>
            </div>
            {edge.description ? (
              <p className="text-[0.75rem] leading-normal text-muted-foreground sm:col-span-3">{edge.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
