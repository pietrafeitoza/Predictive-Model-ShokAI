# ShokAI contracts

This package is the single public source of runtime schemas and inferred TypeScript types shared by the selected model output, the Node.js backend, and the React frontend. Import from `@shokai/contracts`; internal source files are not public entry points.

The contracts describe one selected supervised regression model at the dashboard boundary. The algorithm enum also supports technical candidate comparison, but it does not imply that the dashboard executes, combines, or displays predictions from all candidate models.

## Domain meaning

- The technical target is exactly `volume_demanda_proxy`.
- Its display name is exactly `Estimated demand volume`.
- Its unit is exactly `billed item quantity`; it is not a patient count.
- Its granularity is operator, treatment line, provider state, and month.
- Provider states are limited to the seven North Region abbreviations.
- City, municipality, verticalization, clusters, confidence intervals, and algorithm-specific details are intentionally absent.
- K-Means operator activity segmentation is outside these contracts and must not be interpreted as operator verticalization.
- Opportunity-tier thresholds remain owned by the future modeling pipeline.

## Filter duplicates

All filter arrays reject duplicated values during validation. Callers must deduplicate filters before parsing or sending them across the API boundary. The package validates filter values only; it does not implement filtering behavior.

## Usage

```ts
import {
  PredictionListResponseSchema,
  type PredictionListResponse,
} from '@shokai/contracts';

const response: PredictionListResponse = PredictionListResponseSchema.parse(input);
```

## Commands

From this directory, run:

```sh
npm test
npm run typecheck
npm run build
```

The tests are self-contained and do not require Supabase, servers, browsers, datasets, or model artifacts.
