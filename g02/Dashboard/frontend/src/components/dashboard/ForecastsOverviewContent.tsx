import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDashboardDistribution } from '../../hooks/useDashboardDistribution';
import { useDashboardFilterOptions } from '../../hooks/useDashboardFilterOptions';
import type { DashboardApiService } from '../../services/dashboard.service';
import { DashboardFilters } from './DashboardFilters';
import { useDashboardState } from './dashboard-state';

interface ForecastsOverviewContentProps {
  accessToken: string;
  onUnauthorized(): void;
  service: DashboardApiService;
}

const volume = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const count = new Intl.NumberFormat('en-US');

const formatMonth = (value: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC', year: 'numeric' }).format(
    new Date(`${value}-01T00:00:00Z`),
  );

export function ForecastsOverviewContent({
  accessToken,
  onUnauthorized,
  service,
}: ForecastsOverviewContentProps) {
  const { filters, setFilterValues } = useDashboardState();
  const filterOptions = useDashboardFilterOptions(service, accessToken, onUnauthorized);
  const byMonth = useDashboardDistribution(
    service,
    accessToken,
    'forecast_month',
    filters,
    onUnauthorized,
  );

  const items = byMonth.response?.data ?? [];
  const totalPredicted = items.reduce((total, item) => total + item.estimatedDemandVolume, 0);
  const totalRecords = items.reduce((total, item) => total + item.predictionCount, 0);
  const maxPredicted = Math.max(1, ...items.map((item) => item.estimatedDemandVolume));

  return (
    <>
      <DashboardFilters
        error={filterOptions.error}
        isLoading={filterOptions.isLoading}
        onRetry={filterOptions.retry}
        options={filterOptions.response?.data}
        resultCount={totalRecords}
      />

      {byMonth.error ? (
        <div
          className="flex items-center justify-between gap-4 rounded-xl border border-danger-border bg-danger-surface px-4 py-3.5 text-[0.8125rem] text-danger"
          role="alert"
        >
          <span>We could not load the forecast records.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={byMonth.retry}
            className="border-current text-danger hover:bg-card hover:text-danger"
          >
            Retry
          </Button>
        </div>
      ) : null}

      <section
        className="grid gap-4 rounded-2xl border border-border bg-white p-5"
        aria-labelledby="forecast-overview-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="forecast-overview-title" className="font-heading text-lg font-bold text-navy">
            Forecast by month
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            {count.format(totalRecords)} records · {volume.format(totalPredicted)} estimated billed items
          </p>
        </div>

        {byMonth.isLoading ? (
          <p className="text-[0.8125rem] text-muted-foreground" role="status">
            Loading forecast records…
          </p>
        ) : items.length === 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground" role="status">
            No forecast records match the selected filters.
          </p>
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Forecast by month table">
            <table className="w-full border-collapse text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-border">
                  <TableHead scope="col">Forecast month</TableHead>
                  <TableHead scope="col">Estimated demand</TableHead>
                  <TableHead scope="col" className="text-right">Records</TableHead>
                </tr>
              </thead>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.key}
                    className="cursor-pointer hover:bg-ocean-50/60"
                    onClick={() => setFilterValues('forecastMonths', [item.key])}
                    title={`Filter the dashboard to ${formatMonth(item.key)}`}
                  >
                    <TableCell className="font-medium text-navy">{formatMonth(item.key)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-1.5 min-w-1 rounded-full bg-[linear-gradient(90deg,#0a82d4,#00a5df)]"
                          style={{ width: `${Math.max(2, (item.estimatedDemandVolume / maxPredicted) * 100)}%` }}
                          aria-hidden="true"
                        />
                        <span className="tabular-nums text-ink">{volume.format(item.estimatedDemandVolume)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{count.format(item.predictionCount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        )}

        <p className="text-xs leading-normal text-muted-foreground">
          Click a month to filter the dashboard. Estimated demand means estimated billed-item
          utilization demand volume, not a patient count or confirmed clinical demand.
        </p>
      </section>
    </>
  );
}
