import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, TrendingUp, AlertTriangle, MessageCircleQuestion, Video, ClipboardCheck, ArrowRight } from 'lucide-react';
import { api, fmtDate } from '@/lib/api';
import { ComicCard, ProgressRing, Pill, EmptyState } from '@/components/ui';
import { Bouncy } from '@/components/Bouncy';
import type { InstructorOverview } from '@shared/types';

export default function Overview() {
  const [data, setData] = useState<InstructorOverview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<InstructorOverview>('/api/instructor/overview').then(setData).catch(e => setError(e.message)); }, []);
  if (error) return <div className="warn-note">{error}</div>;
  if (!data) return <div className="card soft skeleton" style={{ height: 420, borderRadius: 24 }} />;

  return (
    <div className="stack">
      <ComicCard tone="hero">
        <div className="eyebrow" style={{ color: 'var(--green-deep)' }}>ACECODES · Instructor console</div>
        <h1 className="lesson-heading" style={{ color: 'var(--outline)' }}>Daniella's progress</h1>
        <p style={{ color: 'var(--green-deep)', fontWeight: 800, fontSize: '.88rem', margin: 0 }}>
          {data.student.displayName} · {data.student.accountId} · joined {fmtDate(data.student.joinedAt)}
        </p>
      </ComicCard>

      <div className="grid grid-2">
        <ComicCard>
          <div className="row" style={{ gap: 16, alignItems: 'center' }}>
            <ProgressRing percent={data.overallPercent} size={96} />
            <div>
              <div className="eyebrow">Overall progress</div>
              <strong style={{ fontSize: '1.05rem' }}>{data.lessonsCompleted}/{data.lessonsTotal} lessons</strong>
              <p className="muted" style={{ fontSize: '.8rem', margin: '4px 0 0' }}>{data.completedSessions} sessions cleared · currently on <strong>{data.currentSession || '—'}</strong></p>
              <p className="muted" style={{ fontSize: '.78rem', margin: 0 }}>Current lesson: {data.currentLesson || '—'}</p>
            </div>
          </div>
        </ComicCard>
        <ComicCard>
          <div className="eyebrow">Attention needed</div>
          <div className="stack" style={{ gap: 9, marginTop: 10 }}>
            <div className="row-between"><span className="row" style={{ gap: 7 }}><MessageCircleQuestion size={16} /> Pending questions</span><Pill tone={data.helpPending ? 'amber' : ''}>{data.helpPending}</Pill></div>
            <div className="row-between"><span className="row" style={{ gap: 7 }}><ClipboardCheck size={16} /> Failed examinations</span><Pill tone={data.failedAttempts.length ? 'red' : ''}>{data.failedAttempts.length}</Pill></div>
            <div className="row-between"><span className="row" style={{ gap: 7 }}><Video size={16} /> Lessons with video but no captions</span><Pill tone={data.videosWithoutCaptions ? 'amber' : ''}>{data.videosWithoutCaptions}</Pill></div>
            <div className="row-between"><span className="row" style={{ gap: 7 }}><AlertTriangle size={16} /> Unverified video metadata</span><Pill tone={data.unverifiedVideos ? 'amber' : ''}>{data.unverifiedVideos}</Pill></div>
          </div>
        </ComicCard>
      </div>

      <div className="btn-row">
        <Link className="btn primary" to="/ace/curriculum">Manage course <ArrowRight size={16} /></Link>
        <Link className="btn" to="/ace/exams">Examinations</Link>
        <Link className="btn" to="/ace/inbox">Answer questions</Link>
        <Link className="btn" to="/ace/student">Full student record</Link>
      </div>

      <ComicCard>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}><TrendingUp size={19} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>Areas where she struggles</h2></div>
        {data.strugglingAreas.length === 0
          ? <EmptyState title="No weak areas recorded yet" detail="This fills from real graded attempts, not estimates." />
          : <div className="table-wrap"><table className="data-table">
              <thead><tr><th>Objective</th><th>Session</th><th>Correct</th><th>Accuracy</th></tr></thead>
              <tbody>{data.strugglingAreas.map((a, i) => (
                <tr key={i}><td><strong>{a.objective}</strong></td><td>{a.sessionTitle}</td><td>{a.correct}/{a.total}</td><td><Pill tone="red">{Math.round((a.correct / a.total) * 100)}%</Pill></td></tr>
              ))}</tbody>
            </table></div>}
      </ComicCard>

      <ComicCard>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}><GraduationCap size={19} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>Examination history</h2></div>
        {data.attempts.length === 0 ? <EmptyState title="No attempts yet" /> : (
          <div className="table-wrap"><table className="data-table">
            <thead><tr><th>Exam</th><th>Variant</th><th>Score</th><th>Practical</th><th>Result</th><th>Date</th><th></th></tr></thead>
            <tbody>{data.attempts.filter(a => a.status !== 'abandoned').map(a => (
              <tr key={a.id}>
                <td><strong>{a.sessionTitle}</strong></td><td>{a.variantLabel}</td>
                <td>{a.score === null ? '—' : `${a.score}%`}</td>
                <td>{a.practicalScore === null ? '—' : `${a.practicalScore}%`}</td>
                <td><Pill tone={a.passed ? 'green' : a.status === 'awaiting_review' ? 'amber' : a.status === 'graded' ? 'red' : ''}>{a.passed ? 'Passed' : a.status}</Pill></td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.startedAt)}</td>
                <td><Link className="btn sm" to={`/ace/attempt/${a.id}`}>Review</Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </ComicCard>
      <Bouncy variant="ghost" onClick={() => window.location.reload()}>Refresh data</Bouncy>
    </div>
  );
}
