import type { DashboardSummary } from '@shokai/contracts';
import { Activity, ArrowRight, Building2, Flame, ListChecks, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatCompactNumber, formatFullNumber } from './charts/chart-format';
import { InfoTip } from './InfoTip';

interface IndicatorGridProps {
  error: boolean;
  highOpportunityActive: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  onRetry(): void;
  onShowHighOpportunity(): void;
  summary?: DashboardSummary;
}

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const indicators: Array<{
  blob: string;
  chip: string;
  description: string;
  hint: string;
  icon: LucideIcon;
  key: keyof DashboardSummary;
  title: string;
}> = [
  {
    blob: '#0069b4',
    chip: 'bg-ocean-100 text-ocean-700',
    description: 'Numeric billed-item utilization volume.',
    hint: 'Total estimated billed-item utilization volume across every record in the current view.',
    icon: Activity,
    key: 'totalEstimatedDemandVolume',
    title: 'Estimated demand volume',
  },
  {
    blob: '#00a5df',
    chip: 'bg-ocean-100 text-cyan-700',
    description: 'Number of prediction result records.',
    hint: 'Count of monthly prediction records after the active filters are applied.',
    icon: ListChecks,
    key: 'predictionCount',
    title: 'Prediction records',
  },
  {
    blob: '#2fa84f',
    chip: 'bg-leaf-100 text-leaf-700',
    description: 'Distinct operators in the filtered result.',
    hint: 'Number of unique operators represented in the current view.',
    icon: Building2,
    key: 'operatorCount',
    title: 'Operators',
  },
  {
    blob: '#efdd1f',
    chip: 'bg-citrine-100 text-citrine-700',
    description: 'Prediction records classified as high opportunity.',
    hint: 'Records whose predicted demand volume falls in the high-opportunity tier.',
    icon: Flame,
    key: 'highOpportunityRecordCount',
    title: 'High-opportunity records',
  },
];

function indicatorContext(key: keyof DashboardSummary, summary?: DashboardSummary): string | null {
  if (!summary) return null;

  const { highOpportunityRecordCount, operatorCount, predictionCount, totalEstimatedDemandVolume } =
    summary;

  switch (key) {
    case 'totalEstimatedDemandVolume':
      return predictionCount > 0
        ? `${formatCompactNumber(totalEstimatedDemandVolume / predictionCount)} avg per record`
        : 'No records in view';
    case 'predictionCount':
      return operatorCount > 0
        ? `across ${formatFullNumber(operatorCount)} operators`
        : 'No operators in view';
    case 'operatorCount':
      return operatorCount > 0
        ? `${(predictionCount / operatorCount).toFixed(1)} records per operator`
        : 'No operators in view';
    case 'highOpportunityRecordCount':
      return predictionCount > 0
        ? `${Math.round((highOpportunityRecordCount / predictionCount) * 100)}% of all records`
        : 'No records in view';
    default:
      return null;
  }
}

export function IndicatorGrid({
  error,
  highOpportunityActive,
  isLoading,
  isRefreshing,
  onRetry,
  onShowHighOpportunity,
  summary,
}: IndicatorGridProps) {
  return (
    <section className="grid gap-4" aria-labelledby="dashboard-summary-title">
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-1">
          <span className="text-[0.75rem] font-medium text-ocean-600">
            Current view
          </span>
          <h2
            id="dashboard-summary-title"
            className="font-heading text-lg font-bold tracking-[-0.02em] text-navy"
          >
            Summary indicators
          </h2>
        </div>
        {isRefreshing ? (
          <span
            className="inline-flex items-center rounded-full bg-ocean-50 px-2.5 py-1 font-mono text-[0.6875rem] text-ocean-700"
            role="status"
          >
            Refreshing…
          </span>
        ) : null}
      </div>

      {error ? (
        <div
          className="flex items-center justify-between gap-4 rounded-xl border border-danger-border bg-danger-surface px-4 py-3.5 text-[0.8125rem] text-danger"
          role="alert"
        >
          <span>We could not load the dashboard summary.</span>
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
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-busy={isLoading || isRefreshing}
      >
        {indicators.map((indicator, index) => {
          const Icon = indicator.icon;
          const context = indicatorContext(indicator.key, summary);
          const isHighOpportunityCard = indicator.key === 'highOpportunityRecordCount';

          return (
            <article
              key={indicator.key}
              className="group relative grid min-h-[176px] animate-fade-up content-between gap-4 overflow-hidden rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(5,46,92,0.04),0_14px_30px_-22px_rgba(5,46,92,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-24px_rgba(5,46,92,0.5)]"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span
                className="pointer-events-none absolute -top-12 -right-10 size-32 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-25"
                style={{ background: indicator.blob }}
                aria-hidden="true"
              />
              <div className="relative flex items-center justify-between gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${indicator.chip}`}>
                  <Icon className="size-[18px]" />
                </span>
                <div className="flex items-center gap-1">
                  <h3 className="text-right text-[0.8125rem] font-medium text-muted-foreground">
                    {indicator.title}
                  </h3>
                  <InfoTip label={indicator.title}>{indicator.hint}</InfoTip>
                </div>
              </div>
              <div className="relative">
                {isLoading ? (
                  <span
                    className="block h-9 w-[62%] animate-pulse rounded-lg bg-grey-100"
                    data-testid="indicator-skeleton"
                  />
                ) : summary ? (
                  <data
                    value={summary?.[indicator.key] ?? 0}
                    className="font-mono text-[clamp(1.75rem,2.8vw,2.25rem)] leading-none font-medium tracking-[-0.03em] text-navy tabular-nums"
                  >
                    {numberFormatter.format(summary?.[indicator.key] ?? 0)}
                  </data>
                ) : (
                  <span
                    className="font-mono text-[2.125rem] leading-none text-grey-400"
                    aria-label="Value unavailable"
                  >
                    —
                  </span>
                )}
              </div>
              <div className="relative grid gap-1.5">
                <p className="text-xs leading-normal text-muted-foreground">
                  {indicator.description}
                </p>
                {context ? (
                  <p className="font-mono text-[0.6875rem] text-grey-400">{context}</p>
                ) : null}
                {isHighOpportunityCard && !isLoading && summary && summary.highOpportunityRecordCount > 0 ? (
                  <button
                    type="button"
                    onClick={onShowHighOpportunity}
                    className="mt-0.5 inline-flex w-fit items-center gap-1 text-[0.75rem] font-semibold text-ocean-700 hover:text-navy"
                  >
                    {highOpportunityActive ? 'Filter applied' : 'Filter to these records'}
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
