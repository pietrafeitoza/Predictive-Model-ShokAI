import {
  DashboardFiltersSchema,
  DatasetCatalogSchema,
  ModelRegistryEntrySchema,
  PredictionRecordSchema,
  SelectedModelSummarySchema,
  type DashboardFilters,
  type DatasetCatalog,
  type ModelRegistryEntry,
  type ModelStatus,
  type PredictionRecord,
  type SelectedModelSummary,
} from '@shokai/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { DashboardRepository, DashboardSnapshot } from './dashboard.repository.js';
import { comparePredictions } from './prediction-order.js';

interface ModelVersionRow {
  id: string;
  model_key: string;
  version: string;
  algorithm: string;
  status: string;
  target_technical_name: string;
  target_display_name: string;
  target_unit: string;
  training_period_start: string | null;
  training_period_end: string;
  holdout_period_start: string;
  holdout_period_end: string;
  metrics: unknown;
  metric_scope: string;
  caveats: unknown;
  generated_at: string;
}

interface ImportRow {
  id: string;
  started_at: string;
}

interface PredictionRow {
  id: number | string;
  operator_id: string;
  operator_name: string | null;
  treatment_line: string;
  provider_state: string;
  reference_month: string;
  forecast_month: string;
  predicted_demand_volume: number | string;
  observed_demand_volume: number | string | null;
  opportunity_tier: string;
  target_measured: boolean;
  is_structural_zero: boolean;
  has_recent_history: boolean;
}

interface ModelRegistryRow {
  id: string;
  model_key: string;
  version: string;
  algorithm: string;
  status: string;
  model_role: string | null;
  description: string | null;
  is_deployed: boolean;
  selection_rank: number | null;
  target_technical_name: string;
  target_display_name: string;
  target_unit: string;
  training_period_start: string | null;
  training_period_end: string;
  holdout_period_start: string;
  holdout_period_end: string;
  metric_scope: string;
  selection_criterion: string;
  hyperparameters: unknown;
  feature_list: unknown;
  caveats: unknown;
  generated_at: string;
}

interface DatasetSourceRow {
  id: string;
  key: string;
  name: string;
  kind: string;
  provider: string | null;
  description: string | null;
  sensitivity: string;
  update_frequency: string | null;
}

interface DatasetSnapshotRow {
  id: string;
  dataset_source_id: string;
  version: string;
  checksum: string | null;
  storage_path: string | null;
  row_count: number | null;
  column_count: number | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  generated_at: string;
}

interface DatasetColumnRow {
  dataset_source_id: string;
  name: string;
  data_type: string | null;
  classification: string | null;
  origin: string | null;
  description: string | null;
}

interface DatasetLineageRow {
  upstream_snapshot_id: string;
  downstream_snapshot_id: string;
  relation: string;
  description: string | null;
}

interface ModelMetricRow {
  model_version_id: string;
  dataset_split: string;
  row_scope: string;
  metric: string;
  value: number | string;
  std_dev: number | string | null;
}

interface ModelFoldRow {
  model_version_id: string;
  origin_month: string;
  fit_start_month: string | null;
  fit_end_month: string | null;
  fit_rows: number | null;
  validation_rows: number | null;
  validation_zero_share: number | string | null;
  naive_validation_mae: number | string | null;
}

const modelColumns = [
  'id',
  'model_key',
  'version',
  'algorithm',
  'status',
  'target_technical_name',
  'target_display_name',
  'target_unit',
  'training_period_start',
  'training_period_end',
  'holdout_period_start',
  'holdout_period_end',
  'metrics',
  'metric_scope',
  'caveats',
  'generated_at',
].join(',');

export const PREDICTION_PAGE_SIZE = 1000;

const predictionColumns = [
  'id',
  'operator_id',
  'operator_name',
  'treatment_line',
  'provider_state',
  'reference_month',
  'forecast_month',
  'predicted_demand_volume',
  'observed_demand_volume',
  'opportunity_tier',
  'target_measured',
  'is_structural_zero',
  'has_recent_history',
].join(',');

