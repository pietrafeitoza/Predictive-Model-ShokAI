import type { SelectedModelSummary } from '@shokai/contracts';
import { ChevronDown, Gauge } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InfoTip } from './InfoTip';

interface SelectedModelPanelProps {
  error: boolean;
  isLoading: boolean;
  model?: SelectedModelSummary | null;
  onRetry(): void;
}

const errorMetricFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const rSquaredFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const algorithmLabels: Record<SelectedModelSummary['algorithm'], string> = {
  decision_tree: 'Decision Tree',
  linear_regression: 'Linear Regression',
  random_forest: 'Random Forest',
  ridge: 'Ridge',
  lasso: 'Lasso',
  elasticnet: 'ElasticNet',
  seasonal_naive: 'Seasonal naive',
  group_mean: 'Group mean',
};

function formatPeriod(start: string | null, end: string): string {
  return start ? `${start} to ${end}` : `Through ${end}`;
}

function describeFit(r2: number): { label: string; tone: string } {
  if (r2 >= 0.75) return { label: 'Strong fit', tone: 'text-leaf-700' };
  if (r2 >= 0.5) return { label: 'Moderate fit', tone: 'text-citrine-700' };
  return { label: 'Weak fit', tone: 'text-danger' };
}

interface MetricTileProps {
  hint: string;
  label: string;
  value: string;
}

function MetricTile({ hint, label, value }: MetricTileProps) {
  return (
    <div className="grid gap-1.5 rounded-xl border border-border bg-white/70 p-3">
      <div className="flex items-center gap-1">
        <span className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
          {label}
        </span>
        <InfoTip label={label}>{hint}</InfoTip>
      </div>
      <data className="font-mono text-xl leading-none font-medium tracking-[-0.02em] text-navy tabular-nums">
        {value}
      </data>
    </div>
  );
}

