#!/usr/bin/env node

// Seeds the dataset catalog (Sources, Snapshots, Lineage) from the documented pipeline artifacts
// in scripts/run_pipeline.py and documents/documentation.md. This stores metadata only: row and
// column counts, provenance and lineage. It never stores dataset rows.

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const PIPELINE = 'scripts/run_pipeline.py';

const DATASET_CATALOG = [
  {
    key: 'ans-ambulatorial-by-state',
    name: 'ANS ambulatorial claims by state (2025)',
    kind: 'raw',
    provider: 'ANS / TISS',
    description:
      'Per-state raw ANS/TISS ambulatorial claims for the seven North Region states, roughly 1.4 GB.',
    sensitivity: 'internal',
    updateFrequency: 'annual',
    snapshot: {
      version: '2025',
      storagePath: 'data/raw/ans_ambulatorial/',
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
    },
    columns: [],
  },
  {
    key: 'north-region-ambulatorial-full',
    name: 'North Region merged ambulatorial base (2025)',
    kind: 'interim',
    provider: 'ANS / TISS',
    description: 'Merged 32-column raw base before the breast-cancer filter.',
    sensitivity: 'internal',
    updateFrequency: 'annual',
    snapshot: {
      version: '2025',
      storagePath: 'data/interim/north_region_ambulatorial_full_2025.parquet',
      columnCount: 32,
    },
    columns: [],
  },
  {
    key: 'tuss-sboc-crosswalk',
    name: 'TUSS / SBOC breast-cancer crosswalk',
    kind: 'reference',
    provider: 'TUSS / SBOC 2025',
    description:
      'Maps TUSS procedure codes to breast-cancer treatment lines and subtypes using SBOC 2025 guidelines.',
    sensitivity: 'public',
    updateFrequency: 'per guideline release',
    snapshot: {
      version: '2025',
      storagePath: 'data/reference/tuss_sboc_crosswalk_breast_cancer.csv',
    },
    columns: [
      { name: 'CD_PROCEDIMENTO', dataType: 'text', classification: 'categorical', origin: 'ANS/TISS' },
      { name: 'treatment_line', dataType: 'text', classification: 'categorical', origin: 'derived' },
      { name: 'subtype', dataType: 'text', classification: 'categorical', origin: 'derived' },
      { name: 'search_term', dataType: 'text', classification: 'text', origin: 'derived' },
    ],
  },
  {
    key: 'north-region-mama-data-en',
    name: 'Treated breast-cancer base (North Region, 2025)',
    kind: 'processed',
    provider: 'ANS / TISS',
    description:
      'Cleaned, typed and breast-cancer-scoped event base with engineered features and one-hot encodings.',
    sensitivity: 'internal',
    updateFrequency: 'annual',
    snapshot: {
      version: '2025',
      storagePath: 'data/processed/north_region_mama_2025_data_en.parquet',
      rowCount: 310340,
      columnCount: 119,
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
    },
    columns: [
      { name: 'ID_EVENTO_ATENCAO_SAUDE', dataType: 'text', classification: 'identifier', origin: 'ANS/TISS' },
      { name: 'UF_PRESTADOR', dataType: 'category', classification: 'categorical', origin: 'ANS/TISS' },
      { name: 'DT_REALIZACAO', dataType: 'datetime', classification: 'temporal', origin: 'ANS/TISS' },
      { name: 'CD_PROCEDIMENTO', dataType: 'category', classification: 'categorical', origin: 'ANS/TISS' },
      { name: 'QT_ITEM_EVENTO_INFORMADO', dataType: 'float', classification: 'numerical', origin: 'ANS/TISS' },
      { name: 'VL_TOTAL_REMUNERACAO', dataType: 'float', classification: 'numerical', origin: 'ANS/TISS' },
      { name: 'ID_PLANO', dataType: 'category', classification: 'categorical', origin: 'ANS/TISS' },
      { name: 'treatment_line', dataType: 'text', classification: 'categorical', origin: 'derived' },
      { name: 'subtype', dataType: 'text', classification: 'categorical', origin: 'derived' },
      { name: 'MES', dataType: 'datetime', classification: 'temporal', origin: 'ANS/TISS' },
    ],
  },
  {
    key: 'north-region-mama-data-en-mdg',
    name: 'Medicina de Grupo modeling population',
    kind: 'processed',
    provider: 'ANS / TISS',
    description: 'Treated base filtered to Medicina de Grupo operators, the official modeling population.',
    sensitivity: 'internal',
    updateFrequency: 'annual',
    snapshot: {
      version: '2025',
      storagePath: 'data/processed/north_region_mama_2025_data_en_medicina_de_grupo.parquet',
      rowCount: 70004,
      columnCount: 119,
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
    },
    columns: [],
  },
  {
    key: 'operator-activity-matrix',
    name: 'Operator activity matrix',
    kind: 'interim',
    provider: 'derived',
    description: 'One row per operator with event volume, persistence, reach and procedure diversity.',
    sensitivity: 'internal',
    updateFrequency: 'annual',
    snapshot: {
      version: '2025',
      storagePath: 'data/interim/north_region_mama_2025_activity_matrix.parquet',
      rowCount: 1052,
    },
    columns: [],
  },
  {
    key: 'active-operators',
    name: 'Active operators (K-Means)',
    kind: 'processed',
    provider: 'derived',
    description: 'Active operator population from operator-level K-Means segmentation (cluster 1).',
    sensitivity: 'internal',
    updateFrequency: 'annual',
    snapshot: {
      version: '2025',
      storagePath: 'data/processed/active_operators.parquet',
      rowCount: 339,
      columnCount: 8,
    },
    columns: [],
  },
  {
    key: 'operator-municipality-activity-matrix',
    name: 'Operator x municipality activity matrix',
    kind: 'interim',
    provider: 'derived',
    description: 'One row per operator, beneficiary municipality and provider municipality triple.',
    sensitivity: 'internal',
    updateFrequency: 'annual',
    snapshot: {
      version: '2025',
      storagePath: 'data/interim/north_region_mama_2025_activity_matrix_by_municipality.parquet',
      rowCount: 5089,
    },
    columns: [],
  },
  {
    key: 'active-operator-municipality-pairs',
    name: 'Active operator x municipality pairs (K-Means)',
    kind: 'processed',
    provider: 'derived',
    description: 'Active operator-municipality pairs that define the as-of-month ATUANTE filter.',
    sensitivity: 'internal',
    updateFrequency: 'annual',
    snapshot: {
      version: '2025',
      storagePath: 'data/processed/active_operator_municipality_pairs.parquet',
      rowCount: 874,
    },
    columns: [],
  },
  {
    key: 'modeling-matrix-atuantes-v1',
    name: 'Supervised modeling matrix (atuantes v1)',
    kind: 'processed',
    provider: 'derived',
    description:
      'Operator x treatment line x state x month panel with the demand-volume target and eight approved predictors.',
    sensitivity: 'internal',
    updateFrequency: 'annual',
    snapshot: {
      version: 'v1',
      storagePath: 'data/processed/north_region_mama_2025_modeling_matrix_atuantes_v1.parquet',
      rowCount: 11526,
      columnCount: 13,
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
    },
    columns: [
      { name: 'ID_PLANO', dataType: 'text', classification: 'identifier', origin: 'derived' },
      { name: 'treatment_line_primary', dataType: 'text', classification: 'categorical', origin: 'derived' },
      { name: 'UF_PRESTADOR', dataType: 'text', classification: 'categorical', origin: 'derived' },
      { name: 'MES', dataType: 'date', classification: 'temporal', origin: 'derived' },
      { name: 'volume_demanda_proxy', dataType: 'float', classification: 'target', origin: 'derived' },
      { name: 'DEMAND_LAG_1M', dataType: 'float', classification: 'feature', origin: 'derived' },
      { name: 'DEMAND_MEAN_3M', dataType: 'float', classification: 'feature', origin: 'derived' },
      { name: 'PORTE_ORDINAL', dataType: 'int', classification: 'feature', origin: 'derived' },
      { name: 'MONTH', dataType: 'int', classification: 'feature', origin: 'derived' },
    ],
  },
  {
    key: 'model-registry',
    name: 'Model registry (candidate metrics)',
    kind: 'model_artifact',
    provider: 'derived',
    description: 'Validation-fold and holdout metrics for every evaluated candidate specification.',
    sensitivity: 'internal',
    updateFrequency: 'per model run',
    snapshot: {
      version: '2025',
      storagePath: 'data/processed/model_registry/',
    },
    columns: [],
  },
  {
    key: 'demand-forest-predictions-v1',
    name: 'Random Forest demand predictions (forest-v1)',
    kind: 'model_artifact',
    provider: 'derived',
    description:
      'Selected Random Forest forecast base at operator x treatment line x state x month, imported into the predictions table.',
    sensitivity: 'internal',
    updateFrequency: 'per model run',
    snapshot: {
      version: 'forest-v1',
      storagePath: 'data/processed/north_region_mama_2025_demand_predictions_forest_v1.csv',
      periodStart: '2025-10-01',
      periodEnd: '2025-12-31',
    },
    columns: [],
  },
  {
    key: 'non-hospital-market-share',
    name: 'Non-hospital market share (partner)',
    kind: 'reference',
    provider: 'partner-supplied',
    description:
      'Partner-supplied operator-plan-provider market share used by the verticalization audit. Ownership cannot be identified from it.',
    sensitivity: 'partner_confidential',
    updateFrequency: 'unknown',
    snapshot: {
      version: '2025',
      storagePath: 'data/raw/ans_ambulatorial/market_share_nao_hospitalar_todas_ufs.csv',
    },
    columns: [],
  },
];

