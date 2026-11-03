import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { localGet, localPut } from '@/lib/offline';

type LessonLink = { id: string; title: string };
export async function rememberLesson(lesson: { id: string; title: string }) {
  const list = await localGet<LessonLink[]>('lesson-index') || [];
  await localPut('lesson-index', [lesson, ...list.filter(item => item.id !== lesson.id)].slice(0, 100));
}
export function OfflineLessons() {
  const [lessons, setLessons] = useState<LessonLink[]>([]);
  useEffect(() => { localGet<LessonLink[]>('lesson-index').then(v => setLessons(v || [])).catch(() => {}); }, []);
  if (!lessons.length) return null;
  return <section className="comic-note"><strong>Lessons saved on this device</strong><p>Previously opened lesson text is available during this signed-in session. Other lessons need internet.</p><ul>{lessons.map(l => <li key={l.id}><Link to={'/app/lesson/' + encodeURIComponent(l.id)}>{l.title}</Link></li>)}</ul></section>;
}
export function LessonNotes({ lessonId }: { lessonId: string }) {
  const [text, setText] = useState('');
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const writes = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    setReady(false); setText(''); setStatus('');
    localGet<string>('note:' + lessonId).then(value => { if (active) { setText(value || ''); setReady(true); setStatus('Saved on this device only'); } }).catch(() => { if (active) setStatus('Device storage unavailable; notes cannot be saved.'); });
    return () => { active = false; };
  }, [lessonId]);
  const save = (value: string) => {
    setText(value); setStatus('Saving on this device…');
    writes.current = writes.current.catch(() => {}).then(() => localPut('note:' + lessonId, value));
    const current = writes.current;
    current.then(() => { if (writes.current === current) setStatus('Saved on this device only — not synced'); }).catch(() => setStatus('Save failed — copy your notes before leaving.'));
  };
  return <section className="card"><label htmlFor="lesson-notes"><strong>Your lesson notes</strong></label><p className="muted">Private to this browser. Notes are not yet synchronised; clearing browser storage removes them.</p><textarea id="lesson-notes" className="input" rows={5} value={text} disabled={!ready} onChange={e => save(e.target.value)} placeholder="Explain the concept in your own words…" /><div className="muted" role="status">{status}</div></section>;
}
