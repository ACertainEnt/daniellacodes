import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/* Tiny .env loader — no dependency, server-side only. */
function loadDotEnv() {
  const file = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnv();

const required = (name: string, fallback: string) => process.env[name] || fallback;

export const env = {
  port: Number(required('PORT', '5173')),
  isProd: process.env.NODE_ENV === 'production',
  authSecret: required('AUTH_SECRET', 'dev-only-insecure-secret-change-me-please-32chars'),
  devFallbackSecret: !process.env.AUTH_SECRET,
  driver: (process.env.DATA_DRIVER === 'supabase' ? 'supabase' : 'sqlite') as 'sqlite' | 'supabase',
  authMode: (process.env.AUTH_MODE === 'supabase' ? 'supabase' : 'local') as 'local' | 'supabase',
  databasePath: path.resolve(process.cwd(), required('DATABASE_PATH', './data/daniellacodes.db')),
  storageDir: path.resolve(process.cwd(), required('STORAGE_DIR', './storage')),
  studentAccount: required('STUDENT_ACCOUNT_ID', 'DANIELLACODES'),
  studentPassword: required('STUDENT_PASSWORD', 'daniella-learns'),
  studentName: required('STUDENT_DISPLAY_NAME', 'Daniella'),
  instructorAccount: required('INSTRUCTOR_ACCOUNT_ID', 'ACECODES'),
  instructorPassword: required('INSTRUCTOR_PASSWORD', 'ace-teaches'),
  instructorName: required('INSTRUCTOR_DISPLAY_NAME', 'Divine (Ace)'),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  whatsappNumber: '2348107543761',
};

if (env.driver === 'supabase' && (!env.supabaseUrl || !env.supabaseServiceRoleKey)) {
  console.error('[env] DATA_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

export const randomId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
