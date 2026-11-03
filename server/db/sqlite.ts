import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env, randomId } from '../env';
import type { Repo, Row, Where, QueryOptions } from './index';

/** Columns stored as TEXT in SQLite but as JSONB in Postgres. */
export const JSON_COLUMNS: Record<string, string[]> = {
  sessions: ['project_json'],
  lessons: ['content_json', 'topics_json'],
  question_bank: ['variants_json', 'options_json', 'rubric_json', 'visible_tests_json', 'hidden_tests_json', 'static_checks_json'],
  exam_variants: ['question_ids_json'],
  exam_attempts: ['answers_json', 'question_snapshot_json', 'grades_json'],
  submissions: ['output_json'],
  audit_log: ['detail_json'],
};

const encode = (table: string, row: Row): Row => {
  const out: Row = { ...row };
  for (const col of JSON_COLUMNS[table] || []) {
    if (out[col] !== undefined && out[col] !== null && typeof out[col] !== 'string') out[col] = JSON.stringify(out[col]);
  }
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'boolean') out[k] = v ? 1 : 0;
  }
  return out;
};

const decode = (table: string, row: Row): Row => {
  const out: Row = { ...row };
  for (const col of JSON_COLUMNS[table] || []) {
    if (typeof out[col] === 'string') {
      try { out[col] = JSON.parse(out[col]); } catch { /* leave as text */ }
    }
  }
  return out;
};

export class SqliteRepo implements Repo {
  kind = 'sqlite' as const;
  private conn!: DatabaseSync;

  async init() {
    fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });
    fs.mkdirSync(env.storageDir, { recursive: true });
    this.conn = new DatabaseSync(env.databasePath);
    this.conn.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    // When this module is bundled into a single Vercel function, import.meta
    // points at the bundle directory, so also look for the source-tree path.
    const schemaPath = [
      path.resolve(import.meta.dirname, 'schema.sql'),
      path.resolve(process.cwd(), 'server/db/schema.sql'),
    ].find(p => fs.existsSync(p));
    if (!schemaPath) throw new Error('SQLite schema.sql not found');
    this.conn.exec(fs.readFileSync(schemaPath, 'utf8'));
  }

  private buildWhere(where: Where = {}) {
    const clauses: string[] = [];
    const params: (string | number | null)[] = [];
    for (const [col, raw] of Object.entries(where)) {
      const key = col.replace(/[^a-zA-Z0-9_]/g, '');
      if (raw && typeof raw === 'object' && 'op' in raw) {
        const op = raw.op;
        const value = raw.value;
        if (op === 'in') {
          const arr = Array.isArray(value) ? value : [value];
          if (!arr.length) { clauses.push('0 = 1'); continue; }
          clauses.push(`${key} IN (${arr.map(() => '?').join(',')})`);
          arr.forEach(v => params.push(v === null ? null : (typeof v === 'boolean' ? Number(v) : v as any)));
        } else {
          const sqlOp = { neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[op];
          clauses.push(`${key} ${sqlOp} ?`);
          params.push(value === null ? null : value as any);
        }
      } else if (raw === null) {
        clauses.push(`${key} IS NULL`);
      } else {
        clauses.push(`${key} = ?`);
        params.push(typeof raw === 'boolean' ? Number(raw) : raw);
      }
    }
    return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params };
  }

  async all(table: string, opts: QueryOptions = {}): Promise<Row[]> {
    const { sql, params } = this.buildWhere(opts.where);
    const order = opts.order ? ` ORDER BY ${opts.order.column.replace(/[^a-zA-Z0-9_]/g, '')} ${opts.order.dir === 'desc' ? 'DESC' : 'ASC'}` : '';
    const limit = opts.limit ? ` LIMIT ${Number(opts.limit)}` : '';
    const stmt = this.conn.prepare(`SELECT * FROM ${table.replace(/[^a-zA-Z0-9_]/g, '')}${sql}${order}${limit}`);
    return (stmt.all(...params) as Row[]).map(r => decode(table, r));
  }

  async one(table: string, where: Where): Promise<Row | null> {
    const rows = await this.all(table, { where, limit: 1 });
    return rows[0] ?? null;
  }

  async insert(table: string, row: Row): Promise<Row> {
    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
    const columns = this.conn.prepare(`PRAGMA table_info(${safeTable})`).all() as Array<{ name: string }>;
    const hasId = columns.some(c => c.name === 'id');
    const value = encode(table, hasId && row.id === undefined ? { id: randomId(), ...row } : { ...row });
    const cols = Object.keys(value);
    const stmt = this.conn.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
    stmt.run(...cols.map(c => value[c] === undefined ? null : value[c]));
    return decode(table, value);
  }

  async update(table: string, where: Where, patch: Row): Promise<number> {
    const value = encode(table, patch);
    const cols = Object.keys(value);
    if (!cols.length) return 0;
    const { sql, params } = this.buildWhere(where);
    const stmt = this.conn.prepare(`UPDATE ${table} SET ${cols.map(c => `${c} = ?`).join(', ')}${sql}`);
    const result = stmt.run(...cols.map(c => value[c] === undefined ? null : value[c]), ...params);
    return Number(result.changes);
  }

  async remove(table: string, where: Where): Promise<number> {
    const { sql, params } = this.buildWhere(where);
    const result = this.conn.prepare(`DELETE FROM ${table}${sql}`).run(...params);
    return Number(result.changes);
  }
}
