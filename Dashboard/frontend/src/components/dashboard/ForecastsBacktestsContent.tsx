import type { BacktestSlice } from '@shokai/contracts';

import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDashboardBacktest } from '../../hooks/useDashboardBacktest';
import { useDashboardFilterOptions } from '../../hooks/useDashboardFilterOptions';
import type { DashboardApiService } from '../../services/dashboard.service';
import { DashboardFilters } from './DashboardFilters';
import { useDashboardState } from './dashboard-state';

interface ForecastsBacktestsContentProps {
  accessToken: string;
  onUnauthorized(): void;
  service: DashboardApiService;
}

const decimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const threeDecimals = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const count = new Intl.NumberFormat('en-US');

const formatError = (value: number | null) => (value === null ? '—' : decimal.format(value));
const formatR2 = (value: number | null) => (value === null ? '—' : threeDecimals.format(value));

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-xl border border-border bg-white/70 p-3">
      <span className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </span>
      <data className="font-mono text-xl leading-none font-medium tracking-[-0.02em] text-navy tabular-nums">
        {value}
      </data>
    </div>
  );
}

function SliceTable({
  title,
  slices,
  onSelect,
}: {
  title: string;
  slices: readonly BacktestSlice[];
  onSelect(key: string): void;
}) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <h3 className="font-heading text-sm font-bold text-navy">{title}</h3>
      {slices.length === 0 ? (
        <p className="text-[0.8125rem] text-muted-foreground">No records for this breakdown.</p>
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${title} table`}>
          <table className="w-full border-collapse text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border">
                <TableHead scope="col">{title}</TableHead>
                <TableHead scope="col" className="text-right">MAE</TableHead>
                <TableHead scope="col" className="text-right">RMSE</TableHead>
                <TableHead scope="col" className="text-right">R²</TableHead>
                <TableHead scope="col" className="text-right">Observed rows</TableHead>
              </tr>
            </thead>
            <TableBody>
              {slices.map((slice) => (
                <TableRow
                  key={slice.key}
                  className="cursor-pointer hover:bg-ocean-50/60"
                  onClick={() => onSelect(slice.key)}
                  title={`Filter the dashboard to ${slice.label}`}
                >
                  <TableCell className="font-medium text-navy">{slice.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatError(slice.mae)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatError(slice.rmse)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatR2(slice.r2)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {count.format(slice.observedRowCount)}
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

export function ForecastsBacktestsContent({
  accessToken,
  onUnauthorized,
  service,
}: ForecastsBacktestsContentProps) {
  const { filters, setFilterValues } = useDashboardState();
  const filterOptions = useDashboardFilterOptions(service, accessToken, onUnauthorized);
  const backtest = useDashboardBacktest(service, accessToken, filters, onUnauthorized);
  const data = backtest.response?.data;

  return (
    <>
      <DashboardFilters
        error={filterOptions.error}
        isLoading={filterOptions.isLoading}
        onRetry={filterOptions.retry}
        options={filterOptions.response?.data}
        resultCount={data?.rowCount}
      />

      {backtest.error ? (
        <div
          className="flex items-center justify-between gap-4 rounded-xl border border-danger-border bg-danger-surface px-4 py-3.5 text-[0.8125rem] text-danger"
          role="alert"
        >
          <span>We could not load the backtest results.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={backtest.retry}
            className="border-current text-danger hover:bg-card hover:text-danger"
          >
            Retry
          </Button>
        </div>
      ) : null}

      <section
        className="grid gap-4 rounded-2xl border border-border bg-white p-5"
        aria-labelledby="forecast-backtests-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="forecast-backtests-title" className="font-heading text-lg font-bold text-navy">
            Holdout backtest
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            Predicted versus observed demand on rows with a recorded outcome.
          </p>
        </div>

        {backtest.isLoading ? (
          <p className="text-[0.8125rem] text-muted-foreground" role="status">
            Loading backtest results…
          </p>
        ) : !data || data.observedRowCount === 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground" role="status">
            No observed outcome is available for the selected filters.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="MAE" value={formatError(data.mae)} />
              <MetricTile label="RMSE" value={formatError(data.rmse)} />
              <MetricTile label="R²" value={formatR2(data.r2)} />
              <MetricTile label="Observed rows" value={count.format(data.observedRowCount)} />
            </div>

            <SliceTable
              title="Forecast month"
              slices={data.byForecastMonth}
              onSelect={(key) => setFilterValues('forecastMonths', [key])}
            />
            <SliceTable
              title="Treatment line"
              slices={data.byTreatmentLine}
              onSelect={(key) => setFilterValues('treatmentLines', [key])}
            />
            <SliceTable
              title="Provider state"
              slices={data.byProviderState}
              onSelect={(key) => setFilterValues('providerStates', [key])}
            />
          </>
        )}

        <p className="text-xs leading-normal text-muted-foreground">
          Click a row to filter the dashboard to that slice. Metrics are computed only on rows with a
          recorded observed volume; error is measured in billed items, not patients.
        </p>
      </section>
    </>
  );
}
