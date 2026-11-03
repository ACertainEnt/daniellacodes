import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Clock3, ShieldAlert, Send, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { api, post, fmtTime } from '@/lib/api';
import { Bouncy } from '@/components/Bouncy';
import { ComicCard, Pill, ProgressBar } from '@/components/ui';
import { ConfirmSheet, toast } from '@/components/overlays';
import { CodeRunner } from '@/components/CodeRunner';
import { useAskAce } from '@/components/AskAce';
import type { ExamSheet, ExamQuestionPublic } from '@shared/types';

export default function ExamPage() {
  const { examId = '' } = useParams();
  const navigate = useNavigate();
  const { setContext } = useAskAce();
  const [sheet, setSheet] = useState<ExamSheet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const saveTimer = useRef<number | null>(null);
  const submitted = useRef(false);
  const started = useRef(false);
  const sessionId = examId.replace(/^exam-/, '');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setContext({ sessionId, lessonId: null, sessionTitle: 'Examination', lessonTitle: 'Active exam — Ask Ace is unavailable' });
    post<ExamSheet>(`/api/exams/${examId}/start`)
      .then(s => { setSheet(s); setAnswers(s.answers || {}); })
      .catch(e => setError(e.message));
  }, [examId, sessionId, setContext]);

  useEffect(() => {
    if (!sheet) return;
    const tick = () => setRemaining(Math.max(0, (new Date(sheet.endsAt).getTime() - Date.now()) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sheet]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const autosave = useCallback((next: Record<string, string>) => {
    if (!sheet) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      post(`/api/exams/attempt/${sheet.attemptId}/answer`, { answers: next }).catch(() => {});
    }, 700);
  }, [sheet]);

  const setAnswer = (id: string, value: string) => {
    setAnswers(prev => { const next = { ...prev, [id]: value }; autosave(next); return next; });
  };

  const doSubmit = useCallback(async () => {
    if (!sheet || submitted.current) return;
    submitted.current = true; setSubmitting(true);
    try {
      await post(`/api/exams/attempt/${sheet.attemptId}/submit`, { answers });
      navigate(`/app/exam/${examId}/result/${sheet.attemptId}`, { replace: true });
    } catch (e: any) {
      submitted.current = false;
      toast.show(e.message || 'Could not submit.', 'warn');
    } finally { setSubmitting(false); }
  }, [sheet, answers, examId, navigate]);

  useEffect(() => {
    if (sheet && remaining <= 0 && !submitted.current) doSubmit();
  }, [remaining, sheet, doSubmit]);

  const leave = async () => {
    if (!sheet) return;
    try { await post(`/api/exams/attempt/${sheet.attemptId}/abandon`); }
    catch { /* still navigate away */ }
    navigate(`/app/session/${sessionId}`, { replace: true });
  };

  const answered = useMemo(() => sheet ? sheet.questions.filter(q => (answers[q.id] || '').trim().length > 0).length : 0, [sheet, answers]);

  if (error) return (
    <div className="stack">
      <Bouncy variant="ghost" onClick={() => navigate('/app/session/' + sessionId)}><ArrowLeft size={16} /> Back to session</Bouncy>
      <div className="warn-note"><strong>Examination not available.</strong><br />{error}</div>
    </div>
  );
  if (!sheet) return <div className="card soft skeleton" style={{ height: 460, borderRadius: 24 }} />;

  return (
    <div className="stack">
      <div className="exam-top">
        <div className="row-between">
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">{sheet.sessionTitle}</div>
            <strong style={{ fontSize: '.92rem' }}>{sheet.title}</strong>
          </div>
          <div className={`timer ${remaining < 300 ? 'urgent' : ''}`} role="timer" aria-label="Time remaining">
            <Clock3 size={15} style={{ verticalAlign: -1, marginRight: 5 }} />{fmtTime(remaining)}
          </div>
        </div>
        <div style={{ marginTop: 9 }}><ProgressBar percent={(answered / sheet.questions.length) * 100} /></div>
        <div className="row-between" style={{ fontSize: '.74rem', fontWeight: 800, marginTop: 6 }}>
          <span>{answered}/{sheet.questions.length} answered</span>
          <span>{sheet.variantLabel} · pass {sheet.passMark}%{sheet.practicalPass ? ` + practical ${sheet.practicalPass}%` : ''}</span>
        </div>
      </div>

      <ComicCard tone="soft" className="tight">
        <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}><ShieldAlert size={18} style={{ flex: 'none' }} />
          <p style={{ fontSize: '.81rem', margin: 0 }}>{sheet.integrityNotice}</p></div>
      </ComicCard>

      {sheet.questions.map((q, i) => (
        <QuestionCard key={q.id} q={q} index={i} total={sheet.questions.length}
          value={answers[q.id] || ''} onChange={v => setAnswer(q.id, v)}
          collapsed={!!collapsed[q.id]} toggle={() => setCollapsed(c => ({ ...c, [q.id]: !c[q.id] }))}
          attemptId={sheet.attemptId} />
      ))}

      <ComicCard>
        <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>Ready to submit?</h3>
        <p className="muted" style={{ fontSize: '.83rem' }}>
          Correct answers, explanations and hidden test results are only revealed after your sheet is graded. {answered < sheet.questions.length && <strong>You still have {sheet.questions.length - answered} unanswered question(s).</strong>}
        </p>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Bouncy variant="primary" onClick={() => setSubmitOpen(true)} disabled={submitting}><Send size={17} /> {submitting ? 'Grading…' : 'SUBMIT EXAMINATION'}</Bouncy>
          <Bouncy variant="danger" onClick={() => setLeaveOpen(true)}><ArrowLeft size={16} /> Back to lessons</Bouncy>
        </div>
      </ComicCard>

      <ConfirmSheet open={submitOpen} title="Submit your examination?"
        body="Once submitted, this attempt is graded and cannot be edited. Your answers will be saved with your exam history."
        confirmLabel="Submit & grade" onConfirm={() => { setSubmitOpen(false); doSubmit(); }} onCancel={() => setSubmitOpen(false)} />
      <ConfirmSheet open={leaveOpen} danger title="Leave your active examination?"
        body={<>Leaving for the lessons will <strong>invalidate this attempt</strong>, discard all in-progress answers, and give you a <strong>different variant</strong> when you return. Completed lessons and past exam history stay intact.</>}
        confirmLabel="Invalidate exam & study" onConfirm={leave} onCancel={() => setLeaveOpen(false)} />
    </div>
  );
}

