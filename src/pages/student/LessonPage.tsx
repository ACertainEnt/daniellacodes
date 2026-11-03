import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, BookOpen, Lightbulb, Code2, ListChecks, AlertTriangle, Target, Sparkles, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { api, post } from '@/lib/api';
import { Bouncy } from '@/components/Bouncy';
import { ComicCard, Pill, EmptyState } from '@/components/ui';
import { ConfirmSheet, toast } from '@/components/overlays';
import { VideoLesson, LocalVideoPlayer } from '@/components/VideoLesson';
import { useAskAce } from '@/components/AskAce';
import { useExamLeavingGuard } from '@/lib/useExamGuard';
import { localGet, localPut } from '@/lib/offline';
import { LessonNotes, rememberLesson } from '@/components/OfflineLearning';
import type { StudentLessonDetail } from '@shared/types';

const VIDEO_EXT = /\.(mp4|webm|ogg)$/i;

export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const navigate = useNavigate();
  const { setContext } = useAskAce();
  const [lesson, setLesson] = useState<StudentLessonDetail | null>(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [offlineCopy, setOfflineCopy] = useState(false);
  const [busy, setBusy] = useState(false);
  const { pending, confirm, cancel } = useExamLeavingGuard();

  useEffect(() => {
    let active = true;
    setAnswers({}); setLesson(null); setError(''); setOfflineCopy(false);
    localGet<Record<number, number>>('answers:' + lessonId).then(saved => { if (active && saved) setAnswers(saved); }).catch(() => {});
    api<StudentLessonDetail>(`/api/student/lessons/${lessonId}`)
      .then(d => {
        if (!active) return;
        setLesson(d);
        setContext({ sessionId: d.sessionId, lessonId: d.id, sessionTitle: d.sessionTitle, lessonTitle: d.title });
        localPut('lesson:' + lessonId, d).then(() => rememberLesson({ id: d.id, title: d.title })).catch(() => {});
      })
      .catch(async e => {
        // Never use an old cached lesson to bypass a server authorization failure.
        if (!(e instanceof TypeError) && navigator.onLine) { if (active) setError(e.message); return; }
        try {
          const cached = await localGet<StudentLessonDetail>('lesson:' + lessonId);
          if (!active) return;
          if (!cached) { setError('This lesson is not saved on this device yet. Connect to the internet to open it.'); return; }
          setLesson(cached); setOfflineCopy(true);
        } catch { if (active) setError('Offline storage is unavailable. Connect to open this lesson.'); }
      });
    return () => { active = false; };
  }, [lessonId, setContext]);

  // Restore only after this lesson has rendered, and retain the position while
  // opening sheets. Positions are device-local, not official progress.
  useEffect(() => {
    if (!lesson || lesson.id !== lessonId) return;
    const key = 'dc-reading:' + lessonId;
    let timer = 0;
    let restore = 0;
    try {
      const y = Number(localStorage.getItem(key));
      if (Number.isFinite(y) && y > 0) restore = window.setTimeout(() => window.scrollTo(0, y), 100);
    } catch { /* storage is optional */ }
    const save = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { try { localStorage.setItem(key, String(window.scrollY)); } catch { /* storage is optional */ } }, 300);
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => { window.clearTimeout(restore); window.clearTimeout(timer); window.removeEventListener('scroll', save); try { localStorage.setItem(key, String(window.scrollY)); } catch { /* storage is optional */ } };
  }, [lesson?.id, lessonId]);

  const localVideos = useMemo(() => lesson?.assets.filter(a => VIDEO_EXT.test(a.url)) || [], [lesson]);
  const vtt = lesson?.subtitles[0]?.vtt;

  const complete = async () => {
    if (!lesson) return;
    setBusy(true);
    try {
      await post(`/api/student/lessons/${lesson.id}/complete`);
      setLesson({ ...lesson, completed: true, completedAt: new Date().toISOString() });
      toast.show('Lesson marked as completed. Nice work!');
    } catch (e: any) { toast.show(e.message, 'warn'); }
    finally { setBusy(false); }
  };

  if (error) return <div className="stack"><Bouncy onClick={() => navigate('/app/sessions')}><ArrowLeft size={16} /> Back</Bouncy><div className="warn-note">{error}</div></div>;
  if (!lesson) return <div className="card soft skeleton" style={{ height: 520, borderRadius: 24 }} />;

  return (
    <div className="stack">
      {offlineCopy && <div className="comic-note">Offline copy · Lesson text is saved on this device. Videos, Ask Ace and official assessments require internet. Completion still requires a connection.</div>}
      <div className="row-between">
        <Bouncy variant="ghost" onClick={() => navigate('/app/session/' + lesson.sessionId)}><ArrowLeft size={16} /> {lesson.sessionTitle}</Bouncy>
        <Pill tone={lesson.completed ? 'green' : 'plain'}>{lesson.completed ? 'Completed ✓' : 'In progress'}</Pill>
      </div>

      <ComicCard tone="hero">
        <div className="eyebrow" style={{ color: 'var(--green-deep)' }}>1 · Lesson title · {lesson.minutes} min</div>
        <h1 className="lesson-heading" style={{ color: 'var(--outline)' }}>{lesson.title}</h1>
      </ComicCard>

      {/* 2 — What she will learn */}
      <ComicCard className="lesson-section">
        <div className="row" style={{ gap: 8, marginBottom: 10 }}><Target size={18} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>What you will learn</h2></div>
        <div className="tag-list">{lesson.whatYouWillLearn.map((x, i) => <span key={i} className="pill plain">{x}</span>)}</div>
      </ComicCard>

      {/* 3 — Why it matters */}
      <ComicCard className="lesson-section soft">
        <div className="row" style={{ gap: 8, marginBottom: 8 }}><Lightbulb size={18} /><h2 className="section-title" style={{ fontSize: '1.2rem' }}>Why this matters</h2></div>
        <p style={{ fontSize: '.9rem', margin: 0 }}>{lesson.whyItMatters}</p>
      </ComicCard>

      {/* Video lessons + independent subtitles */}
      {lesson.videos.length > 0 && (
        <section className="stack" style={{ gap: 14 }}>
          <div className="divider-label">Video lessons · independent English subtitles</div>
          {lesson.videos.map(v => <VideoLesson key={v.id} video={v} subtitles={lesson.subtitles} lessonTitle={lesson.title} />)}
        </section>
      )}
      {localVideos.map(a => <LocalVideoPlayer key={a.id} src={a.url} vtt={vtt} title={a.title} />)}

      {/* 4 — Explanation */}
      <section className="stack" style={{ gap: 12 }}>
        <div className="divider-label">Explanation, in plain English</div>
        {lesson.explanation.map((block, i) => (
          <ComicCard key={i} className="lesson-section">
            <h3 className="explain-heading">{block.heading}</h3>
            {block.paragraphs.map((p, j) => <p key={j} style={{ fontSize: '.9rem', color: j === 1 ? 'var(--text-soft)' : undefined }}>{p}</p>)}
          </ComicCard>
        ))}
      </section>

      {/* 5 — Step by step */}
      <ComicCard className="lesson-section">
        <div className="row" style={{ gap: 8, marginBottom: 8 }}><ListChecks size={18} /><h2 className="section-title" style={{ fontSize: '1.25rem' }}>Step-by-step breakdown</h2></div>
        {lesson.stepByStep.map((s, i) => (
          <div key={i} className="step-item"><span className="step-num">{i + 1}</span><div><strong style={{ fontSize: '.87rem' }}>{s.title}</strong><p className="muted" style={{ fontSize: '.84rem', margin: '2px 0 0' }}>{s.detail}</p></div></div>
        ))}
      </ComicCard>

      {/* 6 — Examples */}
      {lesson.examples.length > 0 && (
        <ComicCard className="lesson-section soft">
          <h2 className="section-title" style={{ fontSize: '1.25rem', marginBottom: 10 }}>Examples</h2>
          {lesson.examples.map((e, i) => <div key={i} style={{ marginBottom: 10 }}><strong style={{ fontSize: '.88rem' }}>{e.title}</strong><p className="muted" style={{ fontSize: '.85rem', margin: '2px 0 0' }}>{e.detail}</p></div>)}
        </ComicCard>
      )}

      {/* 7 + 8 — Code snippets and line-by-line explanation (where applicable) */}
      <section className="stack" style={{ gap: 12 }}>
        <div className="divider-label"><Code2 size={15} /> 7 & 8 · Code, explained line by line</div>
        {lesson.codeSnippets.length === 0
          ? <div className="comic-note" style={{ fontSize: '.84rem' }}>
              This is a concept lesson, so there is no code snippet to run here. Section 8 (line-by-line explanation) therefore has no lines to explain — nothing is invented to fill it. The practical exercise below is where you apply the idea.
            </div>
          : lesson.codeSnippets.map((snip, i) => (
            <div key={i} className="snippet">
              <div className="snippet-head"><span>{snip.title}</span><span>{snip.language}</span></div>
              <pre><code>{snip.code.split('\n').map((l, n) => <span className="cm-line" key={n}>{l || ' '}{'\n'}</span>)}</code></pre>
              <div className="line-notes">
                <strong style={{ fontSize: '.79rem' }}>What each line does</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '.8rem' }}>
                  {snip.lineNotes.map((n, j) => <li key={j}><strong>Line {n.line}:</strong> {n.note}</li>)}
                </ul>
              </div>
            </div>
          ))}
      </section>

      {/* 9 — Common mistakes */}
      <ComicCard className="lesson-section">
        <div className="row" style={{ gap: 8, marginBottom: 10 }}><AlertTriangle size={18} /><h2 className="section-title" style={{ fontSize: '1.25rem' }}>Common mistakes</h2></div>
        <div className="stack" style={{ gap: 7 }}>{lesson.commonMistakes.map((m, i) => <div key={i} className="mistake"><span>{m}</span></div>)}</div>
      </ComicCard>

      {/* 10 — Practical exercise */}
      <ComicCard className="lesson-section" tone="green">
        <div className="eyebrow" style={{ color: 'var(--green-deep)' }}>10 · Practical exercise</div>
        <h2 className="section-title">{lesson.practicalExercise.title}</h2>
        <p style={{ fontSize: '.9rem', margin: '8px 0', color: 'var(--green-deep)' }}>{lesson.practicalExercise.brief}</p>
        <ol style={{ fontSize: '.86rem', margin: 0 }}>{lesson.practicalExercise.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <div className="divider-label" style={{ margin: '14px 0 8px' }}>Check your work</div>
        <ul style={{ fontSize: '.84rem', margin: 0 }}>{lesson.practicalExercise.successChecks.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </ComicCard>

      {/* 11 — Knowledge check (lesson-only, never exam answers) */}
      <section className="stack" style={{ gap: 10 }}>
        <div className="divider-label">11 · Short knowledge check</div>
        <p className="muted">Practice only — answers are saved on this device, not submitted as an official exam.</p>
        {lesson.knowledgeCheck.length === 0 && <EmptyState title="No knowledge check for this lesson yet" />}
        {lesson.knowledgeCheck.map((q, i) => {
          const picked = answers[i];
          return (
            <div key={i} className="check-card">
              <strong style={{ fontSize: '.9rem' }}>{i + 1}. {q.question}</strong>
              {q.options.map((opt, j) => (
                <button key={j} className={`check-option ${picked === undefined ? '' : j === q.answerIndex ? 'correct' : picked === j ? 'wrong' : ''}`}
                  onClick={() => { const next = { ...answers, [i]: j }; setAnswers(next); localPut('answers:' + lessonId, next).catch(() => toast.show('Could not save this practice answer on this device.', 'warn')); }} disabled={picked !== undefined}>
                  <span className="option-marker">{String.fromCharCode(65 + j)}</span><span>{opt}</span>
                </button>
              ))}
              {picked !== undefined && <p className="muted" style={{ fontSize: '.8rem', margin: '9px 0 0' }}>{q.explanation}</p>}
            </div>
          );
        })}
      </section>

      <LessonNotes key={lessonId} lessonId={lessonId} />

      {/* 12 — Recap */}
      <ComicCard className="lesson-section soft">
        <h2 className="section-title" style={{ fontSize: '1.25rem', marginBottom: 9 }}>Lesson recap</h2>
        <ul className="recap" style={{ fontSize: '.87rem', margin: 0 }}>{lesson.recap.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </ComicCard>

      {/* Lesson assets / external links */}
      {lesson.assets.length > 0 && (
        <ComicCard>
          <div className="divider-label" style={{ marginBottom: 9 }}>Extra learning material</div>
          <div className="grid grid-2">
            {lesson.assets.filter(a => !VIDEO_EXT.test(a.url)).map(a => (
              <div key={a.id} className="card soft tight">
                {a.kind === 'image' ? <img src={a.url} alt={a.title} style={{ borderRadius: 10, marginBottom: 8, border: '2px solid var(--outline)' }} /> : <ImageIcon size={18} />}
                <strong style={{ fontSize: '.85rem' }}>{a.title}</strong>
                <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: '.78rem', display: 'block', marginTop: 4 }}>Open resource <ExternalLink size={12} style={{ verticalAlign: -2 }} /></a>
              </div>
            ))}
          </div>
        </ComicCard>
      )}

      {/* 13 — Mark as completed (a real persisted action) */}
      <ComicCard className="pop-in">
        <div className="row-between">
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}><Sparkles size={18} /><h2 className="section-title" style={{ fontSize: '1.25rem' }}>13 · Mark as completed</h2></div>
            <p className="muted" style={{ fontSize: '.84rem', margin: 0 }}>
              {lesson.completed ? 'Saved to your progress. You can revisit this lesson any time.' : 'Only press this when you have read the lesson and tried the exercise. Opening a page does not complete it.'}
            </p>
          </div>
          {lesson.completed ? <CheckCircle2 size={34} style={{ color: 'var(--green-deep)' }} /> : <Circle size={34} />}
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <Bouncy variant="primary" onClick={complete} disabled={busy || lesson.completed}>
            <CheckCircle2 size={17} /> {lesson.completed ? 'Completed' : busy ? 'Saving…' : 'Mark as completed'}
          </Bouncy>
          <Bouncy variant="outline" onClick={() => { setContext({ sessionId: lesson.sessionId, lessonId: lesson.id, sessionTitle: lesson.sessionTitle, lessonTitle: lesson.title }); }}>
            <BookOpen size={16} /> Ask Ace about this
          </Bouncy>
        </div>
      </ComicCard>

      <div className="lesson-nav">
        <Bouncy variant="ghost" onClick={() => navigate('/app/session/' + lesson.sessionId)}><ArrowLeft size={16} /> Back to session</Bouncy>
        <Bouncy variant="ghost" onClick={() => navigate('/app/session/' + lesson.sessionId)}>Session & exam <ArrowRight size={16} /></Bouncy>
      </div>

      <ConfirmSheet open={!!pending} danger title="Leave your active examination?"
        body={<>You have an active exam for <strong>{pending?.sessionTitle}</strong>. Going back to the lessons will <strong>invalidate this attempt</strong> and discard its in-progress answers. You will get a different variant when you try again. Completed lessons and past results stay intact.</>}
        confirmLabel="Invalidate exam & study" onConfirm={confirm} onCancel={cancel} />
    </div>
  );
}
