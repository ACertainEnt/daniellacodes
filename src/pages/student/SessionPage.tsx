import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Circle, ClipboardCheck, FolderGit2, LockKeyhole, Clock3 } from 'lucide-react';
import { api } from '@/lib/api';
import { Bouncy } from '@/components/Bouncy';
import { ComicCard, ProgressBar, Pill, EmptyState } from '@/components/ui';
import { ConfirmSheet } from '@/components/overlays';
import { useExamLeavingGuard } from '@/lib/useExamGuard';
import { useAskAce } from '@/components/AskAce';
import type { StudentSessionDetail } from '@shared/types';

export default function SessionPage() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const { setContext } = useAskAce();
  const [data, setData] = useState<StudentSessionDetail | null>(null);
  const [error, setError] = useState('');
  const { pending, confirm, cancel } = useExamLeavingGuard();

  useEffect(() => {
    api<StudentSessionDetail>(`/api/student/sessions/${sessionId}`)
      .then(d => { setData(d); setContext({ sessionId, lessonId: null, sessionTitle: d.session.title, lessonTitle: 'Session overview' }); })
      .catch(e => setError(e.message));
  }, [sessionId, setContext]);

  if (error) return <div className="stack"><Bouncy onClick={() => navigate('/app')}><ArrowLeft size={16} /> Back</Bouncy><div className="warn-note"><LockKeyhole size={16} /> {error}</div></div>;
  if (!data) return <div className="card soft skeleton" style={{ height: 380, borderRadius: 24 }} />;

  const s = data.session;
  const allLessonsDone = s.lessonsCompleted >= s.lessonCount;
  return (
    <div className="stack">
      <Bouncy variant="ghost" onClick={() => navigate('/app/sessions')}><ArrowLeft size={16} /> All sessions</Bouncy>
      <ComicCard tone="hero">
        <div className="eyebrow" style={{ color: 'var(--green-deep)' }}>Session {s.orderIndex}</div>
        <h1 className="lesson-heading" style={{ color: 'var(--outline)' }}>{s.title}</h1>
        <p className="hero-lead" style={{ color: 'var(--green-deep)' }}>{s.subtitle}</p>
        <p style={{ fontSize: '.88rem', margin: '10px 0 0', color: 'var(--green-deep)' }}>{s.description}</p>
      </ComicCard>

      <ComicCard>
        <div className="row-between" style={{ marginBottom: 8 }}>
          <strong>Lesson progress</strong><Pill tone={allLessonsDone ? 'green' : 'amber'}>{s.lessonsCompleted}/{s.lessonCount}</Pill>
        </div>
        <ProgressBar percent={s.lessonCount ? (s.lessonsCompleted / s.lessonCount) * 100 : 0} />
        <p className="muted" style={{ fontSize: '.79rem', margin: '10px 0 0' }}>You can revisit any completed lesson. Opening a lesson never marks it complete — you choose when you are done.</p>
      </ComicCard>

      <div>
        <div className="divider-label" style={{ marginBottom: 10 }}><BookOpen size={15} /> Lessons</div>
        <div className="stack" style={{ gap: 9 }}>
          {data.lessons.length === 0 && <EmptyState title="No published lessons yet" detail="Ace is still preparing this session." />}
          {data.lessons.map((l, i) => (
            <ComicCard key={l.id} className="tight" tone={l.completed ? 'soft' : ''}>
              <div className="row-between">
                <div className="row" style={{ gap: 11, minWidth: 0 }}>
                  {l.completed ? <CheckCircle2 size={22} style={{ flex: 'none', color: 'var(--green-deep)' }} /> : <Circle size={22} style={{ flex: 'none' }} />}
                  <div style={{ minWidth: 0 }}>
                    <div className="eyebrow">Lesson {i + 1} · {l.minutes} min</div>
                    <strong style={{ fontSize: '.92rem' }}>{l.title}</strong>
                  </div>
                </div>
                <Bouncy size="sm" variant={l.completed ? 'outline' : 'primary'} onClick={() => navigate('/app/lesson/' + l.id)}>
                  {l.completed ? 'Revisit' : 'Open'}
                </Bouncy>
              </div>
            </ComicCard>
          ))}
        </div>
      </div>

      {data.project && (
        <ComicCard>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}><FolderGit2 size={18} /><h2 className="section-title" style={{ fontSize: '1.35rem' }}>{data.project.title}</h2></div>
          <p style={{ fontSize: '.88rem' }}>{data.project.brief}</p>
          <div className="divider-label" style={{ margin: '14px 0 8px' }}>Requirements</div>
          <ul style={{ fontSize: '.85rem', margin: 0 }}>{data.project.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
          <div className="divider-label" style={{ margin: '14px 0 8px' }}>Acceptance criteria</div>
          <ul style={{ fontSize: '.85rem', margin: 0 }}>{data.project.acceptanceCriteria.map((r, i) => <li key={i}>{r}</li>)}</ul>
          {data.project.stretchGoals.length > 0 && <>
            <div className="divider-label" style={{ margin: '14px 0 8px' }}>Stretch goals</div>
            <ul style={{ fontSize: '.85rem', margin: 0 }}>{data.project.stretchGoals.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </>}
        </ComicCard>
      )}

      {data.exam && (
        <ComicCard tone={data.exam.passed ? 'soft' : ''}>
          <div className="row-between">
            <div>
              <div className="eyebrow">End-of-session examination</div>
              <h2 className="section-title" style={{ fontSize: '1.3rem' }}>{data.exam.title}</h2>
            </div>
            {data.exam.passed ? <Pill tone="green">Passed</Pill> : <Pill tone="amber">80% to pass</Pill>}
          </div>
          <div className="row" style={{ gap: 12, fontSize: '.82rem', fontWeight: 800, margin: '10px 0' }}>
            <span><Clock3 size={14} style={{ verticalAlign: -2 }} /> {data.exam.minutes} minutes</span>
            <span><ClipboardCheck size={14} style={{ verticalAlign: -2 }} /> {data.exam.attempts} attempt{data.exam.attempts === 1 ? '' : 's'}</span>
            {data.exam.bestScore !== null && <span>Best {data.exam.bestScore}%</span>}
            {data.exam.requiresCode && <span>Code editor included</span>}
          </div>
          <p className="muted" style={{ fontSize: '.82rem' }}>Pass to unlock the next session. Each new attempt uses a different variant of the question bank.</p>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <Bouncy variant="primary" onClick={() => navigate('/app/exam/' + data.exam!.id)}>
              <ClipboardCheck size={17} /> {data.exam.passed ? 'Retake / review' : allLessonsDone ? 'Start examination' : 'See requirements'}
            </Bouncy>
          </div>
          {!allLessonsDone && <p className="muted" style={{ fontSize: '.76rem', marginTop: 8, marginBottom: 0 }}>Finish all {s.lessonCount} lessons first ({s.lessonsCompleted} done).</p>}
        </ComicCard>
      )}

      <Link className="btn" to="/app/questions">Ask Ace about this session</Link>
      <ConfirmSheet open={!!pending} danger title="Leave your active examination?"
        body={<>You have an active exam for <strong>{pending?.sessionTitle}</strong>. Coming back to the lessons will <strong>invalidate this attempt</strong> and discard its in-progress answers. Your next attempt will be a different variant. Completed lessons and past results remain intact.</>}
        confirmLabel="Leave exam & study" onConfirm={confirm} onCancel={cancel} />
    </div>
  );
}
