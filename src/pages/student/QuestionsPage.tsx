import { useEffect, useState } from 'react';
import { MessageCircleQuestion, ExternalLink, CheckCircle2, Clock3 } from 'lucide-react';
import { api, fmtDate } from '@/lib/api';
import { Bouncy } from '@/components/Bouncy';
import { ComicCard, Pill, EmptyState } from '@/components/ui';
import { useAskAce } from '@/components/AskAce';
import type { HelpRequestView } from '@shared/types';

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<HelpRequestView[]>([]);
  const { open } = useAskAce();
  useEffect(() => { api<{ questions: HelpRequestView[] }>('/api/help/mine').then(r => setQuestions(r.questions)).catch(() => {}); }, []);
  const pending = questions.filter(q => q.status === 'pending');
  const answered = questions.filter(q => q.status === 'answered');

  return (
    <div className="stack">
      <div className="row-between">
        <div><div className="eyebrow">Ask Ace</div><h1 className="section-title" style={{ fontSize: '2rem' }}>Your questions</h1></div>
        <Bouncy variant="primary" onClick={open}><MessageCircleQuestion size={17} /> Ask a question</Bouncy>
      </div>
      <p className="muted" style={{ fontSize: '.86rem' }}>Every question is saved with its unique ID, submission time, session and lesson before WhatsApp opens. Ace's replies appear here and as in-app notifications.</p>

      <div className="divider-label">Pending · {pending.length}</div>
      {pending.length === 0 && <EmptyState title="No pending questions" detail="Tap the floating Ask Ace button whenever you are stuck." />}
      {pending.map(q => (
        <ComicCard key={q.id}>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <Pill tone="amber"><Clock3 size={12} /> Pending</Pill>
            <span className="muted" style={{ fontSize: '.74rem' }}>{fmtDate(q.createdAt)}</span>
          </div>
          <p style={{ fontSize: '.9rem', margin: 0 }}>{q.question}</p>
          <div className="muted" style={{ fontSize: '.77rem', marginTop: 8 }}>{q.sessionTitle} · {q.lessonTitle}</div>
          <div className="row-between" style={{ marginTop: 12 }}>
            <span className="muted" style={{ fontSize: '.72rem' }}>ID {q.id.slice(0, 8).toUpperCase()}</span>
            <a className="btn sm" href={q.whatsappUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open WhatsApp</a>
          </div>
        </ComicCard>
      ))}

      <div className="divider-label">Answered · {answered.length}</div>
      {answered.length === 0 && <EmptyState title="No replies yet" />}
      {answered.map(q => (
        <ComicCard key={q.id} tone="soft">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <Pill tone="green"><CheckCircle2 size={12} /> Answered {q.answeredVia === 'whatsapp' ? 'on WhatsApp' : 'by Ace'}</Pill>
            <span className="muted" style={{ fontSize: '.74rem' }}>{fmtDate(q.answeredAt || q.createdAt)}</span>
          </div>
          <p style={{ fontSize: '.88rem', margin: 0 }}><strong>You:</strong> {q.question}</p>
          {q.answer && <div className="comic-note" style={{ marginTop: 10, fontSize: '.86rem' }}><strong>Ace:</strong> {q.answer}</div>}
          {!q.answer && <p className="muted" style={{ fontSize: '.8rem', marginTop: 8, marginBottom: 0 }}>Ace marked this as answered outside the site; no written summary was added.</p>}
        </ComicCard>
      ))}
    </div>
  );
}
