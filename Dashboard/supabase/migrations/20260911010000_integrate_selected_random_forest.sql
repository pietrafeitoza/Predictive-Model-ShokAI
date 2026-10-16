-- Selected Random Forest demand integration.
-- Month columns always use the first calendar day. reference_month is deterministically
-- derived as the calendar month immediately preceding forecast_month by the importer.

create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  version text not null,
  algorithm text not null check (algorithm = 'random_forest'),
  status text not null check (status in ('selected', 'archived')),
  target_technical_name text not null check (target_technical_name = 'volume_demanda_proxy'),
  target_display_name text not null check (target_display_name = 'Estimated demand volume'),
  target_unit text not null check (target_unit = 'billed item quantity'),
  training_period_start date,
  training_period_end date not null check (training_period_end = date_trunc('month', training_period_end)::date),
  holdout_period_start date not null check (holdout_period_start = date_trunc('month', holdout_period_start)::date),
  holdout_period_end date not null check (holdout_period_end = date_trunc('month', holdout_period_end)::date),
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
  metric_scope text not null check (metric_scope in ('observed_only_holdout', 'all_holdout_rows')),
  selection_criterion text not null,
  hyperparameters jsonb not null check (jsonb_typeof(hyperparameters) = 'object'),
  feature_list jsonb not null check (jsonb_typeof(feature_list) = 'array'),
  caveats jsonb not null check (jsonb_typeof(caveats) = 'array'),
  source_metadata jsonb not null check (jsonb_typeof(source_metadata) = 'object'),
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint model_versions_key_version_unique unique (model_key, version),
  constraint model_versions_period_order check (
    (training_period_start is null or training_period_start <= training_period_end)
    and training_period_end < holdout_period_start
    and holdout_period_start <= holdout_period_end
  ),
  constraint model_versions_training_start_month check (
    training_period_start is null
    or training_period_start = date_trunc('month', training_period_start)::date
  )
);

create unique index model_versions_one_selected_idx
  on public.model_versions (status)
  where status = 'selected';

create table public.prediction_imports (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.model_versions(id) on delete restrict,
  source_filename text not null,
  source_checksum text not null check (source_checksum ~ '^[0-9a-f]{64}$'),
  row_count integer not null check (row_count >= 0),
  status text not null check (status in ('importing', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  safe_failure_reason text,
  created_at timestamptz not null default now(),
  constraint prediction_imports_status_timestamps check (
    (status = 'importing' and completed_at is null and failed_at is null and safe_failure_reason is null)
    or (status = 'completed' and completed_at is not null and failed_at is null and safe_failure_reason is null)
    or (status = 'failed' and completed_at is null and failed_at is not null and safe_failure_reason is not null)
  )
);

create unique index prediction_imports_completed_checksum_idx
  on public.prediction_imports (model_version_id, source_checksum)
  where status = 'completed';

create index prediction_imports_model_status_idx
  on public.prediction_imports (model_version_id, status);

create table public.predictions (
  id bigint generated always as identity primary key,
  import_batch_id uuid not null references public.prediction_imports(id) on delete restrict,
  operator_id text not null,
  operator_name text,
  treatment_line text not null check (
    treatment_line in ('staging', 'neoadjuvant', 'adjuvant', 'advanced', 'unknown')
  ),
  provider_state text not null check (provider_state in ('AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO')),
  reference_month date not null check (reference_month = date_trunc('month', reference_month)::date),
  forecast_month date not null check (forecast_month = date_trunc('month', forecast_month)::date),
  predicted_demand_volume numeric not null check (predicted_demand_volume >= 0),
  observed_demand_volume numeric check (observed_demand_volume is null or observed_demand_volume >= 0),
  opportunity_tier text not null check (opportunity_tier in ('low', 'medium', 'high')),
  target_measured boolean not null,
  is_structural_zero boolean not null,
  has_recent_history boolean not null,
  created_at timestamptz not null default now(),
  constraint predictions_import_grain_unique unique (
    import_batch_id,
    operator_id,
    treatment_line,
    provider_state,
    forecast_month
  ),
  constraint predictions_one_step_ahead check (
    reference_month = (forecast_month - interval '1 month')::date
  )
);

create index predictions_operator_id_idx on public.predictions (operator_id);
create index predictions_treatment_line_idx on public.predictions (treatment_line);
create index predictions_provider_state_idx on public.predictions (provider_state);
create index predictions_forecast_month_idx on public.predictions (forecast_month);
create index predictions_opportunity_tier_idx on public.predictions (opportunity_tier);
create index predictions_import_batch_idx on public.predictions (import_batch_id);

alter table public.model_versions enable row level security;
alter table public.prediction_imports enable row level security;
alter table public.predictions enable row level security;

revoke all on table public.model_versions from anon, authenticated;
revoke all on table public.prediction_imports from anon, authenticated;
revoke all on table public.predictions from anon, authenticated;
grant select on table public.model_versions to authenticated;
grant select on table public.prediction_imports to authenticated;
grant select on table public.predictions to authenticated;

create policy "Authenticated users read selected model metadata"
  on public.model_versions for select to authenticated
  using (status = 'selected');

create policy "Authenticated users read completed selected imports"
  on public.prediction_imports for select to authenticated
  using (
    status = 'completed'
    and exists (
      select 1 from public.model_versions
      where model_versions.id = prediction_imports.model_version_id
        and model_versions.status = 'selected'
    )
  );

create policy "Authenticated users read completed selected predictions"
  on public.predictions for select to authenticated
  using (
    exists (
      select 1
      from public.prediction_imports
      join public.model_versions
        on model_versions.id = prediction_imports.model_version_id
      where prediction_imports.id = predictions.import_batch_id
        and prediction_imports.status = 'completed'
        and model_versions.status = 'selected'
    )
  );

-- No insert, update, or delete policies are intentionally defined. Imports require
-- backend secret credentials, and anonymous users receive no table privileges.
