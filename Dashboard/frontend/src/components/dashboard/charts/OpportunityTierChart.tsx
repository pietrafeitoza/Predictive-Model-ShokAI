import type { OpportunityTier } from '@shokai/contracts';
import { Cell, Pie, PieChart } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { AccessibleChartSummary } from './AccessibleChartSummary';
import { ChartPanel } from './ChartPanel';
import { formatFullNumber, formatPredictionRecords } from './chart-format';
import type { DashboardDistributionState } from './chart-types';

const title = 'Opportunity distribution';
const tierClassNames: Record<OpportunityTier, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
};

const chartConfig = {
  estimatedDemandVolume: {
    label: 'Estimated demand volume',
    color: 'var(--chart-1)',
  },
  high: { label: 'High', color: 'var(--tier-high)' },
  medium: { label: 'Medium', color: 'var(--tier-medium)' },
  low: { label: 'Low', color: 'var(--tier-low)' },
} satisfies ChartConfig;

interface OpportunityTierChartProps {
  activeKeys?: string[];
  onSelect?(key: string): void;
  state: DashboardDistributionState;
}

export function OpportunityTierChart({
  activeKeys = [],
  onSelect,
  state,
}: OpportunityTierChartProps) {
  const data = state.response?.data ?? [];
  const hasSelection = activeKeys.length > 0;

  return (
    <ChartPanel
      description="Estimated billed-item utilization volume across opportunity tiers."
      error={state.error}
      id="opportunity-tier-demand"
      interactiveHint={onSelect ? 'Select a tier to narrow the dashboard.' : undefined}
      isEmpty={data.length === 0}
      isLoading={state.isLoading}
      isRefreshing={state.isRefreshing}
      onRetry={state.retry}
      title={title}
    >
      <AccessibleChartSummary data={data} title={title} />
      <div className="grid min-w-0 grid-cols-[minmax(130px,0.8fr)_minmax(170px,1.2fr)] items-center gap-3 max-[680px]:grid-cols-1">
        <ChartContainer
          config={chartConfig}
          aria-hidden="true"
          initialDimension={{ width: 180, height: 220 }}
          className="aspect-auto mx-auto h-[220px] w-full max-w-[220px] min-w-0"
        >
          <PieChart>
            <Pie
              data={data}
              dataKey="estimatedDemandVolume"
              innerRadius="58%"
              isAnimationActive={false}
              nameKey="label"
              outerRadius="84%"
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={3}
              cursor={onSelect ? 'pointer' : undefined}
              onClick={(_entry, index) => {
                const key = data[index]?.key;
                if (key && onSelect) onSelect(key);
              }}
            >
              {data.map((item) => {
                const active = activeKeys.includes(item.key);
                return (
                  <Cell
                    key={item.key}
                    fill={`var(--tier-${tierClassNames[item.key as OpportunityTier]})`}
                    fillOpacity={hasSelection && !active ? 0.32 : 1}
                  />
                );
              })}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
          </PieChart>
        </ChartContainer>
        <ul className="grid min-w-0 gap-1.5" aria-label="Opportunity tier values">
          {data.map((item) => {
            const tier = tierClassNames[item.key as OpportunityTier];
            const active = activeKeys.includes(item.key);

            return (
              <li key={item.key} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect?.(item.key)}
                  className={cn(
                    'grid min-h-[54px] w-full min-w-0 grid-cols-[11px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border-b border-border px-2 py-2.5 text-left transition-colors last:border-b-0',
                    onSelect && 'cursor-pointer hover:bg-grey-50',
                    active && 'bg-ocean-50',
                    !active && hasSelection && 'opacity-60',
                  )}
                >
                  <span
                    className="size-2.5 rounded-[3px]"
                    style={{ background: `var(--tier-${tier})` }}
                    aria-hidden="true"
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <strong className="text-[0.8125rem] font-medium text-grey-800">{item.label}</strong>
                    <small className="text-[0.6875rem] text-muted-foreground">
                      {formatPredictionRecords(item.predictionCount)}
                    </small>
                  </span>
                  <data
                    value={item.estimatedDemandVolume}
                    className="font-mono text-[0.8125rem] font-medium text-navy tabular-nums"
                  >
                    {formatFullNumber(item.estimatedDemandVolume)}
                  </data>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartPanel>
  );
}
