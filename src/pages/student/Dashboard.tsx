import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, ClipboardCheck, MessageCircleQuestion, Bell, Trophy, PlayCircle, LockKeyhole } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/api';
import type { DashboardData } from '@shared/types';
import { Bouncy } from '@/components/Bouncy';
import { ComicCard, ProgressRing, ProgressBar, SessionCard, EmptyState, Pill } from '@/components/ui';
import { useAskAce } from '@/components/AskAce';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const { setContext } = useAskAce();
  const navigate = useNavigate();

  useEffect(() => {
    setContext({ sessionId: null, lessonId: null, sessionTitle: 'Dashboard', lessonTitle: 'General question' });
    api<DashboardData>('/api/student/dashboard').then(setData).catch(e => setError(e.message));
  }, [setContext]);

  if (error) return <div className="warn-note">{error}</div>;
  if (!data) return <div className="card soft skeleton" style={{ height: 420, borderRadius: 26 }} />;

  return (
    <div className="stack">
      <ComicCard tone="hero">
        <div className="row-between" style={{ alignItems: 'flex-start', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow" style={{ color: 'var(--green-deep)' }}>Your academy</div>
            <h1 className="welcome" style={{ margin: '4px 0 6px' }}>Hey, {data.greetingName}!</h1>
            <p className="hero-lead" style={{ color: 'var(--green-deep)', margin: 0 }}>Your engineering journey starts here.</p>
          </div>
          <ProgressRing percent={data.overallPercent} size={104} />
        </div>
        <div style={{ marginTop: 18 }}>
          <div className="row-between" style={{ fontSize: '.8rem', fontWeight: 900, color: 'var(--green-deep)' }}>
            <span>Overall learning progress</span><span>{data.lessonsCompleted}/{data.lessonsTotal} lessons</span>
          </div>
          <div style={{ marginTop: 7 }}><ProgressBar percent={data.overallPercent} /></div>
        </div>
      </ComicCard>

      {data.activeAttempt && (
        <ComicCard tone="green" className="pop-in">
          <div className="row-between">
            <div>
              <div className="eyebrow">Examination in progress</div>
              <strong>{data.activeAttempt.sessionTitle}</strong>
              <p style={{ fontSize: '.82rem', margin: '4px 0 0' }}>You have an active attempt. Leaving it for the lessons will invalidate it.</p>
            </div>
            <Bouncy variant="dark" size="sm" onClick={() => navigate('/app/exam/' + data.activeAttempt!.examId)}><PlayCircle size={16} /> Resume</Bouncy>
          </div>
        </ComicCard>
      )}

      <div className="stat-grid">
        <div className="stat"><div className="stat-value">{data.sessionsCompleted}</div><div className="stat-label">Sessions cleared</div></div>
        <div className="stat"><div className="stat-value">{data.lessonsCompleted}</div><div className="stat-label">Lessons done</div></div>
        <div className="stat"><div className="stat-value">{data.examinationStatus.filter(e => e.status === 'passed').length}</div><div className="stat-label">Exams passed</div></div>
        <div className="stat"><div className="stat-value">{data.pendingQuestions.length}</div><div className="stat-label">Pending questions</div></div>
      </div>

      {data.currentSession && (
        <ComicCard>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div><div className="eyebrow">Current session</div><h2 className="section-title">Session {data.currentSession.orderIndex} · {data.currentSession.title}</h2></div>
            <Pill tone="amber">Active</Pill>
          </div>
          <p className="muted" style={{ fontSize: '.87rem' }}>{data.currentSession.description}</p>
          <div style={{ margin: '12px 0' }}><ProgressBar percent={data.currentSession.lessonCount ? (data.currentSession.lessonsCompleted / data.currentSession.lessonCount) * 100 : 0} /></div>
          <div className="row-between" style={{ fontSize: '.8rem', fontWeight: 800 }}>
            <span>{data.currentSession.lessonsCompleted}/{data.currentSession.lessonCount} lessons completed</span>
            <span>{data.currentSession.examPassed ? 'Exam passed ✓' : 'Exam pending'}</span>
          </div>
          <div className="btn-row" style={{ marginTop: 14 }}>
            {data.currentLesson
              ? <Bouncy variant="primary" onClick={() => navigate('/app/lesson/' + data.currentLesson!.id)}><PlayCircle size={17} /> Continue: {data.currentLesson.title}</Bouncy>
              : <Bouncy variant="primary" onClick={() => navigate('/app/exam/exam-' + data.currentSession!.id)}><ClipboardCheck size={17} /> Take the examination</Bouncy>}
            <Bouncy onClick={() => navigate('/app/session/' + data.currentSession!.id)}>Open session <ArrowRight size={16} /></Bouncy>
          </div>
        </ComicCard>
      )}

      <div>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h2 className="section-title">Your learning path</h2>
          <Link to="/app/sessions" className="pill plain">View all</Link>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          {data.sessions.slice(0, 5).map(s => <SessionCard key={s.id} session={s} index={s.orderIndex} />)}
        </div>
      </div>

      <ComicCard>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}><ClipboardCheck size={19} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>Examination status</h2></div>
        <div className="stack" style={{ gap: 8 }}>
          {data.examinationStatus.map((e, i) => (
            <div key={i} className="row-between" style={{ padding: '8px 0', borderBottom: i < data.examinationStatus.length - 1 ? '2px dashed color-mix(in srgb, var(--outline) 14%, transparent)' : undefined }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '.88rem' }}>Session {i} · {e.sessionTitle}</strong>
                <div className="muted" style={{ fontSize: '.74rem' }}>{e.attempts} attempt{e.attempts === 1 ? '' : 's'}{e.bestScore !== null ? ` · best ${e.bestScore}%` : ''}</div>
              </div>
              <Pill tone={e.status === 'passed' ? 'green' : e.status === 'failed' ? 'red' : e.status === 'in_progress' ? 'amber' : ''}>
                {e.status === 'passed' ? 'Passed' : e.status === 'failed' ? 'Not passed' : e.status === 'in_progress' ? 'In progress' : 'Not started'}
              </Pill>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '.76rem', marginTop: 12, marginBottom: 0 }}><LockKeyhole size={12} style={{ verticalAlign: -2 }} /> Every session ends with an 80% examination before the next one unlocks. Coding exams also need a passing practical score.</p>
      </ComicCard>

      <ComicCard>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}><Trophy size={19} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>Recent achievements</h2></div>
        {data.achievements.length === 0
          ? <EmptyState title="Your first achievement is waiting" detail="Complete a lesson to earn it. Achievements are derived from real progress." />
          : <div className="grid grid-3">{data.achievements.slice(0, 6).map(a => (
              <div key={a.id} className="card soft tight">
                <div style={{ fontSize: '1.5rem' }}>{a.icon}</div>
                <strong style={{ fontSize: '.86rem' }}>{a.title}</strong>
                <div className="muted" style={{ fontSize: '.74rem' }}>{a.detail}</div>
                <div className="muted" style={{ fontSize: '.7rem', marginTop: 4 }}>{fmtDate(a.earnedAt)}</div>
              </div>
            ))}</div>}
      </ComicCard>

      <div className="grid grid-2">
        <ComicCard>
          <div className="row" style={{ gap: 8, marginBottom: 10 }}><MessageCircleQuestion size={18} /><h3 style={{ fontSize: '1rem' }}>Pending questions</h3></div>
          {data.pendingQuestions.length === 0
            ? <p className="muted" style={{ fontSize: '.84rem' }}>Nothing pending. Tap “Ask Ace” if you get stuck.</p>
            : data.pendingQuestions.slice(0, 3).map(q => (
              <div key={q.id} className="card soft tight" style={{ marginBottom: 8 }}>
                <div className="row-between"><Pill tone="amber">Pending</Pill><span className="muted" style={{ fontSize: '.7rem' }}>{fmtDate(q.createdAt)}</span></div>
                <p style={{ fontSize: '.83rem', margin: '7px 0 0' }}>{q.question}</p>
                <div className="muted" style={{ fontSize: '.72rem' }}>{q.sessionTitle} · {q.lessonTitle}</div>
              </div>
            ))}
          <Link to="/app/questions" className="btn sm" style={{ marginTop: 6 }}>All questions <ArrowRight size={14} /></Link>
        </ComicCard>
        <ComicCard>
          <div className="row" style={{ gap: 8, marginBottom: 10 }}><Bell size={18} /><h3 style={{ fontSize: '1rem' }}>Replies from Ace</h3></div>
          {data.answeredQuestions.length === 0 && data.notifications.length === 0
            ? <p className="muted" style={{ fontSize: '.84rem' }}>No replies yet. Ace's answers and exam results will appear here.</p>
            : <>
              {data.answeredQuestions.slice(0, 2).map(q => (
                <div key={q.id} className="card soft tight" style={{ marginBottom: 8 }}>
                  <div className="eyebrow">Answered {q.answeredVia === 'whatsapp' ? 'on WhatsApp' : 'in the academy'}</div>
                  <p style={{ fontSize: '.83rem', margin: '5px 0' }}>{q.answer || 'Ace marked this as answered outside the site.'}</p>
                  <div className="muted" style={{ fontSize: '.7rem' }}>{fmtDate(q.answeredAt || q.createdAt)}</div>
                </div>
              ))}
              {data.notifications.slice(0, 2).map(n => (
                <div key={n.id} className="row" style={{ gap: 7, fontSize: '.8rem', marginTop: 6 }}><Sparkles size={14} /> {n.message}</div>
              ))}
            </>}
        </ComicCard>
      </div>
    </div>
  );
}
