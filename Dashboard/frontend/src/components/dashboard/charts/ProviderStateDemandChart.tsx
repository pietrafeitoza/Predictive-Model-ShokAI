import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { AccessibleChartSummary } from './AccessibleChartSummary';
import { ChartPanel } from './ChartPanel';
import { formatCompactNumber } from './chart-format';
import type { DashboardDistributionState } from './chart-types';

const title = 'Estimated demand by provider state';

const chartConfig = {
  estimatedDemandVolume: {
    label: 'Estimated demand volume',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

interface ProviderStateDemandChartProps {
  activeKeys?: string[];
  onSelect?(key: string): void;
  state: DashboardDistributionState;
}

export function ProviderStateDemandChart({
  activeKeys = [],
  onSelect,
  state,
}: ProviderStateDemandChartProps) {
  const data = state.response?.data ?? [];
  const hasSelection = activeKeys.length > 0;

  return (
    <ChartPanel
      description="Estimated billed-item utilization volume across provider states."
      error={state.error}
      id="provider-state-demand"
      interactiveHint={onSelect ? 'Select a bar to narrow the dashboard.' : undefined}
      isEmpty={data.length === 0}
      isLoading={state.isLoading}
      isRefreshing={state.isRefreshing}
      onRetry={state.retry}
      title={title}
    >
      <AccessibleChartSummary data={data} title={title} />
      <ChartContainer
        config={chartConfig}
        aria-hidden="true"
        initialDimension={{ width: 640, height: 290 }}
        className="aspect-auto h-[290px] w-full min-w-0"
      >
        <BarChart data={data} margin={{ top: 28, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--grey-100)" strokeDasharray="3 4" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="key"
            tick={{ fill: 'var(--grey-600)', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            allowDecimals
            axisLine={false}
            domain={[0, 'auto']}
            tick={{ fill: 'var(--grey-600)', fontSize: 11 }}
            tickFormatter={formatCompactNumber}
            tickLine={false}
            width={48}
          />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--grey-50)' }} />
          <Bar
            dataKey="estimatedDemandVolume"
            fill="var(--color-estimatedDemandVolume)"
            isAnimationActive={false}
            maxBarSize={54}
            radius={[5, 5, 0, 0]}
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
                  fill="var(--color-estimatedDemandVolume)"
                  fillOpacity={hasSelection && !active ? 0.28 : 1}
                  stroke={active ? 'var(--navy)' : undefined}
                  strokeWidth={active ? 1.5 : 0}
                />
              );
            })}
            <LabelList
              dataKey="estimatedDemandVolume"
              fill="var(--grey-600)"
              fontSize={11}
              formatter={(value) => formatCompactNumber(Number(value))}
              position="top"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}
