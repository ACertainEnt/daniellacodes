import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus, RefreshCw, Trash2, Check, ShieldCheck, RotateCcw } from 'lucide-react';
import { api, post, patch, fmtDate } from '@/lib/api';
import { Bouncy } from '@/components/Bouncy';
import { ComicCard, Pill } from '@/components/ui';
import { Sheet, ConfirmSheet, toast } from '@/components/overlays';
import type { QuestionBankItem, AttemptSummary } from '@shared/types';

export default function Exams() {
  const [exams, setExams] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AttemptSummary | null>(null);
  const [newQ, setNewQ] = useState({ prompt: '', type: 'mcq', difficulty: 'applied', points: 5, objective: '', options: 'Option A\nOption B\nOption C\nOption D', correctIndex: 0, explanation: '' });

  const loadExams = useCallback(() => api<{ exams: any[] }>('/api/instructor/exams').then(r => {
    setExams(r.exams);
    setSelected(prev => prev || r.exams[0]?.id || '');
  }).catch(e => toast.show(e.message, 'warn')), []);
  useEffect(() => { loadExams(); }, [loadExams]);
  useEffect(() => {
    if (!selected) return;
    api<{ questions: QuestionBankItem[] }>(`/api/instructor/questions?examId=${selected}`).then(r => setQuestions(r.questions)).catch(() => {});
  }, [selected]);
  useEffect(() => { api<{ attempts: AttemptSummary[] }>('/api/instructor/attempts').then(r => setAttempts(r.attempts)).catch(() => {}); }, []);
  const refreshQuestions = () => api<{ questions: QuestionBankItem[] }>(`/api/instructor/questions?examId=${selected}`).then(r => setQuestions(r.questions));
  const refreshAttempts = () => api<{ attempts: AttemptSummary[] }>('/api/instructor/attempts').then(r => setAttempts(r.attempts));
  const current = exams.find(e => e.id === selected);

  const toggle = async (q: QuestionBankItem, field: 'approved' | 'published') => {
    await patch(`/api/instructor/questions/${q.id}`, { [field]: !q[field] });
    toast.show(`Question ${field}.`); refreshQuestions();
  };
  const createQuestion = async () => {
    if (!newQ.prompt.trim()) return;
    const options = newQ.options.split('\n').map(s => s.trim()).filter(Boolean);
    await post('/api/instructor/questions', {
      examId: selected, prompt: newQ.prompt, type: newQ.type, difficulty: newQ.difficulty,
      points: Number(newQ.points), objective: newQ.objective || 'General',
      options, correctIndex: Number(newQ.correctIndex), explanation: newQ.explanation,
      approved: true, published: true, variants: [{}],
    });
    setAddOpen(false); toast.show('Question added to the bank.'); refreshQuestions();
  };

  return (
    <div className="stack">
      <div><div className="eyebrow">ACECODES</div><h1 className="section-title" style={{ fontSize: '2rem' }}>Examination management</h1></div>
      <p className="muted" style={{ fontSize: '.85rem' }}>Approve and publish questions, set pass requirements, regenerate variants, review answers and code submissions, and reset attempts. Correct answers and hidden tests are only visible here.</p>

      <ComicCard>
        <label className="field-label">Examination</label>
        <select className="select" value={selected} onChange={e => setSelected(e.target.value)}>
          {exams.map(e => <option key={e.id} value={e.id}>{e.sessionTitle} — {e.title}</option>)}
        </select>
        {current && <ExamSettings exam={current} onSaved={loadExams} />}
      </ComicCard>

      <ComicCard>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}><ClipboardList size={18} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>Question bank</h2></div>
          <Bouncy variant="primary" size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Add question</Bouncy>
        </div>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <Pill tone="plain">{questions.length} questions</Pill>
          <Pill tone="green">{questions.filter(q => q.approved && q.published).length} live</Pill>
          <Pill tone="amber">{questions.filter(q => q.hasHiddenTests).length} with hidden tests</Pill>
          <Pill tone="plain">{current?.variants ?? 0} variants</Pill>
        </div>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>ID</th><th>Type</th><th>Prompt</th><th>Objective</th><th>Pts</th><th>Answer / tests</th><th>Approved</th><th>Published</th></tr></thead>
          <tbody>{questions.map(q => (
            <tr key={q.id}>
              <td style={{ whiteSpace: 'nowrap', fontSize: '.74rem' }}>{q.id}</td>
              <td><Pill tone={q.type === 'coding' ? 'amber' : 'plain'}>{q.type}</Pill></td>
              <td style={{ minWidth: 230 }}>{q.prompt.slice(0, 150)}{q.prompt.length > 150 ? '…' : ''}</td>
              <td>{q.objective}</td><td>{q.points}</td>
              <td style={{ fontSize: '.76rem', maxWidth: 200 }}>{q.correctAnswer?.slice(0, 60)}{q.hasHiddenTests ? ` · ${q.hiddenTests?.length} hidden tests` : ''}</td>
              <td><button className={`btn sm ${q.approved ? 'primary' : ''}`} onClick={() => toggle(q, 'approved')}>{q.approved ? <Check size={13} /> : '—'}</button></td>
              <td><button className={`btn sm ${q.published ? 'primary' : ''}`} onClick={() => toggle(q, 'published')}>{q.published ? 'Live' : 'Draft'}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Bouncy size="sm" onClick={async () => { await post(`/api/instructor/variants/${selected}/regenerate`); toast.show('Three new variants generated from live questions.'); loadExams(); }}><RefreshCw size={14} /> Regenerate variants</Bouncy>
        </div>
      </ComicCard>

      <ComicCard>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}><ShieldCheck size={18} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>Attempts & resets</h2></div>
        {attempts.length === 0 && <p className="muted" style={{ fontSize: '.84rem' }}>No attempts yet.</p>}
        {attempts.length > 0 && <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Student exam</th><th>Variant</th><th>Score</th><th>Status</th><th>Started</th><th>Actions</th></tr></thead>
          <tbody>{attempts.map(a => (
            <tr key={a.id}>
              <td><strong>{a.sessionTitle}</strong></td><td>{a.variantLabel}</td><td>{a.score === null ? '—' : `${a.score}%`}</td>
              <td><Pill tone={a.passed ? 'green' : a.status === 'awaiting_review' ? 'amber' : a.status === 'active' ? 'amber' : 'red'}>{a.status}</Pill></td>
              <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.startedAt)}</td>
              <td><div className="row" style={{ gap: 5, flexWrap: 'nowrap' }}>
                <Link className="btn sm" to={`/ace/attempt/${a.id}`}>Review</Link>
                <button className="btn sm" onClick={() => setResetTarget(a)}><RotateCcw size={13} /></button>
                {a.status === 'awaiting_review' && <button className="btn sm primary" onClick={async () => { await post(`/api/instructor/attempts/${a.id}/approve`, { note: 'Approved after demonstration' }); toast.show('Capstone approved.'); refreshAttempts(); }}>Approve</button>}
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>}
        <p className="muted" style={{ fontSize: '.76rem', marginTop: 10, marginBottom: 0 }}>Resetting invalidates or deletes only the chosen attempt. Completed lessons and other exam history are never touched.</p>
      </ComicCard>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Create a question"
        footer={<Bouncy variant="primary" block onClick={createQuestion}>Add to bank & publish</Bouncy>}>
        <div className="inline-form">
          <div><label className="field-label">Prompt (use {'{{placeholders}}'} for variants)</label><textarea className="textarea" value={newQ.prompt} onChange={e => setNewQ({ ...newQ, prompt: e.target.value })} /></div>
          <div className="two" style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <div><label className="field-label">Type</label><select className="select" value={newQ.type} onChange={e => setNewQ({ ...newQ, type: e.target.value })}>
              {['mcq', 'short', 'code_reading', 'debug', 'scenario', 'coding'].map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="field-label">Difficulty</label><select className="select" value={newQ.difficulty} onChange={e => setNewQ({ ...newQ, difficulty: e.target.value })}>
              {['core', 'applied', 'hard'].map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div><label className="field-label">Options (one per line, for MCQ types)</label><textarea className="textarea" value={newQ.options} onChange={e => setNewQ({ ...newQ, options: e.target.value })} /></div>
          <div className="two" style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <div><label className="field-label">Correct option index (0-based)</label><input className="input" type="number" value={newQ.correctIndex} onChange={e => setNewQ({ ...newQ, correctIndex: Number(e.target.value) })} /></div>
            <div><label className="field-label">Points</label><input className="input" type="number" value={newQ.points} onChange={e => setNewQ({ ...newQ, points: Number(e.target.value) })} /></div>
          </div>
          <div><label className="field-label">Objective</label><input className="input" value={newQ.objective} onChange={e => setNewQ({ ...newQ, objective: e.target.value })} /></div>
          <div><label className="field-label">Explanation (shown after grading)</label><textarea className="textarea" value={newQ.explanation} onChange={e => setNewQ({ ...newQ, explanation: e.target.value })} /></div>
          <p className="muted" style={{ fontSize: '.78rem' }}>Practical coding tasks with hidden tests and static checks are authored in the question bank data. New questions created here default to a single variant; use “Regenerate variants” afterwards.</p>
        </div>
      </Sheet>

      <ConfirmSheet open={!!resetTarget} danger title="Reset this attempt?"
        body={<>Choose “Invalidate” to keep a record but discard the score and answers, or “Delete” to remove it and its code submissions entirely. Daniella's completed lessons and other attempts are unchanged.</>}
        confirmLabel="Invalidate attempt" onConfirm={async () => { if (resetTarget) { await post(`/api/instructor/attempts/${resetTarget.id}/reset`, { mode: 'invalidate' }); toast.show('Attempt invalidated.'); setResetTarget(null); refreshAttempts(); } }} onCancel={() => setResetTarget(null)} />
      {resetTarget && <div className="row" style={{ marginTop: -8 }}>
        <Bouncy size="sm" variant="danger" onClick={async () => { await post(`/api/instructor/attempts/${resetTarget.id}/reset`, { mode: 'delete' }); toast.show('Attempt deleted.'); setResetTarget(null); refreshAttempts(); }}><Trash2 size={13} /> Delete attempt entirely</Bouncy>
      </div>}
    </div>
  );
}

function ExamSettings({ exam, onSaved }: { exam: any; onSaved: () => void }) {
  const [f, setF] = useState({ minutes: exam.minutes, pass_mark: exam.pass_mark, practical_pass: exam.practical_pass, question_count: exam.question_count, published: !!exam.published, manual_review: !!exam.manual_review });
  useEffect(() => setF({ minutes: exam.minutes, pass_mark: exam.pass_mark, practical_pass: exam.practical_pass, question_count: exam.question_count, published: !!exam.published, manual_review: !!exam.manual_review }), [exam.id]);
  const save = async () => { await patch(`/api/instructor/exams/${exam.id}`, f); toast.show('Exam settings saved.'); onSaved(); };
  return (
    <div style={{ marginTop: 14 }}>
      <div className="divider-label" style={{ marginBottom: 10 }}>Pass requirements</div>
      <div className="inline-form two">
        {([['minutes', 'Minutes'], ['pass_mark', 'Pass mark %'], ['practical_pass', 'Practical pass %'], ['question_count', 'Questions per variant']] as const).map(([k, label]) => (
          <div key={k}><label className="field-label">{label}</label><input className="input" type="number" value={(f as any)[k]} onChange={e => setF({ ...f, [k]: Number(e.target.value) })} /></div>
        ))}
      </div>
      <div className="row" style={{ gap: 16, margin: '12px 0', fontSize: '.85rem', fontWeight: 800 }}>
        <label className="row" style={{ gap: 7 }}><input type="checkbox" checked={f.published} onChange={e => setF({ ...f, published: e.target.checked })} /> Published</label>
        <label className="row" style={{ gap: 7 }}><input type="checkbox" checked={f.manual_review} onChange={e => setF({ ...f, manual_review: e.target.checked })} /> Instructor review (capstone)</label>
      </div>
      <Bouncy size="sm" variant="primary" onClick={save}>Save settings</Bouncy>
    </div>
  );
}
