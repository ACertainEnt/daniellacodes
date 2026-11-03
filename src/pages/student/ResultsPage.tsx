import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Clock3, MessageCircleQuestion } from 'lucide-react';
import { api, fmtDate } from '@/lib/api';
import { Bouncy } from '@/components/Bouncy';
import { ComicCard, ProgressRing, Pill } from '@/components/ui';
import { useAskAce } from '@/components/AskAce';
import type { ExamResult } from '@shared/types';

interface ResultPayload extends ExamResult { status?: string; awaitingInstructorReview?: boolean }

export default function ResultsPage() {
  const { examId = '', attemptId = '' } = useParams();
  const navigate = useNavigate();
  const { open } = useAskAce();
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<ResultPayload>(`/api/exams/attempt/${attemptId}/result`).then(setResult).catch(e => setError(e.message)); }, [attemptId]);
  if (error) return <div className="warn-note">{error}</div>;
  if (!result) return <div className="card soft skeleton" style={{ height: 380, borderRadius: 24 }} />;
  const sessionId = examId.replace(/^exam-/, '');

  return (
    <div className="stack">
      <ComicCard tone="hero" className="pop-in">
        <div className="row-between" style={{ gap: 16, alignItems: 'center' }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--green-deep)' }}>{result.variantLabel} · graded {fmtDate(result.gradedAt)}</div>
            <h1 className="lesson-heading" style={{ color: 'var(--outline)' }}>{result.awaitingInstructorReview ? 'Submitted for review' : result.passed ? 'You passed!' : 'Not quite yet'}</h1>
            <p style={{ color: 'var(--green-deep)', fontWeight: 800, fontSize: '.9rem', margin: 0 }}>
              {result.awaitingInstructorReview
                ? 'Your capstone needs a live demonstration. Ace will approve or give feedback.'
                : result.passed ? 'The next session is unlocked. Your lessons and history are safe.' : 'Revisit the lessons, then try another variant.'}
            </p>
          </div>
          <div className="result-score" style={{ color: 'var(--green-deep)', fontFamily: 'var(--font-display)' }}>{result.score}%</div>
        </div>
      </ComicCard>

      <div className="grid grid-2">
        <ComicCard className="tight">
          <div className="eyebrow">Overall score</div>
          <div className="row" style={{ gap: 10, marginTop: 6 }}><ProgressRing percent={result.score} size={84} /><div style={{ fontSize: '.85rem' }}>Pass mark <strong>{result.passMark}%</strong><br />{result.score >= result.passMark ? '✓ Achieved' : '✕ Below pass mark'}</div></div>
        </ComicCard>
        {result.practicalScore !== null && (
          <ComicCard className="tight">
            <div className="eyebrow">Practical score</div>
            <div className="row" style={{ gap: 10, marginTop: 6 }}><ProgressRing percent={result.practicalScore} size={84} /><div style={{ fontSize: '.85rem' }}>Required <strong>{result.practicalPass}%</strong><br />{result.practicalScore >= result.practicalPass ? '✓ Achieved' : '✕ Below threshold'}</div></div>
          </ComicCard>
        )}
      </div>

      <ComicCard>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h2 className="section-title" style={{ fontSize: '1.3rem' }}>Question review</h2>
          <Pill tone={result.passed ? 'green' : 'red'}>{result.passed ? 'Passed' : result.awaitingInstructorReview ? 'Awaiting review' : 'Not passed'}</Pill>
        </div>
        {result.grades.map((g, i) => (
          <div key={i} className="grade-row">
            <div style={{ flex: 'none' }}>{g.correct ? <CheckCircle2 size={21} style={{ color: 'var(--green-deep)' }} /> : <XCircle size={21} style={{ color: 'var(--danger)' }} />}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row-between"><strong style={{ fontSize: '.88rem' }}>Question {i + 1}</strong><span style={{ fontSize: '.8rem', fontWeight: 900 }}>{g.awarded}/{g.available}</span></div>
              <div className="muted" style={{ fontSize: '.8rem' }}>{g.feedback}</div>
              {g.correctAnswer && <div className="comic-note" style={{ marginTop: 7, fontSize: '.81rem' }}><strong>Correct answer:</strong> {g.correctAnswer}</div>}
              {g.explanation && <div className="muted" style={{ fontSize: '.79rem', marginTop: 6 }}>{g.explanation}</div>}
            </div>
          </div>
        ))}
      </ComicCard>

      <div className="btn-row">
        {result.canRetake && <Bouncy variant="primary" onClick={() => navigate('/app/exam/' + examId, { replace: true })}><RotateCcw size={17} /> Try another variant</Bouncy>}
        <Bouncy onClick={() => navigate('/app/session/' + sessionId)}>Back to lessons</Bouncy>
        {result.nextSessionUnlocked && <Bouncy variant="dark" onClick={() => navigate('/app/sessions')}>Next session <ArrowRight size={16} /></Bouncy>}
      </div>
      <ComicCard tone="soft" className="tight">
        <div className="row" style={{ gap: 8 }}><MessageCircleQuestion size={17} /><span style={{ fontSize: '.85rem' }}>Confused by a question? Ask Ace — your question is saved with this session and lesson.</span></div>
        <div style={{ marginTop: 10 }}><Bouncy size="sm" onClick={open}>Ask Ace</Bouncy></div>
      </ComicCard>
      <Link className="btn sm" to="/app/progress"><Clock3 size={14} /> View full exam history</Link>
    </div>
  );
}
