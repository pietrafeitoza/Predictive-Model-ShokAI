import type { DashboardDistributionItem } from '@shokai/contracts';

import { formatFullNumber, formatPredictionRecords } from './chart-format';

interface AccessibleChartSummaryProps {
  data: DashboardDistributionItem[];
  title: string;
}

export function AccessibleChartSummary({ data, title }: AccessibleChartSummaryProps) {
  return (
    <div className="sr-only" data-testid="chart-accessible-summary">
      <p>{title} data summary.</p>
      <ul>
        {data.map((item) => (
          <li key={item.key}>
            {item.label}: estimated demand volume {formatFullNumber(item.estimatedDemandVolume)};
            {' '}{formatPredictionRecords(item.predictionCount)}.
          </li>
        ))}
      </ul>
    </div>
  );
}
