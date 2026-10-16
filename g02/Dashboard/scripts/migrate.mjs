import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dashboardDirectory = fileURLToPath(new URL('..', import.meta.url));
const executableName = process.platform === 'win32' ? 'supabase.cmd' : 'supabase';
const supabaseExecutable = path.join(
  dashboardDirectory,
  'node_modules',
  '.bin',
  executableName,
);
const linkedProjectFile = path.join(
  dashboardDirectory,
  'supabase',
  '.temp',
  'project-ref',
);

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function runSupabase(arguments_) {
  const result = spawnSync(supabaseExecutable, arguments_, {
    cwd: dashboardDirectory,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    fail(`Unable to run the Supabase CLI: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(supabaseExecutable)) {
  fail('Supabase CLI is not installed. Run npm install inside Dashboard first.');
}

const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
const poolerHost = process.env.SUPABASE_DB_POOLER_HOST?.trim();

// Connecting through the session pooler skips `supabase link`, which requires
// Management API privileges (reading project API keys) that not every project member has.
if (poolerHost) {
  if (!projectRef) {
    fail('SUPABASE_PROJECT_REF is required when SUPABASE_DB_POOLER_HOST is set.');
  }

  const databasePassword = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!databasePassword) {
    fail('SUPABASE_DB_PASSWORD is required when SUPABASE_DB_POOLER_HOST is set.');
  }

  const databaseUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(databasePassword)}@${poolerHost}:5432/postgres`;
  runSupabase(['db', 'push', '--db-url', databaseUrl, ...process.argv.slice(2)]);
  process.exit(0);
}

if (projectRef) {
  if (!process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    fail('SUPABASE_ACCESS_TOKEN is required to link the remote project.');
  }

  if (!process.env.SUPABASE_DB_PASSWORD?.trim()) {
    fail('SUPABASE_DB_PASSWORD is required to link the remote database.');
  }

  runSupabase(['link', '--project-ref', projectRef]);
} else if (!existsSync(linkedProjectFile)) {
  fail(
    'Set SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD in Dashboard/.env before the first migration.',
  );
}

runSupabase(['db', 'push', ...process.argv.slice(2)]);