const DATASET_LINEAGE = [
  {
    upstream: { key: 'ans-ambulatorial-by-state', version: '2025' },
    downstream: { key: 'north-region-ambulatorial-full', version: '2025' },
    relation: 'merged_into',
    description: 'Per-state files merged into the North Region raw base.',
  },
  {
    upstream: { key: 'north-region-ambulatorial-full', version: '2025' },
    downstream: { key: 'north-region-mama-data-en', version: '2025' },
    relation: 'cleaned_into',
    description: 'Cleaning, typing and breast-cancer scoping.',
  },
  {
    upstream: { key: 'tuss-sboc-crosswalk', version: '2025' },
    downstream: { key: 'north-region-mama-data-en', version: '2025' },
    relation: 'classifies',
    description: 'TUSS codes mapped to treatment lines and subtypes.',
  },
  {
    upstream: { key: 'north-region-mama-data-en', version: '2025' },
    downstream: { key: 'north-region-mama-data-en-mdg', version: '2025' },
    relation: 'filtered_into',
    description: 'Medicina de Grupo population filter.',
  },
  {
    upstream: { key: 'north-region-mama-data-en-mdg', version: '2025' },
    downstream: { key: 'operator-activity-matrix', version: '2025' },
    relation: 'aggregated_into',
    description: 'Operator-level activity metrics.',
  },
  {
    upstream: { key: 'operator-activity-matrix', version: '2025' },
    downstream: { key: 'active-operators', version: '2025' },
    relation: 'segmented_into',
    description: 'K-Means operator segmentation selects active operators.',
  },
  {
    upstream: { key: 'north-region-mama-data-en-mdg', version: '2025' },
    downstream: { key: 'operator-municipality-activity-matrix', version: '2025' },
    relation: 'aggregated_into',
    description: 'Operator x municipality activity metrics.',
  },
  {
    upstream: { key: 'operator-municipality-activity-matrix', version: '2025' },
    downstream: { key: 'active-operator-municipality-pairs', version: '2025' },
    relation: 'segmented_into',
    description: 'K-Means operator-municipality segmentation.',
  },
  {
    upstream: { key: 'north-region-mama-data-en-mdg', version: '2025' },
    downstream: { key: 'modeling-matrix-atuantes-v1', version: 'v1' },
    relation: 'featurized_into',
    description: 'Panel target plus eight approved predictors.',
  },
  {
    upstream: { key: 'active-operator-municipality-pairs', version: '2025' },
    downstream: { key: 'modeling-matrix-atuantes-v1', version: 'v1' },
    relation: 'filters',
    description: 'As-of-month ATUANTE population filter.',
  },
  {
    upstream: { key: 'tuss-sboc-crosswalk', version: '2025' },
    downstream: { key: 'modeling-matrix-atuantes-v1', version: 'v1' },
    relation: 'classifies',
    description: 'Defines treatment_line_primary for the panel grain.',
  },
  {
    upstream: { key: 'modeling-matrix-atuantes-v1', version: 'v1' },
    downstream: { key: 'model-registry', version: '2025' },
    relation: 'trains',
    description: 'Candidate specifications trained and evaluated on the matrix.',
  },
  {
    upstream: { key: 'model-registry', version: '2025' },
    downstream: { key: 'demand-forest-predictions-v1', version: 'forest-v1' },
    relation: 'selected_from',
    description: 'Selected Random Forest produces the shipped prediction base.',
  },
];

