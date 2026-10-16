import { Button } from '@/components/ui/button';

interface ChartErrorStateProps {
  onRetry(): void;
  title: string;
}

export function ChartErrorState({ onRetry, title }: ChartErrorStateProps) {
  return (
    <div
      className="grid min-h-[290px] place-content-center justify-items-center gap-2.5 rounded-xl border border-danger-border bg-danger-surface p-6 text-center"
      role="alert"
    >
      <span
        className="grid size-8 place-items-center rounded-[9px] bg-card font-mono text-base text-danger"
        aria-hidden="true"
      >
        !
      </span>
      <strong className="text-sm text-navy">We could not load this visualization.</strong>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Retry ${title}`}
        onClick={onRetry}
        className="border-danger text-danger hover:bg-card hover:text-danger"
      >
        Retry
      </Button>
    </div>
  );
}
