import { Router } from 'express';
import { login, issueCookie, clearCookie, requireUser } from '../auth';
import type { AuthedRequest } from '../auth';
import { env } from '../env';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { accountId, password } = req.body || {};
  if (typeof accountId !== 'string' || typeof password !== 'string' || !accountId.trim() || !password) {
    return res.status(400).json({ error: 'Enter your account ID and password.' });
  }
  const result = await login(accountId, password);
  if (!result) return res.status(401).json({ error: 'Those credentials did not match an account.' });
  issueCookie(res, result.token);
  res.json({
    profile: result.profile,
    redirect: result.profile.role === 'instructor' ? '/ace' : '/app',
    insecureDefaultSecret: env.devFallbackSecret && !env.isProd,
  });
});

authRouter.post('/logout', (_req, res) => {
  clearCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireUser, (req, res) => {
  const { id, accountId, displayName, role, createdAt } = (req as AuthedRequest).user;
  res.json({ profile: { id, accountId, displayName, role, createdAt }, redirect: role === 'instructor' ? '/ace' : '/app' });
});
