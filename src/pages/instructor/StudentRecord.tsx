import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, BookOpen, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { api, fmtDate } from '@/lib/api';
import { ComicCard, ProgressBar, Pill } from '@/components/ui';
import type { SessionSummary, AttemptSummary } from '@shared/types';

interface RecordData {
  student: { displayName: string; accountId: string; joinedAt: string };
  sessions: SessionSummary[]; attempts: AttemptSummary[];
  lessonProgress: Array<{ id: string; lesson_id: string; completed_at: string }>;
}

export default function StudentRecord() {
  const [data, setData] = useState<RecordData | null>(null);
  useEffect(() => { api<RecordData>('/api/instructor/student').then(setData).catch(() => {}); }, []);
  if (!data) return <div className="card soft skeleton" style={{ height: 400, borderRadius: 24 }} />;
  const total = data.sessions.reduce((n, s) => n + s.lessonCount, 0) || 1;
  const done = data.sessions.reduce((n, s) => n + s.lessonsCompleted, 0);

  return (
    <div className="stack">
      <ComicCard tone="hero">
        <div className="row" style={{ gap: 12 }}><GraduationCap size={28} />
          <div><div className="eyebrow" style={{ color: 'var(--green-deep)' }}>Student record</div>
            <h1 className="lesson-heading" style={{ color: 'var(--outline)' }}>{data.student.displayName}</h1>
            <p style={{ color: 'var(--green-deep)', fontSize: '.83rem', margin: 0 }}>{data.student.accountId} · joined {fmtDate(data.student.joinedAt)}</p></div>
        </div>
      </ComicCard>

      <ComicCard>
        <div className="row-between" style={{ marginBottom: 8 }}><strong>Lessons completed</strong><Pill tone="green">{done}/{total}</Pill></div>
        <ProgressBar percent={(done / total) * 100} />
      </ComicCard>

      <ComicCard>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}><BookOpen size={18} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>Sessions</h2></div>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Session</th><th>State</th><th>Lessons</th><th>Exam</th><th>Best</th><th>Attempts</th></tr></thead>
          <tbody>{data.sessions.map(s => (
            <tr key={s.id}><td><strong>{s.orderIndex}. {s.title}</strong></td>
              <td><Pill tone={s.state === 'completed' ? 'green' : s.state === 'locked' ? 'plain' : 'amber'}>{s.state}</Pill></td>
              <td>{s.lessonsCompleted}/{s.lessonCount}</td><td>{s.examPassed ? 'Passed' : 'Not passed'}</td>
              <td>{s.bestScore === null ? '—' : `${s.bestScore}%`}</td><td>{s.examAttempts}</td></tr>
          ))}</tbody>
        </table></div>
      </ComicCard>

      <ComicCard>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}><ClipboardCheck size={18} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>Examination results</h2></div>
        {data.attempts.filter(a => a.status !== 'abandoned').length === 0 && <p className="muted" style={{ fontSize: '.84rem' }}>No graded attempts yet.</p>}
        {data.attempts.filter(a => a.status !== 'abandoned').map(a => (
          <div key={a.id} className="row-between" style={{ padding: '9px 0', borderBottom: '2px dashed color-mix(in srgb, var(--outline) 14%, transparent)' }}>
            <div><strong style={{ fontSize: '.87rem' }}>{a.sessionTitle} · {a.variantLabel}</strong><div className="muted" style={{ fontSize: '.74rem' }}>{fmtDate(a.startedAt)} · {a.status}</div></div>
            <div className="row" style={{ gap: 8 }}><Pill tone={a.passed ? 'green' : 'red'}>{a.score === null ? '—' : `${a.score}%`}</Pill><Link className="btn sm" to={`/ace/attempt/${a.id}`}>Review</Link></div>
          </div>
        ))}
      </ComicCard>

      <ComicCard>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}><CheckCircle2 size={18} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>Lesson completion log</h2></div>
        {data.lessonProgress.length === 0 ? <p className="muted" style={{ fontSize: '.84rem' }}>No lessons completed yet.</p> : (
          <div className="stack" style={{ gap: 5, maxHeight: 300, overflowY: 'auto' }}>
            {data.lessonProgress.map(p => <div key={p.id} className="row" style={{ gap: 8, fontSize: '.8rem' }}><CheckCircle2 size={14} /> <code>{p.lesson_id}</code><span className="muted">{fmtDate(p.completed_at)}</span></div>)}
          </div>
        )}
        <p className="muted" style={{ fontSize: '.75rem', marginTop: 10, marginBottom: 0 }}>These are real persisted records. Instructor resets never alter lesson completion.</p>
      </ComicCard>
    </div>
  );
}
