import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PredictionRecord } from '@shokai/contracts';
import { describe, expect, it, vi } from 'vitest';

import { OpportunityRankingTable } from './OpportunityRankingTable';

function prediction(
  predictionId: string,
  operatorName: string | null,
  predictedDemandVolume: number,
  overrides: Partial<PredictionRecord> = {},
): PredictionRecord {
  return {
    predictionId,
    operatorId: `OP-${predictionId}`,
    operatorName,
    treatmentLine: 'advanced',
    providerState: 'AM',
    referenceMonth: '2026-08',
    forecastMonth: '2026-09',
    predictedDemandVolume,
    observedDemandVolume: null,
    opportunityTier: 'medium',
    modelId: 'mock-model',
    modelVersion: '0.0.0',
    generatedAt: '2026-09-10T12:00:00.000Z',
    ...overrides,
  };
}

const records: PredictionRecord[] = [
  prediction('FALLBACK', null, 500, {
    operatorId: 'OP-FALLBACK',
    providerState: 'AC',
    treatmentLine: 'staging',
    forecastMonth: '2026-12',
    opportunityTier: 'high',
  }),
  prediction('ZULU', 'Zulu Health', 420, { opportunityTier: 'low' }),
  prediction('KILO', 'Kilo Health', 390),
  prediction('JULIET', 'Juliet Health', 360),
  prediction('INDIA', 'India Health', 330),
  prediction('HOTEL', 'Hotel Health', 300),
  prediction('GOLF', 'Golf Health', 270),
  prediction('FOXTROT', 'Foxtrot Health', 240),
  prediction('ECHO', 'Echo Health', 210),
  prediction('DELTA', 'Delta Health', 180),
  prediction('BRAVO', 'Bravo Health', 150),
  prediction('ALPHA', 'Alpha Health', 120, {
    forecastMonth: '2026-10',
    opportunityTier: 'high',
  }),
];

const defaultProps = {
  error: false,
  filters: {},
  isLoading: false,
  isRefreshing: false,
  onClearFilters: vi.fn(),
  onRetry: vi.fn(),
  predictions: records,
};

describe('OpportunityRankingTable', () => {
  it('renders prediction fields, labels, semantic headers, and the default demand-volume order', () => {
    render(<OpportunityRankingTable {...defaultProps} />);

    const table = screen.getByRole('table', { name: /opportunity ranking/i });
    expect(table).toHaveAccessibleDescription(
      'Each record represents estimated demand volume by operator, treatment line, provider state, and forecast month.',
    );
    expect(within(table).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(table).getByText('OP-FALLBACK')).toBeInTheDocument();
    expect(within(table).getByText('AC')).toBeInTheDocument();
    expect(within(table).getByText('Staging')).toBeInTheDocument();
    expect(within(table).getByText('Dec 2026')).toBeInTheDocument();
    expect(within(table).getByText('500')).toBeInTheDocument();
    expect(within(table).getByText('High')).toBeInTheDocument();
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('OP-FALLBACK');
    expect(
      within(table).getByRole('columnheader', { name: 'Estimated demand volume' }),
    ).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByText('Showing 1–10 of 12 records')).toBeInTheDocument();
    expect(screen.queryByText(/patient/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/verticalization|municipality|model version/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
  });

  it('sorts by a supported column without mutating records and resets pagination', async () => {
    const originalOrder = records.map(({ predictionId }) => predictionId);
    const user = userEvent.setup();
    render(<OpportunityRankingTable {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Show next opportunity records' }));
    expect(screen.getByText('Showing 11–12 of 12 records')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show next opportunity records' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Sort by operator ascending' }));

    expect(screen.getByText('Showing 1–10 of 12 records')).toBeInTheDocument();
    expect(screen.getByRole('table').querySelector('tbody tr')).toHaveTextContent('Alpha Health');
    expect(records.map(({ predictionId }) => predictionId)).toEqual(originalOrder);
    expect(
      screen.getByRole('columnheader', { name: 'Operator' }),
    ).toHaveAttribute('aria-sort', 'ascending');
  });

  it('uses the documented High, Medium, Low order for opportunity-tier sorting', async () => {
    const user = userEvent.setup();
    render(<OpportunityRankingTable {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Sort by opportunity tier ascending' }));

    const rows = screen.getByRole('table').querySelectorAll('tbody tr');
    expect(rows[0]).toHaveTextContent('High');
    expect(rows[1]).toHaveTextContent('High');
    expect(screen.getByRole('columnheader', { name: 'Opportunity tier' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(screen.getByRole('button', { name: 'Show next opportunity records' }));
    expect(screen.getByRole('table').querySelector('tbody tr:last-child')).toHaveTextContent('Low');
  });

  it('paginates in both directions and resets to the first page when filters change', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OpportunityRankingTable {...defaultProps} />);

    const previous = screen.getByRole('button', { name: 'Show previous opportunity records' });
    const next = screen.getByRole('button', { name: 'Show next opportunity records' });
    expect(previous).toBeDisabled();
    await user.click(next);
    expect(previous).toBeEnabled();
    expect(screen.getByText('Showing 11–12 of 12 records')).toBeInTheDocument();
    await user.click(previous);
    expect(screen.getByText('Showing 1–10 of 12 records')).toBeInTheDocument();

    await user.click(next);
    rerender(
      <OpportunityRankingTable
        {...defaultProps}
        filters={{ providerStates: ['AM'] }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Showing 1–10 of 12 records')).toBeInTheDocument();
    });
  });

  it('shows stable loading rows while keeping the table panel and controls present', () => {
    render(
      <OpportunityRankingTable
        {...defaultProps}
        isLoading
        predictions={[]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Opportunity ranking' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByTestId('ranking-skeleton-row')).toHaveLength(5);
    expect(screen.getByLabelText('Opportunity ranking table')).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('Loading opportunity records…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show previous opportunity records' })).toBeDisabled();
  });

  it('exposes retry and filtered empty actions without fabricating rows', async () => {
    const onRetry = vi.fn();
    const onClearFilters = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <OpportunityRankingTable
        {...defaultProps}
        error
        onRetry={onRetry}
        predictions={[]}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('We could not load the opportunity records.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(
      <OpportunityRankingTable
        {...defaultProps}
        filters={{ opportunityTiers: ['low'] }}
        onClearFilters={onClearFilters}
        predictions={[]}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'No opportunity records match the selected filters.',
    );
    expect(screen.getByText('Showing 0 records')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });
});