export function SelectedModelPanel({ error, isLoading, model, onRetry }: SelectedModelPanelProps) {
  if (error) {
    return (
      <div
        className="flex items-center justify-between gap-4 rounded-xl border border-danger-border bg-danger-surface px-4 py-3.5 text-[0.8125rem] text-danger"
        role="alert"
      >
        <span>We could not load the selected-model information.</span>
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
    );
  }

  if (isLoading || !model) return null;

  const r2 = model.metrics.r2;
  const fit = r2 === null ? { label: 'Not available', tone: 'text-muted-foreground' } : describeFit(r2);
  const gaugeWidth = r2 === null ? 0 : Math.max(0, Math.min(1, r2)) * 100;

  return (
    <section
      className="relative grid gap-4 overflow-hidden rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(5,46,92,0.04),0_16px_34px_-26px_rgba(5,46,92,0.45)]"
      aria-labelledby="selected-model-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1.5">
          <span className="text-[0.75rem] font-medium text-ocean-600">
            Selected model
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2
              id="selected-model-title"
              className="font-heading text-xl font-bold tracking-[-0.02em] text-navy"
            >
              {algorithmLabels[model.algorithm]}
            </h2>
            <span className="inline-flex items-center rounded-full border border-leaf/40 bg-leaf-100 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-leaf-700">
              Selected
            </span>
          </div>
        </div>
        <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-mono text-[0.6875rem] font-medium text-indigo-700">
          Version {model.modelVersion}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
        <div className="grid content-center gap-2 rounded-xl border border-border bg-[linear-gradient(135deg,var(--indigo-100),var(--card)_60%)] p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Gauge className="size-3.5" aria-hidden="true" />
            <span className="font-mono text-[0.625rem] tracking-[0.1em] uppercase">
              Explanatory power (R²)
            </span>
            <InfoTip label="R²">
              R² (coefficient of determination) is the share of demand variance explained by the
              model. 1.0 is perfect; 0 means no better than a mean baseline.
            </InfoTip>
          </div>
          <p className="font-heading text-3xl leading-none font-extrabold tracking-[-0.03em] text-navy">
            {r2 === null ? '—' : rSquaredFormatter.format(r2)}
          </p>
          <p className={cn('text-[0.75rem] font-semibold', fit.tone)}>{fit.label}</p>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-grey-100"
            role="img"
            aria-label={`R² ${r2 === null ? 'not available' : rSquaredFormatter.format(r2)} — ${fit.label}`}
          >
            <span
              className="block h-full rounded-full bg-[linear-gradient(90deg,#0a82d4,#00a5df)]"
              style={{ width: `${gaugeWidth}%` }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MetricTile
            label="MAE"
            value={model.metrics.mae === null ? '—' : errorMetricFormatter.format(model.metrics.mae)}
            hint="Mean absolute error: the average absolute gap between predicted and observed demand volume. Lower is better."
          />
          <MetricTile
            label="RMSE"
            value={model.metrics.rmse === null ? '—' : errorMetricFormatter.format(model.metrics.rmse)}
            hint="Root mean squared error: like MAE but penalizes large misses more heavily. Lower is better."
          />
          <div className="grid gap-1.5 rounded-xl border border-border bg-white/70 p-3 sm:col-span-2">
            <div className="flex items-center gap-1">
              <span className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
                Metric scope
              </span>
              <InfoTip label="Metric scope">
                Which holdout rows the error metrics are computed on. Observed-only excludes rows
                without a recorded outcome.
              </InfoTip>
            </div>
            <data className="text-[0.8125rem] font-medium text-ink">
              {model.metricScope === 'observed_only_holdout' ? 'Observed-only holdout' : 'All holdout rows'}
            </data>
          </div>
        </div>
      </div>

      <details className="group/details border-t border-border pt-3">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-[0.8125rem] font-medium text-ocean-700 transition-colors hover:text-navy">
          <ChevronDown className="size-4 transition-transform group-open/details:rotate-180" aria-hidden="true" />
          Model details
        </summary>
        <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="grid min-w-0 gap-1">
            <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
              Target
            </dt>
            <dd className="text-[0.8125rem] font-medium [overflow-wrap:anywhere] text-ink">
              Estimated demand volume
            </dd>
          </div>
          <div className="grid min-w-0 gap-1">
            <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
              Unit
            </dt>
            <dd className="text-[0.8125rem] font-medium [overflow-wrap:anywhere] text-ink">
              Billed item quantity
            </dd>
          </div>
          <div className="grid min-w-0 gap-1">
            <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
              Training period
            </dt>
            <dd className="text-[0.8125rem] font-medium [overflow-wrap:anywhere] text-ink">
              {formatPeriod(model.trainingPeriodStart, model.trainingPeriodEnd)}
            </dd>
          </div>
          <div className="grid min-w-0 gap-1">
            <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
              Holdout period
            </dt>
            <dd className="text-[0.8125rem] font-medium [overflow-wrap:anywhere] text-ink">
              {formatPeriod(model.holdoutPeriodStart, model.holdoutPeriodEnd)}
            </dd>
          </div>
          {model.metrics.maeLog1p ? (
            <div className="grid min-w-0 gap-1">
              <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
                MAE (log1p)
              </dt>
              <dd className="text-[0.8125rem] font-medium text-ink">
                {errorMetricFormatter.format(model.metrics.maeLog1p)}
              </dd>
            </div>
          ) : null}
          {typeof model.metrics.skillVsNaive === 'number' ? (
            <div className="grid min-w-0 gap-1">
              <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
                Skill vs naive
              </dt>
              <dd className="text-[0.8125rem] font-medium text-ink">
                {rSquaredFormatter.format(model.metrics.skillVsNaive)}
              </dd>
            </div>
          ) : null}
          {model.metrics.testRowCount ? (
            <div className="grid min-w-0 gap-1">
              <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
                Holdout rows
              </dt>
              <dd className="text-[0.8125rem] font-medium text-ink">
                {model.metrics.testRowCount.toLocaleString('en-US')}
              </dd>
            </div>
          ) : null}
          <div className="grid min-w-0 gap-1">
            <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
              Granularity
            </dt>
            <dd className="text-[0.8125rem] font-medium [overflow-wrap:anywhere] text-ink">
              {model.granularity.map((part) => titleCase(part)).join(' · ')}
            </dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-border pt-3 text-xs leading-normal text-muted-foreground">
          {model.caveat}
        </p>
      </details>
    </section>
  );
}

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
