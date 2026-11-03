import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { env, now } from './env';
import { db } from './db';
import type { PublicProfile, Role } from '../shared/types';

const COOKIE = 'dc_session';
const DAY = 24 * 60 * 60;

declare global {
  namespace Express {
    interface Request {
      user: PublicProfile & { authUserId: string | null };
    }
  }
}
/** Kept as an alias so route handlers can read req.user without casts. */
export type AuthedRequest = Request;

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export const publicProfile = (row: Record<string, any>): PublicProfile => ({
  id: row.id, accountId: row.account_id, displayName: row.display_name,
  role: row.role as Role, createdAt: row.created_at,
});

const authEmailFor = (accountId: string) => `${accountId.toLowerCase()}@daniellacodes.local`;

function setCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    maxAge: 7 * DAY * 1000,
    path: '/',
  });
}

/** Login is always verified against the database role, never a client claim. */
export async function login(accountId: string, password: string): Promise<{ profile: PublicProfile; token: string } | null> {
  const row = await db.one('profiles', { account_id: accountId.trim() });
  if (!row) return null;

  if (env.authMode === 'supabase') {
    const client = createClient(env.supabaseUrl, env.supabaseAnonKey || env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email: authEmailFor(accountId), password });
    if (error || !data.user) return null;
    if (row.auth_user_id && row.auth_user_id !== data.user.id) return null; // id mismatch = reject
  } else {
    if (!row.password_hash || !(await verifyPassword(password, row.password_hash))) return null;
  }

  const profile = publicProfile(row);
  const token = jwt.sign({ sub: row.id, role: row.role, acc: row.account_id }, env.authSecret, { expiresIn: '7d' });
  await db.update('profiles', { id: row.id }, { last_active_at: now() });
  return { profile, token };
}

export function issueCookie(res: Response, token: string) { setCookie(res, token); }
export function clearCookie(res: Response) { res.clearCookie(COOKIE, { path: '/' }); }

function readToken(req: Request): string | null {
  const cookie = (req as any).cookies?.[COOKIE];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

export const requireUser: RequestHandler = async (req, res, next) => {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
    let payload: any;
    try { payload = jwt.verify(token, env.authSecret); }
    catch { return res.status(401).json({ error: 'Your session expired. Please sign in again.' }); }

    // Re-read the role from the database on EVERY request. A stale or forged
    // claim cannot grant instructor access.
    const row = await db.one('profiles', { id: payload.sub });
    if (!row) return res.status(401).json({ error: 'Account not found.' });
    if (row.role !== payload.role) return res.status(401).json({ error: 'Session no longer valid.' });
    (req as AuthedRequest).user = { ...publicProfile(row), authUserId: row.auth_user_id ?? null };
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole = (role: Role): RequestHandler => (req, res, next) => {
  const user = (req as AuthedRequest).user;
  if (!user) return res.status(401).json({ error: 'Sign in to continue.' });
  if (user.role !== role) return res.status(403).json({ error: 'That area is restricted to ' + role + ' accounts.' });
  next();
};

export const optionalUser: RequestHandler = async (req, _res, next) => {
  try {
    const token = readToken(req);
    if (!token) return next();
    const payload: any = jwt.verify(token, env.authSecret);
    const row = await db.one('profiles', { id: payload.sub });
    if (row) (req as AuthedRequest).user = { ...publicProfile(row), authUserId: row.auth_user_id ?? null };
  } catch { /* unauthenticated is fine */ }
  next();
};

export const audit = async (actorId: string | null, action: string, target?: string, detail?: unknown) => {
  await db.insert('audit_log', { actor_id: actorId, action, target: target ?? null, detail_json: detail ?? null, created_at: now() });
};
