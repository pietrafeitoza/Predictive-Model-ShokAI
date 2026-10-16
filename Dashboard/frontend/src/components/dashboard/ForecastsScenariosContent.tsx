import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface ForecastsScenariosContentProps {
  accessToken: string;
  onUnauthorized(): void;
  service: DashboardApiService;
}

const volume = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function ForecastsScenariosContent({
  accessToken,
  onUnauthorized,
  service,
}: ForecastsScenariosContentProps) {
  const { filters } = useDashboardState();
  const filterOptions = useDashboardFilterOptions(service, accessToken, onUnauthorized);
  const byLine = useDashboardDistribution(
    service,
    accessToken,
    'treatment_line',
    filters,
    onUnauthorized,
  );
  const [multipliers, setMultipliers] = useState<Record<string, number>>({});

  const lines = byLine.response?.data ?? [];
  const totalRecords = lines.reduce((total, line) => total + line.predictionCount, 0);
  const baselineTotal = lines.reduce((total, line) => total + line.estimatedDemandVolume, 0);

  const multiplierFor = (key: string) => multipliers[key] ?? 1;
  const adjustedTotal = lines.reduce(
    (total, line) => total + line.estimatedDemandVolume * multiplierFor(line.key),
    0,
  );

  function setMultiplier(key: string, raw: string) {
    const parsed = Number.parseFloat(raw);
    setMultipliers((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
    }));
  }

  function reset() {
    setMultipliers({});
  }

  return (
    <>
      <DashboardFilters
        error={filterOptions.error}
        isLoading={filterOptions.isLoading}
        onRetry={filterOptions.retry}
        options={filterOptions.response?.data}
        resultCount={totalRecords}
      />

      {byLine.error ? (
        <div
          className="flex items-center justify-between gap-4 rounded-xl border border-danger-border bg-danger-surface px-4 py-3.5 text-[0.8125rem] text-danger"
          role="alert"
        >
          <span>We could not load the forecast records.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={byLine.retry}
            className="border-current text-danger hover:bg-card hover:text-danger"
          >
            Retry
          </Button>
        </div>
      ) : null}

      <section
        className="grid gap-4 rounded-2xl border border-border bg-white p-5"
        aria-labelledby="forecast-scenarios-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h2 id="forecast-scenarios-title" className="font-heading text-lg font-bold text-navy">
              What-if scenarios
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground">
              Apply a multiplier per treatment line to explore adjusted estimated demand.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            Reset scenario
          </Button>
        </div>

        {byLine.isLoading ? (
          <p className="text-[0.8125rem] text-muted-foreground" role="status">
            Loading forecast records…
          </p>
        ) : lines.length === 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground" role="status">
            No forecast records match the selected filters.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1 rounded-xl border border-border bg-white/70 p-3">
                <span className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
                  Baseline estimated demand
                </span>
                <data className="font-mono text-xl leading-none font-medium text-navy tabular-nums">
                  {volume.format(baselineTotal)}
                </data>
              </div>
              <div className="grid gap-1 rounded-xl border border-ocean-100 bg-ocean-50 p-3">
                <span className="text-[0.75rem] font-medium text-ocean-600">
                  Adjusted estimated demand
                </span>
                <data className="font-mono text-xl leading-none font-medium text-navy tabular-nums">
                  {volume.format(adjustedTotal)}
                </data>
              </div>
            </div>

            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scenario by treatment line">
              <table className="w-full border-collapse text-left text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-border">
                    <TableHead scope="col">Treatment line</TableHead>
                    <TableHead scope="col" className="text-right">Baseline</TableHead>
                    <TableHead scope="col" className="text-right">Multiplier</TableHead>
                    <TableHead scope="col" className="text-right">Adjusted</TableHead>
                  </tr>
                </thead>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.key}>
                      <TableCell className="font-medium text-navy">{line.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {volume.format(line.estimatedDemandVolume)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={multiplierFor(line.key)}
                          onChange={(event) => setMultiplier(line.key, event.target.value)}
                          aria-label={`${line.label} multiplier`}
                          className="ml-auto h-8 w-24 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {volume.format(line.estimatedDemandVolume * multiplierFor(line.key))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          </>
        )}

        <p className="text-xs leading-normal text-muted-foreground">
          Scenarios are illustrative adjustments of the estimated billed-item utilization volume and
          are not stored.
        </p>
      </section>
    </>
  );
}
