import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DASHBOARD_DATA_SOURCE: z.enum(['mock', 'supabase']).default('mock'),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional().default(''),
  SUPABASE_SECRET_KEY: z.string().optional().default(''),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment configuration:', z.prettifyError(parsedEnv.error));
  throw new Error('Unable to load the environment configuration.');
}

export const env = parsedEnv.data;
