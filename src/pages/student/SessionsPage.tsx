import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SessionCard, EmptyState } from '@/components/ui';
import { ConfirmSheet } from '@/components/overlays';
import { useExamLeavingGuard } from '@/lib/useExamGuard';
import type { DashboardData } from '@shared/types';

export default function SessionsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const { pending, confirm, cancel } = useExamLeavingGuard();
  useEffect(() => { api<DashboardData>('/api/student/dashboard').then(setData).catch(() => {}); }, []);
  if (!data) return <div className="card soft skeleton" style={{ height: 300, borderRadius: 24 }} />;
  const completed = data.sessions.filter(s => s.state === 'completed');
  const active = data.sessions.filter(s => s.state === 'active');
  const locked = data.sessions.filter(s => s.state === 'locked');

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">The complete curriculum</div>
        <h1 className="section-title" style={{ fontSize: '2rem' }}>14 sessions. One engineer.</h1>
        <p className="muted" style={{ fontSize: '.9rem' }}>Sessions unlock in order. Pass an examination and finish every lesson before the next one opens.</p>
      </div>
      {[
        { title: 'Active', list: active },
        { title: 'Completed', list: completed },
        { title: 'Upcoming · locked', list: locked },
      ].map(group => group.list.length > 0 && (
        <section key={group.title} className="stack" style={{ gap: 11 }}>
          <div className="divider-label">{group.title} · {group.list.length}</div>
          {group.list.map(s => <SessionCard key={s.id} session={s} index={s.orderIndex} />)}
        </section>
      ))}
      {data.sessions.length === 0 && <EmptyState title="No sessions published yet" />}
      <ConfirmSheet open={!!pending} danger title="Leave your active examination?"
        body={<>You have an active exam for <strong>{pending?.sessionTitle}</strong>. Leaving to study will <strong>invalidate this attempt</strong>, discard your in-progress answers, and give you a different variant next time. Completed lessons and past exam history stay intact.</>}
        confirmLabel="Leave exam & study" onConfirm={confirm} onCancel={cancel} />
    </div>
  );
}
