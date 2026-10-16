export function ChartEmptyState() {
  return (
    <div
      className="grid min-h-[290px] place-content-center justify-items-center gap-2.5 rounded-xl border border-dashed border-grey-200 bg-grey-50 p-6 text-center"
      role="status"
    >
      <span
        className="grid size-8 place-items-center rounded-[9px] bg-ocean-100 font-mono text-base text-ocean"
        aria-hidden="true"
      >
        —
      </span>
      <strong className="text-sm text-navy">No data is available for the selected filters.</strong>
      <span className="max-w-[38ch] text-[0.8125rem] leading-normal text-muted-foreground">
        Adjust or clear the dashboard filters to view the mock distribution.
      </span>
    </div>
  );
}
