import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { LockKeyhole, Check, ArrowRight, BookOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { SPRING_SOFT } from '@/lib/motion';
import type { SessionSummary } from '@shared/types';

export const Pill = ({ children, tone = '' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | 'plain' | '' }) =>
  <span className={`pill ${tone}`}>{children}</span>;

export function ComicCard({ children, className = '', tone = '', ...rest }: { children: ReactNode; className?: string; tone?: string; [k: string]: any }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={`card ${tone} ${className}`}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={SPRING_SOFT}
      {...rest}
    >{children}</motion.div>
  );
}

export function ProgressRing({ percent, size = 108 }: { percent: number; size?: number }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, percent));
  return (
    <div className="ring-wrap" style={{ width: size, height: size }} role="img" aria-label={`${value}% complete`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="var(--surface)" stroke="var(--outline)" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--outline)" strokeWidth="12" opacity=".15" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--green)" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * value) / 100 }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
        />
      </svg>
      <div className="ring-label">{value}%</div>
    </div>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, percent))}%` }} transition={SPRING_SOFT} />
    </div>
  );
}

export function SessionCard({ session, index, base = '/app/session' }: { session: SessionSummary; index: number; base?: string }) {
  const locked = session.state === 'locked';
  const done = session.state === 'completed';
  const inner = (
    <>
      <div className="session-num">{done ? <Check size={24} strokeWidth={3} /> : locked ? <LockKeyhole size={20} /> : String(index).padStart(2, '0')}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 7, marginBottom: 3 }}>
          <span className="eyebrow">Session {index}</span>
          {done && <Pill tone="green">Cleared</Pill>}
          {locked && <Pill tone="plain">Locked</Pill>}
          {!locked && !done && <Pill tone="amber">In progress</Pill>}
        </div>
        <h3 style={{ fontSize: '1.08rem' }}>{session.title}</h3>
        <p className="muted" style={{ fontSize: '.83rem', margin: '3px 0 8px' }}>{session.subtitle}</p>
        <div className="row" style={{ gap: 8, fontSize: '.76rem', fontWeight: 800 }}>
          <span><BookOpen size={13} style={{ verticalAlign: -2 }} /> {session.lessonsCompleted}/{session.lessonCount} lessons</span>
          {session.examAttempts > 0 && <span>Best: {session.bestScore ?? 0}%</span>}
        </div>
        {session.state === 'active' && <ProgressBar percent={session.lessonCount ? (session.lessonsCompleted / session.lessonCount) * 100 : 0} />}
        {locked && <p className="muted" style={{ fontSize: '.76rem', marginTop: 8, marginBottom: 0 }}>{session.unlockReason}</p>}
      </div>
      {!locked && <ArrowRight size={20} style={{ alignSelf: 'center', flex: 'none' }} />}
    </>
  );
  const reduced = useReducedMotion();
  if (locked) return <div className="card session-card locked" aria-disabled="true">{inner}</div>;
  return (
    <motion.div whileHover={reduced ? undefined : { y: -3 }} whileTap={reduced ? undefined : { scale: .985 }} transition={SPRING_SOFT}>
      <Link to={`${base}/${session.id}`} className="card session-card" style={{ display: 'flex', color: 'var(--text)' }}>{inner}</Link>
    </motion.div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return <div className="empty-state"><strong>{title}</strong>{detail && <p className="muted" style={{ fontSize: '.85rem', margin: '6px 0 0' }}>{detail}</p>}</div>;
}

export function CreatorFooter() {
  return (
    <footer className="creator-footer">
      <div className="creator-signature">Created by Divine (Ace)</div>
      <div className="creator-caption">DANIELLACODES · Learn it. Build it. Understand it.</div>
    </footer>
  );
}
