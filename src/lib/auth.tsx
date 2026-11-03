import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, post } from './api';
import type { PublicProfile } from '@shared/types';

interface AuthState {
  user: PublicProfile | null;
  loading: boolean;
  login: (accountId: string, password: string) => Promise<PublicProfile>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthState>({ user: null, loading: true, login: async () => { throw new Error('no provider'); }, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<{ profile: PublicProfile }>('/api/auth/me')
      .then(r => setUser(r.profile))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  const login = async (accountId: string, password: string) => {
    const r = await post<{ profile: PublicProfile; redirect: string }>('/api/auth/login', { accountId, password });
    setUser(r.profile);
    return r.profile;
  };
  const logout = async () => { await post('/api/auth/logout'); setUser(null); };
  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
