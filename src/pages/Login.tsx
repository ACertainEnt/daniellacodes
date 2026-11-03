import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Bouncy } from '@/components/Bouncy';
import { SPRING_SOFT } from '@/lib/motion';
import { CreatorFooter } from '@/components/ui';

export default function Login() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [accountId, setAccountId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const profile = await login(accountId, password);
      navigate(profile.role === 'instructor' ? '/ace' : '/app', { replace: true });
    } catch (err: any) { setError(err.message || 'Could not sign in.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div style={{ width: 'min(100%, 430px)' }}>
        <div className="row-between" style={{ marginBottom: 18 }}>
          <div className="pill green"><ShieldCheck size={13} /> Private academy</div>
          <button className="icon-btn small" onClick={toggle} aria-label="Toggle theme">{theme === 'light' ? '🌙' : '☀️'}</button>
        </div>
        <motion.div className="card login-card pop-in" initial={reduced ? false : { opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={SPRING_SOFT}>
          <div className="brand" style={{ marginBottom: 18 }}>
            <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 28 }}>D</div>
            <div>
              <div className="login-logo display">DANIELLACODES</div>
              <div className="brand-sub">Personal Full-Stack Engineering Academy</div>
            </div>
          </div>
          <h2 style={{ fontSize: '1.15rem', marginBottom: 4 }}>Welcome back.</h2>
          <p className="muted" style={{ fontSize: '.88rem' }}>Learn it. Build it. Understand it. Sign in with the account ID Ace created for you.</p>
          {!navigator.onLine && <div className="warn-note">Sign-in requires an internet connection. If you were already signed in, keep the academy open to use saved lesson text.</div>}
          <form onSubmit={submit} className="stack" style={{ marginTop: 18, gap: 14 }}>
            <div>
              <label className="field-label" htmlFor="account">Account ID</label>
              <input id="account" className="input" autoComplete="username" autoCapitalize="characters" spellCheck={false}
                placeholder="e.g. DANIELLACODES" value={accountId} onChange={e => setAccountId(e.target.value)} required />
            </div>
            <div>
              <label className="field-label" htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input id="password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: 48 }} />
                <button type="button" className="icon-btn small" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 6, top: 6, boxShadow: 'none' }}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            {error && <div className="warn-note" style={{ fontSize: '.85rem' }}>{error}</div>}
            <Bouncy variant="primary" block type="submit" disabled={busy}><LogIn size={18} /> {busy ? 'Signing in…' : 'SIGN IN'}</Bouncy>
          </form>
          <p className="muted" style={{ fontSize: '.76rem', marginTop: 16, marginBottom: 0 }}>
            This academy is private. Public registration is disabled; there are exactly two accounts (student and instructor).
          </p>
        </motion.div>
        <CreatorFooter />
      </div>
    </div>
  );
}