function fail(message, error) {
  throw new Error(error?.message ? `${message}: ${error.message}` : message);
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}.`);
  return value;
}

export async function importDatasetCatalog(client) {
  const snapshotIds = new Map();
  const summary = [];

  for (const source of DATASET_CATALOG) {
    const sourceRow = {
      key: source.key,
      name: source.name,
      kind: source.kind,
      provider: source.provider,
      description: source.description,
      sensitivity: source.sensitivity,
      update_frequency: source.updateFrequency,
    };
    const upserted = await client
      .from('dataset_sources')
      .upsert(sourceRow, { onConflict: 'key' })
      .select('id')
      .single();
    if (upserted.error || !upserted.data) fail(`Could not upsert source ${source.key}`, upserted.error);
    const sourceId = upserted.data.id;

    const snapshotRow = {
      dataset_source_id: sourceId,
      version: source.snapshot.version,
      checksum: source.snapshot.checksum ?? null,
      storage_path: source.snapshot.storagePath ?? null,
      row_count: source.snapshot.rowCount ?? null,
      column_count: source.snapshot.columnCount ?? null,
      period_start: source.snapshot.periodStart ?? null,
      period_end: source.snapshot.periodEnd ?? null,
      status: source.snapshot.status ?? 'available',
      metadata: source.snapshot.metadata ?? {},
      generated_at: source.snapshot.generatedAt ?? new Date().toISOString(),
    };
    const snapshot = await client
      .from('dataset_snapshots')
      .upsert(snapshotRow, { onConflict: 'dataset_source_id,version' })
      .select('id')
      .single();
    if (snapshot.error || !snapshot.data) fail(`Could not upsert snapshot ${source.key}`, snapshot.error);
    snapshotIds.set(`${source.key}\u001f${source.snapshot.version}`, snapshot.data.id);

    const cleared = await client.from('dataset_columns').delete().eq('dataset_source_id', sourceId);
    if (cleared.error) fail(`Could not clear columns for ${source.key}`, cleared.error);
    if (source.columns.length > 0) {
      const columnRows = source.columns.map((column) => ({
        dataset_source_id: sourceId,
        name: column.name,
        data_type: column.dataType ?? null,
        classification: column.classification ?? null,
        origin: column.origin ?? null,
        description: column.description ?? null,
      }));
      const inserted = await client.from('dataset_columns').insert(columnRows);
      if (inserted.error) fail(`Could not insert columns for ${source.key}`, inserted.error);
    }

    summary.push({
      key: source.key,
      snapshot: source.snapshot.version,
      columns: source.columns.length,
    });
  }

  const clearedEdges = await client
    .from('dataset_lineage_edges')
    .delete()
    .not('id', 'is', null);
  if (clearedEdges.error) fail('Could not clear lineage edges', clearedEdges.error);

  const edgeRows = DATASET_LINEAGE.map((edge) => {
    const upstream = snapshotIds.get(`${edge.upstream.key}\u001f${edge.upstream.version}`);
    const downstream = snapshotIds.get(`${edge.downstream.key}\u001f${edge.downstream.version}`);
    if (!upstream || !downstream) {
      fail(`Lineage references an unknown snapshot: ${edge.upstream.key} -> ${edge.downstream.key}`);
    }
    return {
      upstream_snapshot_id: upstream,
      downstream_snapshot_id: downstream,
      relation: edge.relation,
      description: edge.description,
    };
  });
  const insertedEdges = await client.from('dataset_lineage_edges').insert(edgeRows);
  if (insertedEdges.error) fail('Could not insert lineage edges', insertedEdges.error);

  return { sources: summary.length, edges: edgeRows.length };
}

async function main() {
  const supabaseUrl = requiredEnvironment('SUPABASE_URL');
  const secretKey = requiredEnvironment('SUPABASE_SECRET_KEY');
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const result = await importDatasetCatalog(client);
  console.log(`Dataset catalog imported: ${result.sources} sources, ${result.edges} lineage edges.`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Dataset catalog import failed.');
    process.exitCode = 1;
  });
}
