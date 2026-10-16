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

const title = 'Estimated demand by treatment line';

const chartConfig = {
  estimatedDemandVolume: {
    label: 'Estimated demand volume',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

interface TreatmentLineDemandChartProps {
  activeKeys?: string[];
  onSelect?(key: string): void;
  state: DashboardDistributionState;
}

export function TreatmentLineDemandChart({
  activeKeys = [],
  onSelect,
  state,
}: TreatmentLineDemandChartProps) {
  const data = state.response?.data ?? [];
  const hasSelection = activeKeys.length > 0;

  return (
    <ChartPanel
      className="min-h-[360px] lg:col-span-2"
      description="Estimated billed-item utilization volume across treatment lines."
      error={state.error}
      id="treatment-line-demand"
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
        initialDimension={{ width: 960, height: 260 }}
        className="aspect-auto h-[260px] w-full min-w-0"
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 2, right: 50, bottom: 2, left: 8 }}
        >
          <CartesianGrid stroke="var(--grey-100)" horizontal={false} strokeDasharray="3 4" />
          <XAxis
            allowDecimals
            axisLine={false}
            domain={[0, 'auto']}
            tick={{ fill: 'var(--grey-600)', fontSize: 11 }}
            tickFormatter={formatCompactNumber}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="label"
            interval={0}
            tick={{ fill: 'var(--grey-800)', fontSize: 12 }}
            tickLine={false}
            type="category"
            width={96}
          />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--grey-50)' }} />
          <Bar
            dataKey="estimatedDemandVolume"
            fill="var(--color-estimatedDemandVolume)"
            isAnimationActive={false}
            maxBarSize={30}
            radius={[0, 5, 5, 0]}
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
              position="right"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}
