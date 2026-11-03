import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { MessageCircleQuestion, Send, ExternalLink } from 'lucide-react';
import { post } from '@/lib/api';
import { fmtDate } from '@/lib/api';
import { Bouncy } from './Bouncy';
import { Sheet } from './overlays';
import { toast } from './overlays';

interface AceContext { sessionId: string | null; lessonId: string | null; sessionTitle: string; lessonTitle: string }
interface AceState { setContext: (c: Partial<AceContext>) => void; open: () => void }
const Ctx = createContext<AceState>({ setContext: () => {}, open: () => {} });
export const useAskAce = () => useContext(Ctx);

export function AskAceProvider({ children }: { children: ReactNode }) {
  const [context, setCtx] = useState<AceContext>({ sessionId: null, lessonId: null, sessionTitle: 'Not specified', lessonTitle: 'Not specified' });
  const [open, setOpen] = useState(false);
  const setContext = useCallback((c: Partial<AceContext>) => setCtx(prev => ({ ...prev, ...c })), []);
  return (
    <Ctx.Provider value={{ setContext, open: () => setOpen(true) }}>
      {children}
      <AskAce context={context} open={open} setOpen={setOpen} />
    </Ctx.Provider>
  );
}

function AskAce({ context, open, setOpen }: { context: AceContext; open: boolean; setOpen: (v: boolean) => void }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ id: string; at: string } | null>(null);
  const [error, setError] = useState('');

  const send = async () => {
    const text = question.trim();
    if (text.length < 10) { setError('Please describe the problem in at least 10 characters.'); return; }
    setError(''); setBusy(true);
    try {
      // 1. Persist the question FIRST. Only then do we open WhatsApp.
      const result = await post<{ requestId: string; createdAt: string; whatsappUrl: string; message: string }>('/api/help', {
        question: text, sessionId: context.sessionId, lessonId: context.lessonId,
      });
      setSent({ id: result.requestId, at: result.createdAt });
      setQuestion('');
      toast.show('Your question has been sent to Ace. Status: Pending.');
      window.open(result.whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e.message || 'Could not save your question. Nothing was sent to WhatsApp.');
    } finally { setBusy(false); }
  };

  return (
    <>
      <DraggableFab onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="Stuck somewhere? Ask Ace.">
        <p className="muted" style={{ fontSize: '.88rem' }}>
          Describe the concept or the exact error. Your question is saved to your academy record before WhatsApp opens, and Ace can reply here.
        </p>
        <div className="comic-note" style={{ margin: '12px 0' }}>
          <div className="eyebrow">Attached to</div>
          <strong>{context.sessionTitle}</strong><br />
          <span className="muted" style={{ fontSize: '.83rem' }}>{context.lessonTitle}</span>
        </div>
        <label className="field-label" htmlFor="ace-question">Your question</label>
        <textarea id="ace-question" className="textarea" placeholder="Describe what you're having trouble understanding..."
          value={question} onChange={e => setQuestion(e.target.value)} maxLength={2000} />
        <div className="row-between" style={{ fontSize: '.76rem', marginTop: 5 }}>
          <span className="muted">{question.length}/2000</span>
          {error && <span style={{ color: 'var(--danger)', fontWeight: 800 }}>{error}</span>}
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <Bouncy variant="primary" block onClick={send} disabled={busy}>
            <Send size={17} /> {busy ? 'Saving…' : 'SEND'}
          </Bouncy>
        </div>
        {sent && (
          <div className="card soft pop-in" style={{ marginTop: 14 }}>
            <strong>Your question has been sent to Ace. Status: Pending.</strong>
            <p className="muted" style={{ fontSize: '.8rem', margin: '6px 0 0' }}>
              Request ID {sent.id.slice(0, 8).toUpperCase()} · {fmtDate(sent.at)}
            </p>
            <p style={{ fontSize: '.8rem', margin: '8px 0 0' }}>
              WhatsApp opened with the full question prefilled. Ace can also answer from the instructor inbox; replies appear on your dashboard.
            </p>
          </div>
        )}
        <p className="muted" style={{ fontSize: '.76rem', marginTop: 14, marginBottom: 0 }}>
          <ExternalLink size={12} style={{ verticalAlign: -2 }} /> The site cannot detect WhatsApp messages or online status. Ace marks a WhatsApp answer as answered manually.
        </p>
      </Sheet>
    </>
  );
}

/** Comic FAB that can be dragged with touch or mouse; a tap opens the sheet. */
function DraggableFab({ onClick }: { onClick: () => void }) {
  const [pos, setPos] = useState<{ right: number; bottom: number } | null>(null);
  const drag = useRef<{ x: number; y: number; right: number; bottom: number; moved: boolean } | null>(null);
  const base = () => ({ right: 16, bottom: window.innerWidth >= 900 ? 26 : 84 + 0 });
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  return (
    <button
      className="ask-fab gentle-bob"
      aria-label="Ask Ace — open help sheet"
      style={pos ? { right: pos.right, bottom: pos.bottom } : undefined}
      onPointerDown={e => {
        const b = pos ?? base();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, right: b.right, bottom: b.bottom, moved: false };
      }}
      onPointerMove={e => {
        const d = drag.current; if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
        if (!d.moved) return;
        setPos({
          right: clamp(d.right - dx, 8, Math.max(8, window.innerWidth - 84)),
          bottom: clamp(d.bottom - dy, 8, Math.max(8, window.innerHeight - 90)),
        });
      }}
      onPointerUp={() => { const d = drag.current; drag.current = null; if (d && !d.moved) onClick(); }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <span className="fab-icon"><MessageCircleQuestion size={26} strokeWidth={2.6} /></span>
      <span>Ask Ace</span>
    </button>
  );
}