function QuestionCard({ q, index, total, value, onChange, collapsed, toggle, attemptId }: {
  q: ExamQuestionPublic; index: number; total: number; value: string; onChange: (v: string) => void;
  collapsed: boolean; toggle: () => void; attemptId: string;
}) {
  const typeLabel: Record<string, string> = {
    mcq: 'Multiple choice', short: 'Short answer', code_reading: 'Code interpretation',
    debug: 'Debugging', scenario: 'Real-world scenario', coding: 'Practical coding task',
  };
  return (
    <ComicCard className="question-card">
      <div className="row-between">
        <div className="row" style={{ gap: 8 }}>
          <span className="question-num">#{index + 1}</span>
          <Pill tone={q.difficulty === 'hard' ? 'red' : q.difficulty === 'applied' ? 'amber' : ''}>{typeLabel[q.type] || q.type}</Pill>
          <span className="muted" style={{ fontSize: '.74rem', fontWeight: 800 }}>{q.points} pts</span>
        </div>
        <button className="icon-btn small" onClick={toggle} aria-label={collapsed ? 'Expand question' : 'Collapse question'}>
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {!collapsed && (
        <>
          <p style={{ fontSize: '.92rem', fontWeight: 700, margin: '10px 0 12px' }}>{q.prompt}</p>
          {q.contextCode && <div className="snippet" style={{ marginBottom: 12 }}><div className="snippet-head"><span>Context</span><span>read only</span></div><pre><code>{q.contextCode}</code></pre></div>}
          {q.type === 'coding' ? (
            <CodeRunner attemptId={attemptId} question={q} value={value || q.starterCode || ''} onChange={onChange} />
          ) : q.type === 'short' ? (
            <>
              <label className="field-label" htmlFor={`q-${q.id}`}>Your answer</label>
              <textarea id={`q-${q.id}`} className="textarea" value={value} onChange={e => onChange(e.target.value)}
                maxLength={q.maxChars || 1200} placeholder="Explain your reasoning in your own words…" />
              <div className="muted" style={{ fontSize: '.74rem', textAlign: 'right' }}>{value.length}/{q.maxChars || 1200}</div>
            </>
          ) : (
            <div>
              {q.options.map((opt, j) => (
                <button key={j} className={`option ${value === opt ? 'selected' : ''}`} onClick={() => onChange(opt)} aria-pressed={value === opt}>
                  <span className="option-marker">{String.fromCharCode(65 + j)}</span><span>{opt}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <div className="muted" style={{ fontSize: '.7rem', marginTop: 10 }}>Question {index + 1} of {total} · {q.objective}</div>
    </ComicCard>
  );
}
