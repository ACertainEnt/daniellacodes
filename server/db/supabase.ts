import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';
import type { Repo, Row, Where, QueryOptions } from './index';

/** SQLite stores booleans as INTEGER 0/1; Postgres uses real booleans. The
 *  rest of the app is written against the SQLite shape, so translate at the
 *  driver boundary. Without this, seed inserts and `where: { passed: 1 }`
 *  filters fail against PostgREST/Postgres. */
const BOOL_COLUMNS = new Set([
  'published', 'approved', 'is_playlist', 'checked', 'requires_code',
  'manual_review', 'passed', 'hidden', 'read',
]);
const toPg = (value: unknown) =>
  value === 1 || value === 0 || value === '1' || value === '0' ? Boolean(Number(value)) : value;
const fromPg = (value: unknown) => (typeof value === 'boolean' ? (value ? 1 : 0) : value);
const rowToPg = (row: Row): Row => {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) out[key] = BOOL_COLUMNS.has(key) ? toPg(value) : value;
  return out;
};
const rowFromPg = (row: Row): Row => {
  const out: Row = { ...row };
  for (const key of Object.keys(out)) if (BOOL_COLUMNS.has(key)) out[key] = fromPg(out[key]);
  return out;
};

/** Production driver. Uses the SERVICE ROLE key, which is only ever read here
 *  on the server. It bypasses RLS, so every route ALSO enforces roles through
 *  server middleware; the shipped RLS policies protect any direct client use.
 *  JSONB columns arrive already parsed, so no codec is needed. */
export class SupabaseRepo implements Repo {
  kind = 'supabase' as const;
  private client!: SupabaseClient;

  async init() {
    this.client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // A trivial read verifies the connection and credentials at startup.
    const { error } = await this.client.from('settings').select('key').limit(1);
    if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  }

  raw(): SupabaseClient { return this.client; }

  private applyWhere<T>(query: T, where: Where = {}): T {
    let q: any = query;
    for (const [col, raw] of Object.entries(where)) {
      if (raw && typeof raw === 'object' && 'op' in raw) {
        const { op, value } = raw;
        if (op === 'in') q = q.in(col, Array.isArray(value) ? value : [value]);
        else if (op === 'neq') q = q.neq(col, value);
        else if (op === 'gt') q = q.gt(col, value);
        else if (op === 'gte') q = q.gte(col, value);
        else if (op === 'lt') q = q.lt(col, value);
        else if (op === 'lte') q = q.lte(col, value);
      } else if (raw === null) {
        q = q.is(col, null);
      } else {
        q = q.eq(col, BOOL_COLUMNS.has(col) ? toPg(raw) : raw);
      }
    }
    return q;
  }

  async all(table: string, opts: QueryOptions = {}): Promise<Row[]> {
    let q: any = this.client.from(table).select('*');
    q = this.applyWhere(q, opts.where);
    if (opts.order) q = q.order(opts.order.column, { ascending: opts.order.dir !== 'desc' });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(`[db:${table}] ${error.message}`);
    return ((data || []) as Row[]).map(rowFromPg);
  }

  async one(table: string, where: Where): Promise<Row | null> {
    const rows = await this.all(table, { where, limit: 1 });
    return rows[0] ?? null;
  }

  async insert(table: string, row: Row): Promise<Row> {
    const { data, error } = await this.client.from(table).insert(rowToPg(row)).select().single();
    if (error) throw new Error(`[db:${table}] ${error.message}`);
    return rowFromPg(data as Row);
  }

  async update(table: string, where: Where, patch: Row): Promise<number> {
    let q: any = this.client.from(table).update(rowToPg(patch));
    q = this.applyWhere(q, where);
    const { data, error } = await q.select();
    if (error) throw new Error(`[db:${table}] ${error.message}`);
    return (data || []).length;
  }

  async remove(table: string, where: Where): Promise<number> {
    let q: any = this.client.from(table).delete();
    q = this.applyWhere(q, where);
    const { data, error } = await q.select();
    if (error) throw new Error(`[db:${table}] ${error.message}`);
    return (data || []).length;
  }
}
