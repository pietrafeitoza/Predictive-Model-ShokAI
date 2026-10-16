-- Generalize the model registry so candidate models can live next to the selected model.
-- The shared contracts already expose decision_tree, linear_regression and random_forest plus
-- the candidate/selected/archived statuses; the original table only allowed random_forest and
-- selected/archived. This migration aligns the database with those contracts and adds the
-- normalized metric tables the model comparator reads (validation folds and holdout metrics).
-- It is additive: no existing column or row is changed.

alter table public.model_versions
  drop constraint if exists model_versions_algorithm_check;

alter table public.model_versions
  add constraint model_versions_algorithm_check check (
    algorithm in (
      'random_forest',
      'decision_tree',
      'linear_regression',
      'ridge',
      'lasso',
      'elasticnet',
      'seasonal_naive',
      'group_mean'
    )
  );

alter table public.model_versions
  drop constraint if exists model_versions_status_check;

alter table public.model_versions
  add constraint model_versions_status_check check (
    status in (
      'candidate',
      'validation_leader',
      'provisional_challenger',
      'operational_default',
      'explanatory_artifact',
      'recommended',
      'selected',
      'rejected',
      'archived'
    )
  );

alter table public.model_versions
  add column if not exists model_role text,
  add column if not exists description text,
  add column if not exists is_deployed boolean not null default false,
  add column if not exists selection_rank integer;

alter table public.model_versions
  add constraint model_versions_selection_rank_check check (
    selection_rank is null or selection_rank >= 1
  );

comment on column public.model_versions.model_role is
  'Operational role assigned by the project recommendation, e.g. provisional_challenger.';
comment on column public.model_versions.is_deployed is
  'True only for the model the dashboard currently treats as the operational default.';

create table public.model_metrics (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.model_versions(id) on delete cascade,
  dataset_split text not null check (dataset_split in ('validation', 'holdout')),
  row_scope text not null check (row_scope in ('all', 'observed', 'none')),
  metric text not null check (metric in ('mae', 'rmse', 'r2', 'skill', 'mae_log1p')),
  value numeric not null,
  std_dev numeric,
  created_at timestamptz not null default now(),
  constraint model_metrics_grain_unique unique (model_version_id, dataset_split, row_scope, metric)
);

comment on table public.model_metrics is
  'Per-model evaluation metrics. row_scope distinguishes all validation/holdout rows from observed-only rows.';

create index model_metrics_model_version_idx on public.model_metrics (model_version_id);

create table public.model_validation_folds (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.model_versions(id) on delete cascade,
  origin_month date not null check (origin_month = date_trunc('month', origin_month)::date),
  fit_start_month date check (
    fit_start_month is null or fit_start_month = date_trunc('month', fit_start_month)::date
  ),
  fit_end_month date check (
    fit_end_month is null or fit_end_month = date_trunc('month', fit_end_month)::date
  ),
  fit_rows integer check (fit_rows is null or fit_rows >= 0),
  validation_rows integer check (validation_rows is null or validation_rows >= 0),
  validation_zero_share numeric check (
    validation_zero_share is null
    or (validation_zero_share >= 0 and validation_zero_share <= 1)
  ),
  naive_validation_mae numeric check (naive_validation_mae is null or naive_validation_mae >= 0),
  created_at timestamptz not null default now(),
  constraint model_validation_folds_grain_unique unique (model_version_id, origin_month),
  constraint model_validation_folds_period_order check (
    fit_start_month is null
    or fit_end_month is null
    or fit_start_month <= fit_end_month
  )
);

comment on table public.model_validation_folds is
  'Expanding-window validation origins used to select each model, with the seasonal-naive MAE of the same rows.';

create index model_validation_folds_model_version_idx
  on public.model_validation_folds (model_version_id);

alter table public.model_metrics enable row level security;
alter table public.model_validation_folds enable row level security;

revoke all on table public.model_metrics from anon, authenticated;
revoke all on table public.model_validation_folds from anon, authenticated;
grant select on table public.model_metrics to authenticated;
grant select on table public.model_validation_folds to authenticated;

-- The model comparator is authenticated-only and read-only. It must see candidate models, so
-- model metadata becomes readable to any authenticated user; archived versions stay visible for
-- traceability but nothing is writable from the frontend. Metrics inherit the same access.
create policy "Authenticated users read model metadata"
  on public.model_versions for select to authenticated
  using (true);

create policy "Authenticated users read model metrics"
  on public.model_metrics for select to authenticated
  using (true);

create policy "Authenticated users read model validation folds"
  on public.model_validation_folds for select to authenticated
  using (true);
