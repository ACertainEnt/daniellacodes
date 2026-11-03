import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Sun, Moon, Bell, LogOut, UserRound, type LucideIcon } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api, post, fmtDate } from '@/lib/api';
import { Bouncy } from './Bouncy';
import { Sheet } from './overlays';
import { InstallAcademy } from './InstallAcademy';
import { CreatorFooter } from './ui';
import type { DashboardData } from '@shared/types';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

export function Shell({ nav, subtitle, children, student }: { nav: NavItem[]; subtitle: string; children: ReactNode; student?: boolean }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<DashboardData['notifications']>([]);

  const openNotifications = async () => {
    setNotifOpen(true);
    if (!student) return;
    try {
      const d = await api<DashboardData>('/api/student/dashboard');
      setNotifications(d.notifications);
      await Promise.all(d.notifications.filter(n => !n.read).map(n => post(`/api/student/notifications/${n.id}/read`)));
    } catch { /* non-critical */ }
  };

  const doLogout = async () => { await logout(); navigate('/login', { replace: true }); };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand" style={{ marginBottom: 20 }}>
          <div className="brand-mark">D</div>
          <div><div className="brand-name">DANIELLACODES</div><div className="brand-sub">{subtitle}</div></div>
        </div>
        {nav.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
            <n.icon size={19} /> {n.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <div className="card soft tight" style={{ fontSize: '.78rem' }}>
          <strong>{user?.displayName}</strong><br /><span className="muted">{user?.accountId}</span>
        </div>
        <button className="side-link" onClick={doLogout}><LogOut size={19} /> Sign out</button>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">D</div>
            <div style={{ minWidth: 0 }}>
              <div className="brand-name">DANIELLACODES</div>
              <div className="brand-sub">{subtitle}</div>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn small" onClick={toggle} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="icon-btn small" onClick={openNotifications} aria-label="Notifications"><Bell size={18} /></button>
            <button className="icon-btn small" onClick={() => setAccountOpen(true)} aria-label="Account"><UserRound size={18} /></button>
          </div>
        </header>

        <main className="app-content">
          {children}
          <CreatorFooter />
          <InstallAcademy />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Main navigation">
        {nav.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <n.icon /> <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <Sheet open={accountOpen} onClose={() => setAccountOpen(false)} title="Account"
        footer={<Bouncy variant="danger" block onClick={doLogout}><LogOut size={17} /> Sign out</Bouncy>}>
        <div className="card soft tight">
          <div className="eyebrow">Signed in as</div>
          <strong style={{ fontSize: '1.1rem' }}>{user?.displayName}</strong>
          <div className="muted">{user?.accountId} · {user?.role}</div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <Bouncy variant="outline" onClick={toggle}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />} {theme === 'light' ? 'Dark mode' : 'Light mode'}</Bouncy>
        </div>
      </Sheet>

      <Sheet open={notifOpen} onClose={() => setNotifOpen(false)} title="Notifications">
        {notifications.length === 0
          ? <p className="muted">No notifications yet. Exam results and Ace's replies will appear here.</p>
          : notifications.map(n => (
            <div key={n.id} className="card soft tight" style={{ marginBottom: 9 }}>
              <div className="row-between"><strong style={{ fontSize: '.88rem' }}>{n.message}</strong>{!n.read && <span className="badge-dot" />}</div>
              <div className="muted" style={{ fontSize: '.74rem', marginTop: 4 }}>{fmtDate(n.createdAt)}</div>
            </div>
          ))}
      </Sheet>
    </div>
  );
}
