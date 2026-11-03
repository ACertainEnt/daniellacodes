import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Code2, RotateCcw } from 'lucide-react';
import { api, post, fmtDate } from '@/lib/api';
import { Bouncy } from '@/components/Bouncy';
import { ComicCard, Pill } from '@/components/ui';
import { toast, ConfirmSheet } from '@/components/overlays';
import type { AttemptSummary, QuestionGrade } from '@shared/types';

interface ReviewData {
  attempt: AttemptSummary; examTitle: string; studentName: string;
  grades: QuestionGrade[]; answers: Record<string, string>;
  submissions: Array<{ id: string; question_id: string; code: string; language: string; output_json: any; testResults: any[] }>;
  canApprove: boolean;
}

export default function AttemptReview() {
  const { id = '' } = useParams();
  const [data, setData] = useState<ReviewData | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const load = () => api<ReviewData>(`/api/instructor/attempts/${id}`).then(setData).catch(e => toast.show(e.message, 'warn'));
  useEffect(() => { load(); }, [id]);
  if (!data) return <div className="card soft skeleton" style={{ height: 380, borderRadius: 24 }} />;

  return (
    <div className="stack">
      <Link className="btn ghost" to="/ace/exams"><ArrowLeft size={16} /> Back to examinations</Link>
      <ComicCard tone="hero">
        <div className="eyebrow" style={{ color: 'var(--green-deep)' }}>{data.examTitle} · {data.attempt.variantLabel}</div>
        <h1 className="lesson-heading" style={{ color: 'var(--outline)' }}>{data.attempt.score === null ? '—' : `${data.attempt.score}%`}</h1>
        <p style={{ color: 'var(--green-deep)', fontWeight: 800, fontSize: '.86rem', margin: 0 }}>
          {data.studentName} · {fmtDate(data.attempt.startedAt)} · {data.attempt.status}
          {data.attempt.practicalScore !== null ? ` · practical ${data.attempt.practicalScore}%` : ''}
        </p>
      </ComicCard>

      <div className="btn-row">
        {data.canApprove && <Bouncy variant="primary" onClick={async () => { await post(`/api/instructor/attempts/${id}/approve`, { note: 'Approved after demonstration' }); toast.show('Capstone approved and Daniella notified.'); load(); }}><CheckCircle2 size={16} /> Approve capstone</Bouncy>}
        <Bouncy variant="danger" onClick={() => setResetOpen(true)}><RotateCcw size={16} /> Reset attempt</Bouncy>
      </div>

      <ComicCard>
        <h2 className="section-title" style={{ fontSize: '1.3rem', marginBottom: 10 }}>Grades & submitted answers</h2>
        {data.grades.map((g, i) => (
          <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '2px dashed color-mix(in srgb, var(--outline) 14%, transparent)' }}>
            <div style={{ flex: 'none' }}>{g.correct ? <CheckCircle2 size={20} style={{ color: 'var(--green-deep)' }} /> : <XCircle size={20} style={{ color: 'var(--danger)' }} />}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row-between"><strong style={{ fontSize: '.87rem' }}>Q{i + 1} · {g.questionId}</strong><Pill tone={g.correct ? 'green' : 'red'}>{g.awarded}/{g.available}</Pill></div>
              <div className="comic-note" style={{ fontSize: '.8rem', marginTop: 7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <strong>Answer:</strong> {data.answers[g.questionId] || '(empty)'}
              </div>
              {g.correctAnswer && <div className="muted" style={{ fontSize: '.78rem', marginTop: 6 }}><strong>Correct:</strong> {g.correctAnswer}</div>}
              <div className="muted" style={{ fontSize: '.77rem' }}>{g.feedback}</div>
            </div>
          </div>
        ))}
      </ComicCard>

      <ComicCard>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}><Code2 size={18} /><h2 className="section-title" style={{ fontSize: '1.3rem' }}>Code submissions & test results</h2></div>
        {data.submissions.length === 0 && <p className="muted" style={{ fontSize: '.84rem' }}>No code submissions in this attempt.</p>}
        {data.submissions.map(s => (
          <div key={s.id} className="card soft tight" style={{ marginBottom: 10 }}>
            <div className="row-between"><strong style={{ fontSize: '.85rem' }}>{s.question_id} · {s.language}</strong><span className="muted" style={{ fontSize: '.72rem' }}>{s.testResults.length} hidden tests</span></div>
            <pre style={{ background: '#101c15', color: '#DFF3DF', padding: 10, borderRadius: 9, overflowX: 'auto', fontSize: '.76rem', marginTop: 8 }}><code>{s.code}</code></pre>
            {s.testResults.map((t, i) => <div key={i} style={{ fontSize: '.78rem' }}>{t.passed ? '✓' : '✕'} {t.test_name} — {t.message}</div>)}
            {s.output_json?.staticResults?.length > 0 && <details style={{ marginTop: 8, fontSize: '.78rem' }}><summary style={{ fontWeight: 900, cursor: 'pointer' }}>Structural checks</summary>
              {s.output_json.staticResults.map((r: any, i: number) => <div key={i}>{r.passed ? '✓' : '✕'} {r.name} — {r.description}</div>)}
            </details>}
            {s.output_json?.error && <div className="warn-note" style={{ marginTop: 8, fontSize: '.78rem' }}>Runner: {s.output_json.error}</div>}
          </div>
        ))}
      </ComicCard>

      <ConfirmSheet open={resetOpen} danger title="Reset this attempt?"
        body="Invalidating keeps a record but clears its score and answers so Daniella can retake it with a different variant. Completed lessons and other attempts stay intact."
        confirmLabel="Invalidate attempt" onConfirm={async () => { await post(`/api/instructor/attempts/${id}/reset`, { mode: 'invalidate' }); toast.show('Attempt invalidated.'); setResetOpen(false); load(); }} onCancel={() => setResetOpen(false)} />
    </div>
  );
}
