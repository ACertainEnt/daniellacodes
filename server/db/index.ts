import { env } from '../env';
import { SqliteRepo } from './sqlite';
import { SupabaseRepo } from './supabase';

export type WhereValue = string | number | boolean | null | { op: 'in' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; value: unknown };
export type Where = Record<string, WhereValue>;
export type Row = Record<string, any>;

export interface QueryOptions {
  where?: Where;
  order?: { column: string; dir?: 'asc' | 'desc' };
  limit?: number;
}

/** The single data contract. Routes never know which database they are using. */
export interface Repo {
  kind: 'sqlite' | 'supabase';
  init(): Promise<void>;
  all(table: string, opts?: QueryOptions): Promise<Row[]>;
  one(table: string, where: Where): Promise<Row | null>;
  insert(table: string, row: Row): Promise<Row>;
  update(table: string, where: Where, patch: Row): Promise<number>;
  remove(table: string, where: Where): Promise<number>;
}

export const db: Repo = env.driver === 'supabase' ? new SupabaseRepo() : new SqliteRepo();
