# ShokAI Backend

Initial API built with Node.js 24, TypeScript, and Express.

## Local development

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

The health check is available at `http://localhost:3001/health`. In mock mode, `GET /auth/me`
accepts any non-empty bearer token through the local authentication repository. In Supabase mode,
it validates a Supabase access token.

## Dashboard API

The backend exposes five authenticated, read-only dashboard endpoints:

- `GET /dashboard/predictions` returns filtered prediction records.
- `GET /dashboard/summary` returns demand volume, prediction-record, distinct-operator, and high-opportunity-record aggregates.
- `GET /dashboard/distribution` returns a one-dimensional demand distribution.
- `GET /dashboard/filters` returns unique options from the complete mock dataset.
- `GET /dashboard/model` returns selected-model information, or `data: null` in mock mode.

Every dashboard request must include `Authorization: Bearer <access-token>`. Missing, malformed, invalid, or expired tokens use the existing HTTP 401 authentication response. `/health` remains public, while `/auth/me` remains protected.

The predictions, summary, and distribution endpoints support these optional filters:

- `operatorIds`
- `treatmentLines`
- `providerStates`
- `forecastMonths`
- `opportunityTiers`

Send multiple values by repeating the query parameter. Values within one category use OR semantics, while different categories use AND semantics:

```text
GET /dashboard/predictions?providerStates=AM&providerStates=PA
GET /dashboard/summary?treatmentLines=advanced&forecastMonths=2026-10
GET /dashboard/distribution?dimension=provider_state&opportunityTiers=high
```

Comma-separated lists, empty values, duplicate values, malformed `YYYY-MM` months, unsupported enum values, and unknown query parameters are rejected with HTTP 400. The filter-options endpoint does not accept filters in this slice.

`GET /dashboard/distribution` requires exactly one `dimension` value. Supported dimensions are `provider_state`, `treatment_line`, and `opportunity_tier`. Groups use stable domain ordering rather than demand-volume ordering.

Dashboard envelopes report either `source: "mock"` with null model identifiers or
`source: "supabase"` with the selected model key and version. A normal empty Supabase state also
uses null model identifiers until a model is selected. The target is
`volume_demanda_proxy`, representing estimated billed-item utilization demand volume at operator,
treatment-line, provider-state, and month granularity. These values are not patient counts.
Activity segmentation is not operator verticalization, and the API exposes neither city nor
verticalization fields or filters.

Requests follow `route -> controller -> service -> repository`. Routes apply authentication,
controllers validate HTTP input and concrete response schemas, services implement
framework-independent aggregation, and repositories isolate the data source. Set
`DASHBOARD_DATA_SOURCE=mock` to use `MockDashboardRepository`, or
`DASHBOARD_DATA_SOURCE=supabase` to use `SupabaseDashboardRepository`. Supabase mode requires
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`; incomplete configuration
fails clearly and never falls back to mock data. The Supabase repository reads only the latest
completed import for the selected Random Forest version and validates mapped rows with the shared
contracts.

## Validation

```bash
npm run typecheck
npm test
npm run build
```

Run `npm start` to execute the compiled output from `dist/`.

## Architecture

- `controllers`: translate HTTP requests and responses.
- `services`: contain business rules without depending on Express.
- `repositories`: isolate Supabase access and make it replaceable in tests.

User authentication is handled locally when the dashboard source is `mock` and by Supabase Auth
when the source is `supabase`. Protected API routes validate the access token through the matching
auth repository. `SUPABASE_SECRET_KEY` remains exclusively in the backend `.env` file and must
never be exposed to the frontend.
