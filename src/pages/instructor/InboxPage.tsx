import { useCallback, useEffect, useState } from 'react';
import { Inbox, ExternalLink, CheckCircle2, Clock3, MessageCircleQuestion } from 'lucide-react';
import { api, post, fmtDate } from '@/lib/api';
import { Bouncy } from '@/components/Bouncy';
import { ComicCard, Pill, EmptyState } from '@/components/ui';
import { toast } from '@/components/overlays';
import type { HelpRequestView } from '@shared/types';

export default function InboxPage() {
  const [questions, setQuestions] = useState<HelpRequestView[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const load = useCallback(() => api<{ questions: HelpRequestView[] }>('/api/instructor/help').then(r => setQuestions(r.questions)).catch(e => toast.show(e.message, 'warn')), []);
  useEffect(() => { load(); }, [load]);
  const pending = questions.filter(q => q.status === 'pending');
  const answered = questions.filter(q => q.status === 'answered');

  const reply = async (q: HelpRequestView) => {
    const text = (replies[q.id] || '').trim();
    if (text.length < 2) { toast.show('Write a reply first.', 'warn'); return; }
    await post(`/api/instructor/help/${q.id}/reply`, { answer: text });
    toast.show('Reply saved. Daniella has been notified.'); load();
  };
  const markAnswered = async (q: HelpRequestView) => {
    await post(`/api/instructor/help/${q.id}/mark-answered`, { summary: (summaries[q.id] || '').trim() });
    toast.show('Marked as answered via WhatsApp.'); load();
  };

  return (
    <div className="stack">
      <div><div className="eyebrow">ACECODES · Student support</div><h1 className="section-title" style={{ fontSize: '2rem' }}>Question inbox</h1></div>
      <div className="comic-note" style={{ fontSize: '.83rem' }}>
        If you answered through WhatsApp, mark the request as answered manually and optionally add a summary. This site does <strong>not</strong> claim to detect WhatsApp messages or online status. An in-app notification is sent to Daniella either way.
      </div>
      <div className="grid grid-2">
        <ComicCard className="tight"><div className="eyebrow">Pending</div><div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>{pending.length}</div></ComicCard>
        <ComicCard className="tight"><div className="eyebrow">Answered</div><div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>{answered.length}</div></ComicCard>
      </div>

      <div className="divider-label">Pending questions · {pending.length}</div>
      {pending.length === 0 && <EmptyState title="Inbox clear" detail="New questions from Daniella appear here." />}
      {pending.map(q => (
        <ComicCard key={q.id}>
          <div className="row-between" style={{ marginBottom: 9 }}>
            <div><Pill tone="amber"><Clock3 size={12} /> Pending</Pill><div className="muted" style={{ fontSize: '.73rem', marginTop: 5 }}>{fmtDate(q.createdAt)} · ID {q.id.slice(0, 8).toUpperCase()}</div></div>
            <a className="btn sm" href={q.whatsappUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> WhatsApp</a>
          </div>
          <div className="muted" style={{ fontSize: '.76rem', fontWeight: 800 }}>{q.sessionTitle} · {q.lessonTitle}</div>
          <p style={{ fontSize: '.92rem', margin: '8px 0 0' }}>{q.question}</p>
          <div className="divider-label" style={{ margin: '14px 0 9px' }}>Reply in the academy</div>
          <textarea className="textarea" placeholder="Write your answer…" value={replies[q.id] || ''} onChange={e => setReplies(r => ({ ...r, [q.id]: e.target.value }))} />
          <div className="btn-row" style={{ marginTop: 9 }}>
            <Bouncy variant="primary" size="sm" onClick={() => reply(q)}><MessageCircleQuestion size={14} /> Send reply & notify</Bouncy>
          </div>
          <div className="divider-label" style={{ margin: '14px 0 9px' }}>Or record a WhatsApp answer</div>
          <input className="input" placeholder="Optional summary of what you told her on WhatsApp" value={summaries[q.id] || ''} onChange={e => setSummaries(r => ({ ...r, [q.id]: e.target.value }))} />
          <div className="btn-row" style={{ marginTop: 9 }}>
            <Bouncy size="sm" onClick={() => markAnswered(q)}><CheckCircle2 size={14} /> Mark as answered (WhatsApp)</Bouncy>
          </div>
        </ComicCard>
      ))}

      <div className="divider-label">Conversation history · {answered.length}</div>
      {answered.length === 0 && <EmptyState title="No answered questions yet" />}
      {answered.map(q => (
        <ComicCard key={q.id} tone="soft" className="tight">
          <div className="row-between">
            <Pill tone="green"><CheckCircle2 size={12} /> {q.answeredVia === 'whatsapp' ? 'Answered on WhatsApp' : 'Answered in-app'}</Pill>
            <span className="muted" style={{ fontSize: '.73rem' }}>{fmtDate(q.answeredAt || q.createdAt)}</span>
          </div>
          <div className="muted" style={{ fontSize: '.75rem', marginTop: 7 }}>{q.sessionTitle} · {q.lessonTitle} · ID {q.id.slice(0, 8).toUpperCase()}</div>
          <p style={{ fontSize: '.86rem', margin: '7px 0' }}><strong>Question:</strong> {q.question}</p>
          <div className="comic-note" style={{ fontSize: '.84rem' }}><strong>Answer:</strong> {q.answer || 'No written summary — answered outside the site.'}</div>
          <a className="btn sm" style={{ marginTop: 9 }} href={q.whatsappUrl} target="_blank" rel="noreferrer"><Inbox size={13} /> Open WhatsApp thread</a>
        </ComicCard>
      ))}
    </div>
  );
}
