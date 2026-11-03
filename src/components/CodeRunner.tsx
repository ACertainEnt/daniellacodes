import { useMemo, useState } from 'react';
import { Play, Eye, Terminal, RotateCcw } from 'lucide-react';
import { post } from '@/lib/api';
import { Bouncy } from './Bouncy';
import { CodeEditor } from './CodeEditor';
import type { ExamQuestionPublic } from '@shared/types';

interface RunOutcome { name: string; passed: boolean; actual?: string; expected?: string; error?: string }

export function CodeRunner({ attemptId, question, value, onChange }: {
  attemptId: string; question: ExamQuestionPublic; value: string; onChange: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<RunOutcome[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'output' | 'preview'>('output');
  const language = question.language || 'javascript';
  const canPreview = language === 'html' || language === 'css';

  const run = async () => {
    setBusy(true); setError(null); setOutcomes([]); setLogs([]); setTab('output');
    try {
      const r = await post<{ results: RunOutcome[]; logs: string[]; error: string | null }>(
        `/api/exams/attempt/${attemptId}/run`, { questionId: question.id, code: value });
      setOutcomes(r.results || []); setLogs(r.logs || []); setError(r.error || null);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const srcdoc = useMemo(() => {
    if (!canPreview) return '';
    if (language === 'html') return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"></head><body>${value}</body></html>`;
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;padding:16px;color:#17251B}.card,.cards{margin:12px 0}</style><style>${value}</style></head><body><h1>Preview</h1><div class="cards"><div class="card">Card one</div><div class="card">Card two</div></div></body></html>`;
  }, [value, language, canPreview]);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="comic-note" style={{ fontSize: '.84rem' }}><strong>Task:</strong> {question.taskInstructions || question.prompt}</div>
      <CodeEditor value={value} onChange={onChange} language={language} height={260} />
      <div className="btn-row">
        <Bouncy variant="primary" size="sm" onClick={run} disabled={busy}><Play size={15} /> {busy ? 'Running…' : 'Run / test'}</Bouncy>
        {canPreview && <Bouncy size="sm" variant={tab === 'preview' ? 'dark' : 'outline'} onClick={() => setTab('preview')}><Eye size={15} /> Preview</Bouncy>}
        <Bouncy size="sm" variant="ghost" onClick={() => { setTab('output'); setOutcomes([]); setLogs([]); setError(null); }}><RotateCcw size={15} /> Clear output</Bouncy>
      </div>
      {tab === 'output' ? (
        <div className="output-panel">
          <div style={{ color: '#9ADE8F', fontWeight: 900, marginBottom: 6 }}><Terminal size={13} style={{ verticalAlign: -2 }} /> Output &amp; errors</div>
          {busy && <div>Running in the isolated sandbox…</div>}
          {!busy && outcomes.length === 0 && !logs.length && !error && <div className="muted" style={{ color: '#9ab9a1' }}>Press “Run / test” to execute the visible tests. Hidden tests are applied only when you submit.</div>}
          {outcomes.map((o, i) => (
            <div key={i} className={`output-line ${o.passed ? 'pass' : 'fail'}`}>
              {o.passed ? '✓' : '✕'} {o.name}{o.error ? ` — ${o.error}` : ` — got ${o.actual}, expected ${o.expected}`}
            </div>
          ))}
          {logs.map((l, i) => <div key={`l${i}`}>› {l}</div>)}
          {error && <div className="output-line fail">! {error}</div>}
        </div>
      ) : (
        <div style={{ border: 'var(--border)', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
          <div className="editor-bar"><span>Preview · isolated iframe (scripts disabled)</span></div>
          <iframe title="HTML/CSS preview" className="preview-frame" sandbox="" srcDoc={srcdoc} />
        </div>
      )}
      {question.visibleTests && question.visibleTests.length > 0 && (
        <details className="card soft tight" style={{ fontSize: '.78rem' }}>
          <summary style={{ fontWeight: 900, cursor: 'pointer' }}>Visible test cases ({question.visibleTests.length})</summary>
          {question.visibleTests.map((t, i) => (
            <div key={i} style={{ marginTop: 8, wordBreak: 'break-word' }}>
              <strong>{t.name}</strong><br />input: <code>{JSON.stringify(t.input)}</code><br />expected: <code>{JSON.stringify(t.expected)}</code>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
