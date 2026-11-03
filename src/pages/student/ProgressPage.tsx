import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ClipboardCheck, BookOpen } from 'lucide-react';
import { api, fmtDate } from '@/lib/api';
import { SessionCard, ProgressRing, EmptyState } from '@/components/ui';
import { ComicCard, Pill } from '@/components/ui';
import type { SessionSummary, AttemptSummary } from '@shared/types';

interface ProgressData { sessions: SessionSummary[]; achievements: any[]; attempts: AttemptSummary[] }

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  useEffect(() => { api<ProgressData>('/api/student/progress').then(setData).catch(() => {}); }, []);
  if (!data) return <div className="card soft skeleton" style={{ height: 400, borderRadius: 24 }} />;
  const total = data.sessions.reduce((n, s) => n + s.lessonCount, 0) || 1;
  const done = data.sessions.reduce((n, s) => n + s.lessonsCompleted, 0);
  const percent = Math.round((done / total) * 100);

  return (
    <div className="stack">
      <div><div className="eyebrow">Saved across devices</div><h1 className="section-title" style={{ fontSize: '2rem' }}>Your progress</h1></div>
      <ComicCard tone="hero">
        <div className="row" style={{ gap: 20, alignItems: 'center' }}>
          <ProgressRing percent={percent} />
          <div>
            <h2 className="section-title" style={{ color: 'var(--outline)' }}>{done} of {total} lessons</h2>
            <p style={{ color: 'var(--green-deep)', fontWeight: 800, fontSize: '.87rem', margin: 0 }}>
              {data.sessions.filter(s => s.state === 'completed').length} sessions cleared · refreshes, new devices and sign-outs all keep this record.
            </p>
          </div>
        </div>
      </ComicCard>

      <ComicCard>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}><Trophy size={19} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>Achievements</h2></div>
        {data.achievements.length === 0 ? <EmptyState title="No achievements yet" detail="They are earned from real lesson and exam records." /> :
          <div className="grid grid-3">{data.achievements.map(a => (
            <div key={a.id} className="card soft tight"><div style={{ fontSize: '1.6rem' }}>{a.icon}</div><strong style={{ fontSize: '.86rem' }}>{a.title}</strong><div className="muted" style={{ fontSize: '.75rem' }}>{a.detail}</div><div className="muted" style={{ fontSize: '.7rem' }}>{fmtDate(a.earned_at)}</div></div>
          ))}</div>}
      </ComicCard>

      <ComicCard>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}><ClipboardCheck size={19} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>Examination history</h2></div>
        {data.attempts.length === 0 ? <EmptyState title="No attempts yet" detail="Finish a session's lessons, then take its exam." /> : (
          <div className="table-wrap"><table className="data-table">
            <thead><tr><th>Examination</th><th>Variant</th><th>Score</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>{data.attempts.filter(a => a.status !== 'abandoned').map(a => (
              <tr key={a.id}>
                <td><strong>{a.sessionTitle}</strong></td><td>{a.variantLabel}</td>
                <td>{a.score === null ? '—' : `${a.score}%`}</td>
                <td><Pill tone={a.passed ? 'green' : a.status === 'awaiting_review' ? 'amber' : 'red'}>{a.passed ? 'Passed' : a.status === 'awaiting_review' ? 'Review' : a.status === 'graded' ? 'Not passed' : a.status}</Pill></td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.startedAt)}</td>
                <td><Link className="btn sm" to={`/app/exam/${a.examId}/result/${a.id}`}>Review</Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </ComicCard>

      <div>
        <div className="divider-label" style={{ marginBottom: 10 }}><BookOpen size={15} /> Session-by-session</div>
        <div className="stack" style={{ gap: 11 }}>{data.sessions.map(s => <SessionCard key={s.id} session={s} index={s.orderIndex} />)}</div>
      </div>
    </div>
  );
}
