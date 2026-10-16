import { Skeleton } from '@/components/ui/skeleton';

const barHeights = ['h-[46%]', 'h-[70%]', 'h-[56%]', 'h-[82%]', 'h-[64%]'];

export function ChartLoadingState() {
  return (
    <div
      className="flex min-h-[290px] items-end justify-center gap-2.5 rounded-xl border border-border bg-grey-50 px-5 pt-7 pb-5"
      data-testid="chart-loading-state"
      role="status"
    >
      <span className="sr-only">Loading visualization…</span>
      <div className="flex h-[86%] w-[min(88%,420px)] items-end justify-around gap-2.5" aria-hidden="true">
        {barHeights.map((height, index) => (
          <Skeleton key={index} className={`w-[min(42px,14%)] rounded-t-[5px] ${height}`} />
        ))}
      </div>
    </div>
  );
}