const registryModelColumns = [
  'id',
  'model_key',
  'version',
  'algorithm',
  'status',
  'model_role',
  'description',
  'is_deployed',
  'selection_rank',
  'target_technical_name',
  'target_display_name',
  'target_unit',
  'training_period_start',
  'training_period_end',
  'holdout_period_start',
  'holdout_period_end',
  'metric_scope',
  'selection_criterion',
  'hyperparameters',
  'feature_list',
  'caveats',
  'generated_at',
].join(',');

function databaseFailure(message: string): never {
  throw new Error(message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// The selected model may be any registry entry, so its stored metrics can be partial. Normalize the
// raw jsonb into the contract shape, using null when a metric is genuinely unavailable.
function mapModelMetrics(raw: unknown): Record<string, unknown> {
  const source = isPlainObject(raw) ? raw : {};
  const mae = finiteOrNull(source.mae) ?? finiteOrNull(source.validationMae) ?? finiteOrNull(source.MAE);
  const rmse = finiteOrNull(source.rmse) ?? finiteOrNull(source.RMSE);
  const r2 = finiteOrNull(source.r2) ?? finiteOrNull(source.R2);
  const maeLog1p = finiteOrNull(source.maeLog1p) ?? finiteOrNull(source.MAE_log1p);
  const skillVsNaive = finiteOrNull(source.skillVsNaive) ?? finiteOrNull(source.skill);
  const metrics: Record<string, unknown> = { mae, rmse, r2 };
  if (maeLog1p !== null) metrics.maeLog1p = maeLog1p;
  if (skillVsNaive !== null) metrics.skillVsNaive = skillVsNaive;
  return metrics;
}

function matchesFilters(prediction: PredictionRecord, filters: DashboardFilters): boolean {
  return (
    (filters.operatorIds === undefined || filters.operatorIds.includes(prediction.operatorId)) &&
    (filters.treatmentLines === undefined ||
      filters.treatmentLines.includes(prediction.treatmentLine)) &&
    (filters.providerStates === undefined ||
      filters.providerStates.includes(prediction.providerState)) &&
    (filters.forecastMonths === undefined ||
      filters.forecastMonths.includes(prediction.forecastMonth)) &&
    (filters.opportunityTiers === undefined ||
      filters.opportunityTiers.includes(prediction.opportunityTier))
  );
}

function toYearMonth(value: string): string {
  return value.slice(0, 7);
}

function mapModel(row: ModelVersionRow): SelectedModelSummary {
  const caveats = Array.isArray(row.caveats)
    ? row.caveats.filter((value): value is string => typeof value === 'string')
    : [];
  const utilizationCaveat = caveats.find((value) => /billed item quantity/i.test(value));

  return SelectedModelSummarySchema.parse({
    modelId: row.model_key,
    modelVersion: row.version,
    algorithm: row.algorithm,
    status: row.status,
    targetTechnicalName: row.target_technical_name,
    targetDisplayName: row.target_display_name,
    targetUnit: row.target_unit,
    granularity: ['operator', 'treatment_line', 'provider_state', 'month'],
    trainingPeriodStart: row.training_period_start ? toYearMonth(row.training_period_start) : null,
    trainingPeriodEnd: toYearMonth(row.training_period_end),
    holdoutPeriodStart: toYearMonth(row.holdout_period_start),
    holdoutPeriodEnd: toYearMonth(row.holdout_period_end),
    metrics: mapModelMetrics(row.metrics),
    metricScope: row.metric_scope,
    caveat:
      utilizationCaveat ??
      'Estimated billed-item utilization demand volume; not confirmed clinical demand or a clinical recommendation.',
    generatedAt: row.generated_at,
  });
}

function mapPrediction(
  row: PredictionRow,
  selectedModel: SelectedModelSummary,
  importRow: ImportRow,
): PredictionRecord {
  return PredictionRecordSchema.parse({
    predictionId: String(row.id),
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    treatmentLine: row.treatment_line,
    providerState: row.provider_state,
    referenceMonth: toYearMonth(row.reference_month),
    forecastMonth: toYearMonth(row.forecast_month),
    predictedDemandVolume: Number(row.predicted_demand_volume),
    observedDemandVolume:
      row.observed_demand_volume === null ? null : Number(row.observed_demand_volume),
    opportunityTier: row.opportunity_tier,
    targetMeasured: row.target_measured,
    isStructuralZero: row.is_structural_zero,
    hasRecentHistory: row.has_recent_history,
    modelId: selectedModel.modelId,
    modelVersion: selectedModel.modelVersion,
    generatedAt: importRow.started_at,
  });
}

function toNullableNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

function mapRegistryEntry(
  row: ModelRegistryRow,
  metrics: ModelMetricRow[],
  folds: ModelFoldRow[],
  hasPredictionImport: boolean,
): ModelRegistryEntry {
  return ModelRegistryEntrySchema.parse({
    modelId: row.model_key,
    modelVersion: row.version,
    algorithm: row.algorithm,
    status: row.status,
    role: row.model_role,
    description: row.description,
    selected: row.status === 'selected',
    deployed: row.is_deployed,
    hasPredictionImport,
    selectionRank: row.selection_rank,
    targetTechnicalName: row.target_technical_name,
    targetDisplayName: row.target_display_name,
    targetUnit: row.target_unit,
    trainingPeriodStart: row.training_period_start ? toYearMonth(row.training_period_start) : null,
    trainingPeriodEnd: toYearMonth(row.training_period_end),
    holdoutPeriodStart: toYearMonth(row.holdout_period_start),
    holdoutPeriodEnd: toYearMonth(row.holdout_period_end),
    metricScope: row.metric_scope,
    selectionCriterion: row.selection_criterion,
    hyperparameters: isPlainObject(row.hyperparameters) ? row.hyperparameters : {},
    featureList: toStringArray(row.feature_list),
    caveats: toStringArray(row.caveats),
    generatedAt: row.generated_at,
    metrics: metrics.map((metric) => ({
      split: metric.dataset_split,
      rowScope: metric.row_scope,
      metric: metric.metric,
      value: Number(metric.value),
      stdDev: toNullableNumber(metric.std_dev),
    })),
    validationFolds: folds.map((fold) => ({
      originMonth: toYearMonth(fold.origin_month),
      fitStartMonth: fold.fit_start_month ? toYearMonth(fold.fit_start_month) : null,
      fitEndMonth: fold.fit_end_month ? toYearMonth(fold.fit_end_month) : null,
      fitRows: fold.fit_rows,
      validationRows: fold.validation_rows,
      validationZeroShare: toNullableNumber(fold.validation_zero_share),
      naiveValidationMae: toNullableNumber(fold.naive_validation_mae),
    })),
  });
}

export class SupabaseDashboardRepository implements DashboardRepository {
  readonly source = 'supabase' as const;

  // The current import is immutable between imports, so the full prediction base is loaded once
  // and filtered in memory afterwards. This keeps summary, distribution, filters and backtests
  // from re-reading ~16 pages from PostgREST on every request.
  private snapshotCache: { importId: string; records: Promise<PredictionRecord[]> } | null = null;

  constructor(private readonly client: SupabaseClient) {}

  private async fetchAllPredictionRows(importId: string): Promise<PredictionRow[]> {
    const buildQuery = (columns: string) =>
      this.client
        .from('predictions')
        .select(columns, { count: 'exact' })
        .eq('import_batch_id', importId);

    // PostgREST caps each response (1000 rows by default). Read the first page to learn the total,
    // then request the remaining pages in parallel instead of paying one round trip per page.
    const firstPage = await buildQuery(predictionColumns)
      .order('id', { ascending: true })
      .range(0, PREDICTION_PAGE_SIZE - 1);
    if (firstPage.error) databaseFailure('Could not load dashboard predictions.');

    const rows: PredictionRow[] = [...((firstPage.data ?? []) as unknown as PredictionRow[])];
    const pageCount =
      typeof firstPage.count === 'number' ? Math.ceil(firstPage.count / PREDICTION_PAGE_SIZE) : null;

    if (pageCount === null) {
      // No server count available: fall back to sequential paging until a short page arrives.
      let lastLength = firstPage.data?.length ?? 0;
      for (
        let offset = PREDICTION_PAGE_SIZE;
        lastLength >= PREDICTION_PAGE_SIZE;
        offset += PREDICTION_PAGE_SIZE
      ) {
        const result = await buildQuery(predictionColumns)
          .order('id', { ascending: true })
          .range(offset, offset + PREDICTION_PAGE_SIZE - 1);
        if (result.error) databaseFailure('Could not load dashboard predictions.');
        const page = (result.data ?? []) as unknown as PredictionRow[];
        rows.push(...page);
        lastLength = page.length;
      }
    } else if (pageCount > 1) {
      const pagePromises = [];
      for (let page = 1; page < pageCount; page += 1) {
        const offset = page * PREDICTION_PAGE_SIZE;
        pagePromises.push(
          buildQuery(predictionColumns)
            .order('id', { ascending: true })
            .range(offset, offset + PREDICTION_PAGE_SIZE - 1),
        );
      }

      const pages = await Promise.all(pagePromises);
      for (const result of pages) {
        if (result.error) databaseFailure('Could not load dashboard predictions.');
        rows.push(...((result.data ?? []) as unknown as PredictionRow[]));
      }
    }

    return rows;
  }

  private loadAllPredictions(
    selectedModel: SelectedModelSummary,
    importRow: ImportRow,
  ): Promise<PredictionRecord[]> {
    if (this.snapshotCache?.importId === importRow.id) return this.snapshotCache.records;

    const records = this.fetchAllPredictionRows(importRow.id)
      .then((rows) =>
        rows
          .map((row) => mapPrediction(row, selectedModel, importRow))
          .sort(comparePredictions),
      )
      .catch((error: unknown) => {
        if (this.snapshotCache?.records === records) this.snapshotCache = null;
        throw error;
      });

    this.snapshotCache = { importId: importRow.id, records };
    return records;
  }

  private async findSelectedModelRow(): Promise<ModelVersionRow | null> {
    const result = await this.client
      .from('model_versions')
      .select(modelColumns)
      .eq('status', 'selected')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) databaseFailure('Could not load selected model metadata.');
    return result.data as ModelVersionRow | null;
  }

  private async findLatestCompletedImport(modelVersionId: string): Promise<ImportRow | null> {
    const result = await this.client
      .from('prediction_imports')
      .select('id,started_at')
      .eq('model_version_id', modelVersionId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) databaseFailure('Could not load the completed prediction import.');
    return result.data as ImportRow | null;
  }

  async findSelectedModel(): Promise<SelectedModelSummary | null> {
    const row = await this.findSelectedModelRow();
    return row ? mapModel(row) : null;
  }

  async setModelStatus(
    modelKey: string,
    version: string,
    status: ModelStatus,
  ): Promise<boolean> {
    const target = await this.client
      .from('model_versions')
      .select('id,status')
      .eq('model_key', modelKey)
      .eq('version', version)
      .maybeSingle();
    if (target.error) databaseFailure('Could not load the model version.');
    if (!target.data) return false;

    const targetId = target.data.id as string;
    const currentStatus = target.data.status as string;

    if (status === 'selected') {
      const current = await this.client
        .from('model_versions')
        .select('id')
        .eq('status', 'selected')
        .maybeSingle();
      if (current.error) databaseFailure('Could not load the current selected model.');

      if (current.data && current.data.id !== targetId) {
        const demote = await this.client
          .from('model_versions')
          .update({ status: 'candidate' })
          .eq('id', current.data.id)
          .eq('status', 'selected');
        if (demote.error) databaseFailure('Could not update the previously selected model.');
      }

      if (currentStatus !== 'selected') {
        const promote = await this.client
          .from('model_versions')
          .update({ status: 'selected' })
          .eq('id', targetId);
        if (promote.error) databaseFailure('Could not update the model status.');
      }

      return true;
    }

    // candidate or archived: the active model is never demoted here.
    if (currentStatus === 'selected') return false;

    const update = await this.client
      .from('model_versions')
      .update({ status })
      .eq('id', targetId);
    if (update.error) databaseFailure('Could not update the model status.');
    return true;
  }

  async findPredictions(filters?: DashboardFilters): Promise<PredictionRecord[]> {
    return (await this.findSnapshot(filters)).predictions;
  }

  async findSnapshot(filters?: DashboardFilters): Promise<DashboardSnapshot> {
    const parsedFilters = DashboardFiltersSchema.parse(filters ?? {});
    const modelRow = await this.findSelectedModelRow();
    if (!modelRow) return { predictions: [], selectedModel: null };
    const selectedModel = mapModel(modelRow);
    const importRow = await this.findLatestCompletedImport(modelRow.id);
    if (!importRow) return { predictions: [], selectedModel };

    const all = await this.loadAllPredictions(selectedModel, importRow);

    return {
      predictions: all.filter((prediction) => matchesFilters(prediction, parsedFilters)),
      selectedModel,
    };
  }

  async findPredictionById(predictionId: string): Promise<PredictionRecord | null> {
    const modelRow = await this.findSelectedModelRow();
    if (!modelRow) return null;
    const selectedModel = mapModel(modelRow);
    const importRow = await this.findLatestCompletedImport(modelRow.id);
    if (!importRow) return null;

    const result = await this.client
      .from('predictions')
      .select(predictionColumns)
      .eq('import_batch_id', importRow.id)
      .eq('id', predictionId)
      .maybeSingle();
    if (result.error) databaseFailure('Could not load the dashboard prediction.');
    return result.data
      ? mapPrediction(result.data as unknown as PredictionRow, selectedModel, importRow)
      : null;
  }

  async findModelRegistry(): Promise<ModelRegistryEntry[]> {
    const versions = await this.client
      .from('model_versions')
      .select(registryModelColumns)
      .order('selection_rank', { ascending: true, nullsFirst: false })
      .order('model_key', { ascending: true })
      .order('version', { ascending: true });
    if (versions.error) databaseFailure('Could not load the model registry.');

    const rows = (versions.data ?? []) as unknown as ModelRegistryRow[];
    if (rows.length === 0) return [];

    const modelVersionIds = rows.map(({ id }) => id);
    const [metricsResult, foldsResult, importsResult] = await Promise.all([
      this.client
        .from('model_metrics')
        .select('model_version_id,dataset_split,row_scope,metric,value,std_dev')
        .in('model_version_id', modelVersionIds),
      this.client
        .from('model_validation_folds')
        .select(
          'model_version_id,origin_month,fit_start_month,fit_end_month,fit_rows,validation_rows,validation_zero_share,naive_validation_mae',
        )
        .in('model_version_id', modelVersionIds),
      this.client
        .from('prediction_imports')
        .select('model_version_id')
        .eq('status', 'completed')
        .in('model_version_id', modelVersionIds),
    ]);
    if (metricsResult.error) databaseFailure('Could not load the model metrics.');
    if (foldsResult.error) databaseFailure('Could not load the model validation folds.');
    if (importsResult.error) databaseFailure('Could not load the model prediction imports.');

    const importedModelIds = new Set(
      ((importsResult.data ?? []) as { model_version_id: string }[]).map(
        (row) => row.model_version_id,
      ),
    );

    const metricsByModel = new Map<string, ModelMetricRow[]>();
    for (const metric of (metricsResult.data ?? []) as unknown as ModelMetricRow[]) {
      const bucket = metricsByModel.get(metric.model_version_id) ?? [];
      bucket.push(metric);
      metricsByModel.set(metric.model_version_id, bucket);
    }

    const foldsByModel = new Map<string, ModelFoldRow[]>();
    for (const fold of (foldsResult.data ?? []) as unknown as ModelFoldRow[]) {
      const bucket = foldsByModel.get(fold.model_version_id) ?? [];
      bucket.push(fold);
      foldsByModel.set(fold.model_version_id, bucket);
    }

    return rows.map((row) =>
      mapRegistryEntry(
        row,
        (metricsByModel.get(row.id) ?? []).sort(
          (left, right) =>
            left.dataset_split.localeCompare(right.dataset_split) ||
            left.row_scope.localeCompare(right.row_scope) ||
            left.metric.localeCompare(right.metric),
        ),
        (foldsByModel.get(row.id) ?? []).sort((left, right) =>
          left.origin_month.localeCompare(right.origin_month),
        ),
        importedModelIds.has(row.id),
      ),
    );
  }

  async findDatasetCatalog(): Promise<DatasetCatalog> {
    const [sourcesResult, snapshotsResult, columnsResult, lineageResult] = await Promise.all([
      this.client
        .from('dataset_sources')
        .select('id,key,name,kind,provider,description,sensitivity,update_frequency')
        .order('kind', { ascending: true })
        .order('name', { ascending: true }),
      this.client
        .from('dataset_snapshots')
        .select(
          'id,dataset_source_id,version,checksum,storage_path,row_count,column_count,period_start,period_end,status,generated_at',
        ),
      this.client
        .from('dataset_columns')
        .select('dataset_source_id,name,data_type,classification,origin,description')
        .order('name', { ascending: true }),
      this.client
        .from('dataset_lineage_edges')
        .select('upstream_snapshot_id,downstream_snapshot_id,relation,description'),
    ]);

    if (sourcesResult.error) databaseFailure('Could not load the dataset sources.');
    if (snapshotsResult.error) databaseFailure('Could not load the dataset snapshots.');
    if (columnsResult.error) databaseFailure('Could not load the dataset columns.');
    if (lineageResult.error) databaseFailure('Could not load the dataset lineage.');

    const sources = (sourcesResult.data ?? []) as unknown as DatasetSourceRow[];
    const snapshots = (snapshotsResult.data ?? []) as unknown as DatasetSnapshotRow[];
    const columns = (columnsResult.data ?? []) as unknown as DatasetColumnRow[];
    const edges = (lineageResult.data ?? []) as unknown as DatasetLineageRow[];

    const snapshotsBySource = new Map<string, DatasetSnapshotRow[]>();
    const snapshotRef = new Map<string, { key: string; version: string }>();
    const sourceKeyById = new Map(sources.map((source) => [source.id, source.key]));

    for (const snapshot of snapshots) {
      const bucket = snapshotsBySource.get(snapshot.dataset_source_id) ?? [];
      bucket.push(snapshot);
      snapshotsBySource.set(snapshot.dataset_source_id, bucket);
      snapshotRef.set(snapshot.id, {
        key: sourceKeyById.get(snapshot.dataset_source_id) ?? snapshot.dataset_source_id,
        version: snapshot.version,
      });
    }

    const columnsBySource = new Map<string, DatasetColumnRow[]>();
    for (const column of columns) {
      const bucket = columnsBySource.get(column.dataset_source_id) ?? [];
      bucket.push(column);
      columnsBySource.set(column.dataset_source_id, bucket);
    }

    return DatasetCatalogSchema.parse({
      sources: sources.map((source) => ({
        key: source.key,
        name: source.name,
        kind: source.kind,
        provider: source.provider,
        description: source.description,
        sensitivity: source.sensitivity,
        updateFrequency: source.update_frequency,
        snapshots: (snapshotsBySource.get(source.id) ?? [])
          .slice()
          .sort((left, right) => left.version.localeCompare(right.version))
          .map((snapshot) => ({
            version: snapshot.version,
            checksum: snapshot.checksum,
            storagePath: snapshot.storage_path,
            rowCount: snapshot.row_count,
            columnCount: snapshot.column_count,
            periodStart: snapshot.period_start,
            periodEnd: snapshot.period_end,
            status: snapshot.status,
            generatedAt: snapshot.generated_at,
          })),
        columns: (columnsBySource.get(source.id) ?? []).map((column) => ({
          name: column.name,
          dataType: column.data_type,
          classification: column.classification,
          origin: column.origin,
          description: column.description,
        })),
      })),
      lineage: edges
        .map((edge) => {
          const upstream = snapshotRef.get(edge.upstream_snapshot_id);
          const downstream = snapshotRef.get(edge.downstream_snapshot_id);
          if (!upstream || !downstream) return null;
          return {
            upstreamKey: upstream.key,
            upstreamVersion: upstream.version,
            downstreamKey: downstream.key,
            downstreamVersion: downstream.version,
            relation: edge.relation,
            description: edge.description,
          };
        })
        .filter((edge): edge is NonNullable<typeof edge> => edge !== null)
        .sort(
          (left, right) =>
            left.upstreamKey.localeCompare(right.upstreamKey) ||
            left.downstreamKey.localeCompare(right.downstreamKey),
        ),
    });
  }
}
