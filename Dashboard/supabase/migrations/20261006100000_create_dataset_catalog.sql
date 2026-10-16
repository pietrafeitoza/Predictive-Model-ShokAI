-- Dataset catalog: the sources, materialized snapshots, column dictionaries and lineage edges
-- that back the Datasets section of the dashboard. This is metadata only: no dataset rows are
-- stored here, and the partner-confidential source is marked as such. Read-only for authenticated
-- users; writes require backend secret credentials.

create table public.dataset_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  kind text not null check (kind in ('raw', 'interim', 'processed', 'reference', 'model_artifact')),
  provider text,
  description text,
  sensitivity text not null default 'internal' check (
    sensitivity in ('public', 'internal', 'partner_confidential')
  ),
  update_frequency text,
  created_at timestamptz not null default now()
);

create table public.dataset_snapshots (
  id uuid primary key default gen_random_uuid(),
  dataset_source_id uuid not null references public.dataset_sources(id) on delete cascade,
  version text not null,
  checksum text check (checksum is null or checksum ~ '^[0-9a-f]{64}$'),
  storage_path text,
  row_count integer check (row_count is null or row_count >= 0),
  column_count integer check (column_count is null or column_count >= 0),
  period_start date,
  period_end date,
  status text not null default 'available' check (status in ('available', 'pending', 'deprecated')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  generated_at timestamptz not null default now(),
  constraint dataset_snapshots_version_unique unique (dataset_source_id, version),
  constraint dataset_snapshots_period_order check (
    period_start is null or period_end is null or period_start <= period_end
  )
);

create table public.dataset_columns (
  id uuid primary key default gen_random_uuid(),
  dataset_source_id uuid not null references public.dataset_sources(id) on delete cascade,
  name text not null,
  data_type text,
  classification text,
  origin text,
  description text,
  constraint dataset_columns_name_unique unique (dataset_source_id, name)
);

create table public.dataset_lineage_edges (
  id uuid primary key default gen_random_uuid(),
  upstream_snapshot_id uuid not null references public.dataset_snapshots(id) on delete cascade,
  downstream_snapshot_id uuid not null references public.dataset_snapshots(id) on delete cascade,
  relation text not null,
  description text,
  constraint dataset_lineage_unique unique (upstream_snapshot_id, downstream_snapshot_id, relation),
  constraint dataset_lineage_no_self check (upstream_snapshot_id <> downstream_snapshot_id)
);

create index dataset_snapshots_source_idx on public.dataset_snapshots (dataset_source_id);
create index dataset_columns_source_idx on public.dataset_columns (dataset_source_id);
create index dataset_lineage_upstream_idx on public.dataset_lineage_edges (upstream_snapshot_id);
create index dataset_lineage_downstream_idx on public.dataset_lineage_edges (downstream_snapshot_id);

alter table public.dataset_sources enable row level security;
alter table public.dataset_snapshots enable row level security;
alter table public.dataset_columns enable row level security;
alter table public.dataset_lineage_edges enable row level security;

revoke all on table public.dataset_sources from anon, authenticated;
revoke all on table public.dataset_snapshots from anon, authenticated;
revoke all on table public.dataset_columns from anon, authenticated;
revoke all on table public.dataset_lineage_edges from anon, authenticated;
grant select on table public.dataset_sources to authenticated;
grant select on table public.dataset_snapshots to authenticated;
grant select on table public.dataset_columns to authenticated;
grant select on table public.dataset_lineage_edges to authenticated;

create policy "Authenticated users read dataset sources"
  on public.dataset_sources for select to authenticated using (true);

create policy "Authenticated users read dataset snapshots"
  on public.dataset_snapshots for select to authenticated using (true);

create policy "Authenticated users read dataset columns"
  on public.dataset_columns for select to authenticated using (true);

create policy "Authenticated users read dataset lineage"
  on public.dataset_lineage_edges for select to authenticated using (true);
