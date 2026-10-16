import type { PropsWithChildren } from 'react';

import { cn } from '@/lib/utils';
import { ChartEmptyState } from './ChartEmptyState';
import { ChartErrorState } from './ChartErrorState';
import { ChartLoadingState } from './ChartLoadingState';

interface ChartPanelProps extends PropsWithChildren {
  className?: string;
  description: string;
  error: boolean;
  id: string;
  interactiveHint?: string;
  isEmpty: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  onRetry(): void;
  title: string;
}

export function ChartPanel({
  children,
  className,
  description,
  error,
  id,
  interactiveHint,
  isEmpty,
  isLoading,
  isRefreshing,
  onRetry,
  title,
}: ChartPanelProps) {
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <article
      className={cn(
        'relative grid min-h-[390px] min-w-0 animate-fade-up grid-rows-[auto_minmax(0,1fr)] gap-[18px] overflow-hidden rounded-2xl border border-border bg-white p-[22px] shadow-[0_1px_2px_rgba(5,46,92,0.04),0_16px_34px_-26px_rgba(5,46,92,0.45)]',
        className,
      )}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1.5">
          <h3
            id={titleId}
            className="font-heading text-[1.0625rem] font-bold tracking-[-0.02em] text-navy"
          >
            {title}
          </h3>
          <p id={descriptionId} className="max-w-[58ch] text-[0.8125rem] leading-normal text-muted-foreground">
            {description}
          </p>
          {interactiveHint ? (
            <span className="inline-flex w-fit items-center text-[0.75rem] font-medium text-ocean-600">
              {interactiveHint}
            </span>
          ) : null}
        </div>
        {isRefreshing ? (
          <span
            className="inline-flex shrink-0 items-center rounded-full bg-ocean-50 px-2.5 py-1 font-mono text-[0.6875rem] text-ocean-700"
            role="status"
          >
            Refreshing…
          </span>
        ) : null}
      </div>

      <div className="grid min-h-[290px] min-w-0" aria-busy={isLoading || isRefreshing}>
        {isLoading ? <ChartLoadingState /> : null}
        {!isLoading && error ? <ChartErrorState onRetry={onRetry} title={title} /> : null}
        {!isLoading && !error && isEmpty ? <ChartEmptyState /> : null}
        {!isLoading && !error && !isEmpty ? children : null}
      </div>
    </article>
  );
}
