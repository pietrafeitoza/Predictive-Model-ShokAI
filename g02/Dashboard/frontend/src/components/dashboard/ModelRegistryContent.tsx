import type {
  ModelMetricName,
  ModelRegistryEntry,
  ModelStatus,
  ModelValidationFold,
} from '@shokai/contracts';
import { useState } from 'react';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useModelRegistry } from '../../hooks/useModelRegistry';
import type { DashboardApiService } from '../../services/dashboard.service';

interface ModelRegistryContentProps {
  accessToken: string;
  onUnauthorized(): void;
  service: DashboardApiService;
}

const MAX_COMPARISON = 3;

const algorithmLabels: Record<ModelRegistryEntry['algorithm'], string> = {
  decision_tree: 'Decision Tree',
  linear_regression: 'Linear Regression',
  random_forest: 'Random Forest',
  ridge: 'Ridge',
  lasso: 'Lasso',
  elasticnet: 'ElasticNet',
  seasonal_naive: 'Seasonal naive',
  group_mean: 'Group mean',
};

const statusStyles: Record<ModelRegistryEntry['status'], string> = {
  candidate: 'border-ocean-100 bg-ocean-50 text-ocean-700',
  selected: 'border-leaf/40 bg-leaf-100 text-leaf-700',
  archived: 'border-grey-200 bg-grey-100 text-grey-800',
};

const decimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const threeDecimals = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const idOf = (entry: ModelRegistryEntry) => `${entry.modelId}:${entry.modelVersion}`;

function metricValue(
  entry: ModelRegistryEntry,
  split: 'validation' | 'holdout',
  rowScope: 'all' | 'observed' | 'none',
  metric: ModelMetricName,
): number | null {
  const record = entry.metrics.find(
    (item) => item.split === split && item.rowScope === rowScope && item.metric === metric,
  );
  return record ? record.value : null;
}

function metricStd(
  entry: ModelRegistryEntry,
  split: 'validation' | 'holdout',
  metric: ModelMetricName,
): number | null {
  const record = entry.metrics.find(
    (item) => item.split === split && item.rowScope === 'all' && item.metric === metric,
  );
  return record ? record.stdDev : null;
}

