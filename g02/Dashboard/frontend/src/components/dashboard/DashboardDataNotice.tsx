interface DashboardDataNoticeProps {
  source: 'mock' | 'supabase';
}

export function DashboardDataNotice({ source }: DashboardDataNoticeProps) {
  return (
    <div
      className="inline-flex w-fit items-center gap-2 rounded-full border border-ocean-100 bg-ocean-50 px-3 py-1.5 text-xs font-medium text-ocean-700 shadow-[0_1px_0_rgba(5,46,92,0.03)]"
      role="note"
    >
      <span>
        {source === 'mock'
          ? 'Dashboard preview — mock data'
          : 'Dashboard data loaded from Supabase'}
      </span>
    </div>
  );
}
