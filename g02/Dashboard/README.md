# ShokAI Dashboard

The web application is split into two independent TypeScript projects:

- `frontend`: React and Vite user interface.
- `backend`: Express API following a route, controller, service, and repository architecture.

## Development

For the complete mock-backed application, install the workspace dependencies and start both
services with the checked-in mock defaults. Mock mode uses local authentication and does not
require Supabase credentials:

```bash
cd Dashboard
npm install
cp .env.example .env
npm run dev
```

Any non-empty, validly formatted e-mail and any password with at least eight characters can be
used by the local mock sign-in form.

Install and start each project in a separate terminal:

```bash
cd Dashboard/backend
npm install
cp .env.example .env
npm run dev
```

```bash
cd Dashboard/frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`, and the backend health check is available at `http://localhost:3001/health`.

## Supabase authentication

When `VITE_DASHBOARD_DATA_SOURCE=supabase`, authentication uses Supabase Auth in the browser with a
publishable key. The Express API validates bearer access tokens on protected routes; elevated
Supabase credentials remain server-only. Set `DASHBOARD_DATA_SOURCE=supabase` on the backend at the
same time so authentication and dashboard data use the same environment.

Create the frontend environment file:

```bash
cp frontend/.env.example frontend/.env
```

```dotenv
VITE_API_URL=http://localhost:3001
VITE_DASHBOARD_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Use the same project URL and publishable key in `backend/.env`. `SUPABASE_SECRET_KEY` is optional for the current authentication slice and must never be exposed to the frontend.

The frontend supports sign in, account creation, e-mail confirmation feedback, session restoration, a functional “Keep me signed in” preference, and sign out. The API exposes `GET /auth/me` and requires `Authorization: Bearer <access-token>`.

## Authenticated dashboard shell

The protected `/dashboard` route renders a reusable shell from `frontend/src/components/layout`. It contains the ShokAI sidebar, primary navigation, responsive header, authenticated user area, sign-out action, and a shared main-content container. Future destinations are visibly marked as coming soon and do not create speculative routes.

At widths up to 900 px, the sidebar becomes a drawer with close-button, backdrop, and Escape-key support. The drawer restores focus to its menu button when it closes.

The dashboard frontend consumes the protected `GET /dashboard/filters` and
`GET /dashboard/summary` endpoints through the bearer-token API client. It supports operator,
treatment line, provider state, forecast month, and opportunity tier filters, and keeps valid
selections in the `/dashboard` query string.

The visualization components use Recharts and request the protected
`GET /dashboard/distribution` endpoint independently for `provider_state`, `treatment_line`, and
`opportunity_tier`. Every request receives the same active filters. Previous chart data remains
visible while a filtered request refreshes, obsolete responses are ignored, and each chart owns
its loading, retryable error, and empty state. Accessible text summaries expose every group,
estimated demand volume, and prediction-record count without requiring SVG interpretation or a
tooltip.

The opportunity ranking requests protected prediction records from `GET /dashboard/predictions`
with those same active filters. Each row represents one operator, treatment line, provider state,
and forecast-month prediction record; it is not necessarily a unique operator. The visible columns
are display rank, operator, provider state, treatment line, forecast month, estimated demand volume,
and pipeline-provided opportunity tier. The frontend does not calculate tiers or model output.

The small mock result set is sorted and paginated in the browser at 10 records per page. The default
order is estimated demand volume descending, forecast month descending, then operator ID ascending.
Users can instead sort by operator, provider state, treatment line, forecast month, estimated demand
volume, or opportunity tier. The tier order is High, Medium, then Low. Sorting and filter changes
return the table to page one. The table retains prior rows while filtered data refreshes and has
panel-scoped loading, retryable error, and filtered empty states. On narrow screens, its semantic
table remains intact inside a keyboard-focusable horizontal scroll area.

Dashboard data comes from the source selected by the backend-only `DASHBOARD_DATA_SOURCE`
environment variable. `mock` keeps the deterministic `MockDashboardRepository`; `supabase` uses
`SupabaseDashboardRepository` and fails at startup unless the Supabase URL, publishable key, and
secret key are configured. In the frontend, set the matching `VITE_DASHBOARD_DATA_SOURCE` value so
mock mode uses local authentication and Supabase mode uses Supabase Auth. Neither side silently
falls back between modes. Tests may continue to inject their own repositories and services.

Every response identifies its source. The frontend shows `Dashboard preview — mock data` for mock
responses and `Dashboard data loaded from Supabase` for imported predictions. The protected
`GET /dashboard/model` endpoint returns `data: null` in mock mode. In Supabase mode it returns only
the selected Random Forest summary needed by the compact model-information panel; raw features,
hyperparameters, seed values, and source metadata are not exposed there.

Estimated demand volume means estimated billed-item utilization demand volume, not a patient count,
confirmed clinical demand, or a clinical recommendation.

Run the frontend locally with:

```bash
cd Dashboard/frontend
npm run dev
```

## Database migrations

The Supabase CLI is installed as a project dependency. Install it and create the CLI environment file:

```bash
cd Dashboard
npm install
cp .env.example .env
```

Fill in:

```dotenv
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_DB_PASSWORD=your-database-password
```

Preview and apply pending migrations:

```bash
npm run migrate:dry-run
npm run migrate
```

`npm run migrate` links the local Supabase directory to `SUPABASE_PROJECT_REF` and runs `supabase db push`.
If linking fails with `Authorization failed for the access token and project ref pair`, your project role
cannot read the project API keys. Set `SUPABASE_DB_POOLER_HOST` to the session pooler host shown in
Supabase → Connect (for example `aws-0-us-east-1.pooler.supabase.com`); the script then skips linking
and pushes through `postgres.<project-ref>` using `SUPABASE_DB_PASSWORD`.
The migrations create profiles plus the selected-model `model_versions`, `prediction_imports`, and
`predictions` tables. Prediction months are stored as first-of-month dates. The importer always
derives `reference_month` as the calendar month immediately preceding `forecast_month`; it never
uses the current date. RLS permits authenticated reads of completed selected-model data and defines
no frontend write policies.

## Import selected Random Forest predictions

The import reads the existing CSV and `.joblib` bundle without modifying either artifact. The
Python helper prints only `bundle["metadata"]` as JSON and never invokes estimator or prediction
methods after loading. Because `joblib` uses pickle-based deserialization that can execute embedded
code, the configured bundle must come from a trusted source. Its Python environment must include
`joblib` and compatible dependencies needed to deserialize the saved bundle.

Configure `Dashboard/.env` with backend-only values:

```dotenv
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=your-backend-secret
RANDOM_FOREST_PREDICTIONS_PATH=/path/to/north_region_mama_2025_demand_predictions_forest_v1.csv
RANDOM_FOREST_MODEL_BUNDLE_PATH=/path/to/north_region_mama_2025_demand_forest_v1.joblib
PYTHON_BIN=/path/to/compatible/python
```

After applying migrations, run:

```bash
cd Dashboard
npm run import:predictions
```

The importer validates all headers and rows before database writes, maps `baixo`, `medio`, and
`alto` directly to `low`, `medium`, and `high`, computes a SHA-256 checksum, inserts controlled
batches, verifies the row count, and marks the import completed only at the end. A completed import
with the same model version and checksum is skipped. Historical completed imports are retained. If
an import fails after batch creation, cleanup targets only that run's prediction rows and records a
safe failure reason.

For local database tests, start a Docker-compatible container runtime and run:

```bash
npm run supabase:start
npm run test:db
```

## Validation

From `Dashboard`:

```bash
npm test
npm run typecheck
npm run build
```

`npm test` includes Python metadata-helper tests, Node importer tests, shared contracts, backend, and
frontend suites. Supabase calls are replaced with test doubles, so validation requires neither live
credentials nor network access.