function formatMetric(value: number | null, formatter = decimal): string {
  return value === null ? '—' : formatter.format(value);
}

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${value}-01T00:00:00Z`));
}

function FoldRow({ fold }: { fold: ModelValidationFold }) {
  return (
    <TableRow>
      <TableCell>{formatMonth(fold.originMonth)}</TableCell>
      <TableCell>
        {fold.fitStartMonth && fold.fitEndMonth
          ? `${formatMonth(fold.fitStartMonth)} – ${formatMonth(fold.fitEndMonth)}`
          : '—'}
      </TableCell>
      <TableCell>{fold.fitRows?.toLocaleString('en-US') ?? '—'}</TableCell>
      <TableCell>{fold.validationRows?.toLocaleString('en-US') ?? '—'}</TableCell>
      <TableCell>{formatMetric(fold.naiveValidationMae)}</TableCell>
    </TableRow>
  );
}

function bestId(
  entries: ModelRegistryEntry[],
  valueOf: (entry: ModelRegistryEntry) => number | null,
  direction: 'min' | 'max',
): string | null {
  let best: string | null = null;
  let bestValue: number | null = null;
  for (const entry of entries) {
    const value = valueOf(entry);
    if (value === null) continue;
    if (
      bestValue === null ||
      (direction === 'min' && value < bestValue) ||
      (direction === 'max' && value > bestValue)
    ) {
      best = idOf(entry);
      bestValue = value;
    }
  }
  return best;
}

export function ModelRegistryContent({
  accessToken,
  onUnauthorized,
  service,
}: ModelRegistryContentProps) {
  const { error, isLoading, response, retry } = useModelRegistry(service, accessToken, onUnauthorized);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<string[]>([]);
  const [maeScope, setMaeScope] = useState<'validation' | 'holdout'>('holdout');
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectError, setSelectError] = useState(false);

  if (isLoading) {
    return (
      <div
        className="min-h-22 rounded-2xl border border-border bg-white/70 p-6 text-muted-foreground"
        role="status"
        aria-busy="true"
      >
        Loading the model registry…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex w-full max-w-[480px] items-center justify-between gap-4 rounded-xl border border-danger-border bg-danger-surface p-4 text-[0.8125rem] text-danger"
        role="alert"
      >
        <span>We could not load the model registry.</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={retry}
          className="border-current text-danger hover:bg-card hover:text-danger"
        >
          Retry
        </Button>
      </div>
    );
  }

  const entries = response?.data ?? [];

  if (entries.length === 0) {
    return (
      <div
        className="rounded-2xl border border-border bg-white/70 p-6 text-[0.8125rem] text-muted-foreground"
        role="status"
      >
        The model registry is available when the dashboard is connected to Supabase.
      </div>
    );
  }

  const selectedEntry =
    entries.find((entry) => idOf(entry) === selectedModelId) ?? entries[0];
  const comparisonEntries = entries.filter((entry) => comparison.includes(idOf(entry)));

  const bestMae = bestId(entries, (entry) => metricValue(entry, maeScope, 'all', 'mae'), 'min');
  const bestRmse = bestId(entries, (entry) => metricValue(entry, 'holdout', 'all', 'rmse'), 'min');
  const bestR2 = bestId(entries, (entry) => metricValue(entry, 'holdout', 'all', 'r2'), 'max');
  const bestSkill = bestId(entries, (entry) => metricValue(entry, 'holdout', 'observed', 'skill'), 'max');

  function toggleCompare(entryId: string) {
    setComparison((current) => {
      if (current.includes(entryId)) return current.filter((id) => id !== entryId);
      if (current.length >= MAX_COMPARISON) return current;
      return [...current, entryId];
    });
  }

  async function applyStatus(nextStatus: ModelStatus) {
    setIsSelecting(true);
    setSelectError(false);
    try {
      await service.setModelStatus(
        selectedEntry.modelId,
        selectedEntry.modelVersion,
        nextStatus,
        accessToken,
      );
      retry();
    } catch {
      setSelectError(true);
    } finally {
      setIsSelecting(false);
    }
  }

  const bestCellClass = 'bg-leaf-100 text-leaf-700 font-semibold';

  return (
    <div className="grid gap-6">
      <section
        className="grid gap-4 overflow-hidden rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(5,46,92,0.04),0_16px_34px_-26px_rgba(5,46,92,0.45)]"
        aria-labelledby="model-registry-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <span className="text-[0.75rem] font-medium text-ocean-600">
              Evaluated candidates
            </span>
            <h2 id="model-registry-title" className="font-heading text-lg font-bold text-navy">
              Model registry
            </h2>
          </div>
          <div
            className="inline-flex items-center rounded-full border border-border bg-grey-50 p-0.5"
            role="group"
            aria-label="MAE metric scope"
          >
            {(['holdout', 'validation'] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                aria-pressed={maeScope === scope}
                onClick={() => setMaeScope(scope)}
                className={cn(
                  'rounded-full px-3 py-1 text-[0.75rem] font-medium transition-colors',
                  maeScope === scope ? 'bg-white text-navy shadow-sm' : 'text-muted-foreground',
                )}
              >
                MAE · {scope === 'holdout' ? 'Holdout' : 'Validation'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Model registry table">
          <table className="w-full border-collapse text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border">
                <TableHead scope="col" className="w-10">
                  <span className="sr-only">Compare</span>
                </TableHead>
                <TableHead scope="col">Model</TableHead>
                <TableHead scope="col">Role</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="text-right">
                  MAE · {maeScope === 'holdout' ? 'holdout' : 'validation'}
                </TableHead>
                <TableHead scope="col" className="text-right">RMSE</TableHead>
                <TableHead scope="col" className="text-right">R²</TableHead>
                <TableHead scope="col" className="text-right">Skill (observed)</TableHead>
              </tr>
            </thead>
            <TableBody>
              {entries.map((entry) => {
                const id = idOf(entry);
                const isSelected = id === idOf(selectedEntry);
                const isCompared = comparison.includes(id);
                return (
                  <TableRow
                    key={id}
                    className={cn('cursor-pointer', isSelected && 'bg-ocean-50/60')}
                    onClick={() => setSelectedModelId(id)}
                  >
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isCompared}
                        onChange={() => toggleCompare(id)}
                        aria-label={`Compare ${algorithmLabels[entry.algorithm]} ${entry.modelVersion}`}
                        className="size-4 accent-ocean-600"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-navy">
                      {algorithmLabels[entry.algorithm]}
                      <span className="ml-2 font-mono text-[0.6875rem] text-muted-foreground">
                        {entry.modelVersion}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.role ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={cn('border', statusStyles[entry.status])}>{entry.status}</Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        id === bestMae && bestCellClass,
                      )}
                    >
                      {formatMetric(metricValue(entry, maeScope, 'all', 'mae'))}
                    </TableCell>
                    <TableCell
                      className={cn('text-right tabular-nums', id === bestRmse && bestCellClass)}
                    >
                      {formatMetric(metricValue(entry, 'holdout', 'all', 'rmse'))}
                    </TableCell>
                    <TableCell
                      className={cn('text-right tabular-nums', id === bestR2 && bestCellClass)}
                    >
                      {formatMetric(metricValue(entry, 'holdout', 'all', 'r2'), threeDecimals)}
                    </TableCell>
                    <TableCell
                      className={cn('text-right tabular-nums', id === bestSkill && bestCellClass)}
                    >
                      {formatMetric(metricValue(entry, 'holdout', 'observed', 'skill'), threeDecimals)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </table>
        </div>
        <p className="text-xs leading-normal text-muted-foreground">
          Green highlights the best value in each column. Tick up to {MAX_COMPARISON} models to compare
          them side by side.
        </p>
      </section>

      {comparisonEntries.length > 0 ? (
        <section
          className="grid gap-4 rounded-2xl border border-border bg-white p-5"
          aria-labelledby="model-comparison-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="model-comparison-title" className="font-heading text-lg font-bold text-navy">
              Side-by-side comparison
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={() => setComparison([])}>
              Clear comparison
            </Button>
          </div>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Model comparison">
            <table className="w-full border-collapse text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-border">
                  <TableHead scope="col">Metric</TableHead>
                  {comparisonEntries.map((entry) => (
                    <TableHead key={idOf(entry)} scope="col" className="text-right">
                      <span className="inline-flex items-center gap-1.5">
                        {algorithmLabels[entry.algorithm]} · {entry.modelVersion}
                        <button
                          type="button"
                          aria-label={`Remove ${algorithmLabels[entry.algorithm]} from comparison`}
                          onClick={() => toggleCompare(idOf(entry))}
                          className="text-muted-foreground hover:text-danger"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    </TableHead>
                  ))}
                </tr>
              </thead>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground">Validation MAE (mean ± SD)</TableCell>
                  {comparisonEntries.map((entry) => (
                    <TableCell key={idOf(entry)} className="text-right tabular-nums">
                      {formatMetric(metricValue(entry, 'validation', 'all', 'mae'))}
                      {metricStd(entry, 'validation', 'mae') !== null
                        ? ` ± ${decimal.format(metricStd(entry, 'validation', 'mae') as number)}`
                        : ''}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Holdout MAE (all rows)</TableCell>
                  {comparisonEntries.map((entry) => (
                    <TableCell key={idOf(entry)} className="text-right tabular-nums">
                      {formatMetric(metricValue(entry, 'holdout', 'all', 'mae'))}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Holdout RMSE (all rows)</TableCell>
                  {comparisonEntries.map((entry) => (
                    <TableCell key={idOf(entry)} className="text-right tabular-nums">
                      {formatMetric(metricValue(entry, 'holdout', 'all', 'rmse'))}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Holdout R²</TableCell>
                  {comparisonEntries.map((entry) => (
                    <TableCell key={idOf(entry)} className="text-right tabular-nums">
                      {formatMetric(metricValue(entry, 'holdout', 'all', 'r2'), threeDecimals)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Skill (observed rows)</TableCell>
                  {comparisonEntries.map((entry) => (
                    <TableCell key={idOf(entry)} className="text-right tabular-nums">
                      {formatMetric(metricValue(entry, 'holdout', 'observed', 'skill'), threeDecimals)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </table>
          </div>
        </section>
      ) : null}

      <section
        className="grid gap-4 rounded-2xl border border-border bg-white p-5"
        aria-labelledby="model-detail-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="model-detail-title" className="font-heading text-lg font-bold text-navy">
            {algorithmLabels[selectedEntry.algorithm]} · {selectedEntry.modelVersion}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {selectedEntry.status === 'selected' ? (
              <Badge className="border border-leaf/40 bg-leaf-100 text-leaf-700">Active model</Badge>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => applyStatus('selected')}
                  disabled={isSelecting}
                >
                  {isSelecting ? 'Saving…' : 'Set as selected'}
                </Button>
                {!selectedEntry.hasPredictionImport ? (
                  <Badge
                    className="border border-grey-200 bg-grey-100 text-grey-800"
                    title="This model has no imported predictions yet, so the dashboard forecast will be empty until they are imported."
                  >
                    No imported predictions
                  </Badge>
                ) : null}
                {selectedEntry.status === 'archived' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyStatus('candidate')}
                    disabled={isSelecting}
                  >
                    Restore
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyStatus('archived')}
                    disabled={isSelecting}
                  >
                    Archive
                  </Button>
                )}
              </>
            )}
            <Badge className={cn('border', statusStyles[selectedEntry.status])}>
              {selectedEntry.status}
            </Badge>
            {selectedEntry.deployed ? (
              <Badge className="border border-leaf/40 bg-leaf-100 text-leaf-700">Deployed</Badge>
            ) : null}
          </div>
        </div>

        {selectError ? (
          <p className="text-[0.8125rem] text-danger" role="alert">
            We could not change the model status. Please try again.
          </p>
        ) : null}

        <p className="text-[0.75rem] leading-normal text-muted-foreground">
          Status controls the registry: <strong>selected</strong> drives the dashboard predictions,{' '}
          <strong>candidate</strong> and <strong>archived</strong> are not used for forecasting.
          Selecting a model without an imported prediction batch leaves the dashboard forecast empty
          until predictions are imported.
        </p>

        {selectedEntry.description ? (
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
            {selectedEntry.description}
          </p>
        ) : null}

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="grid gap-1">
            <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
              Selection criterion
            </dt>
            <dd className="text-[0.8125rem] font-medium text-ink">{selectedEntry.selectionCriterion}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
              Training period
            </dt>
            <dd className="text-[0.8125rem] font-medium text-ink">
              {selectedEntry.trainingPeriodStart
                ? `${formatMonth(selectedEntry.trainingPeriodStart)} – ${formatMonth(selectedEntry.trainingPeriodEnd)}`
                : `Through ${formatMonth(selectedEntry.trainingPeriodEnd)}`}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
              Holdout period
            </dt>
            <dd className="text-[0.8125rem] font-medium text-ink">
              {formatMonth(selectedEntry.holdoutPeriodStart)} – {formatMonth(selectedEntry.holdoutPeriodEnd)}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
              Hyperparameters
            </dt>
            <dd className="text-[0.8125rem] font-medium text-ink">
              {Object.keys(selectedEntry.hyperparameters).length === 0
                ? 'None'
                : Object.entries(selectedEntry.hyperparameters)
                    .map(([key, value]) => `${key}=${String(value)}`)
                    .join(' · ')}
            </dd>
          </div>
        </dl>

        {selectedEntry.validationFolds.length > 0 ? (
          <div className="grid gap-2">
            <span className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
              Validation folds
            </span>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Validation folds">
              <table className="w-full border-collapse text-left text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-border">
                    <TableHead scope="col">Origin</TableHead>
                    <TableHead scope="col">Fit window</TableHead>
                    <TableHead scope="col">Fit rows</TableHead>
                    <TableHead scope="col">Validation rows</TableHead>
                    <TableHead scope="col">Naive MAE</TableHead>
                  </tr>
                </thead>
                <TableBody>
                  {selectedEntry.validationFolds.map((fold) => (
                    <FoldRow key={fold.originMonth} fold={fold} />
                  ))}
                </TableBody>
              </table>
            </div>
          </div>
        ) : null}

        {selectedEntry.featureList.length > 0 ? (
          <div className="grid gap-1.5">
            <span className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
              Features
            </span>
            <div className="flex flex-wrap gap-1.5">
              {selectedEntry.featureList.map((feature) => (
                <span
                  key={feature}
                  className="rounded-md border border-border bg-grey-50 px-2 py-0.5 font-mono text-[0.6875rem] text-ink"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {selectedEntry.caveats.length > 0 ? (
          <ul className="grid gap-1 border-t border-border pt-3 text-xs leading-normal text-muted-foreground">
            {selectedEntry.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
