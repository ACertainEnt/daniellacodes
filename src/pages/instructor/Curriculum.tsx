import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, ArrowUp, ArrowDown, Youtube, Captions, Link2, Trash2, Check, Pencil, Upload, ExternalLink } from 'lucide-react';
import { api, post, patch, del } from '@/lib/api';
import { Bouncy } from '@/components/Bouncy';
import { ComicCard, Pill } from '@/components/ui';
import { Sheet, toast } from '@/components/overlays';

interface LessonRow { id: string; title: string; slug: string; order_index: number; minutes: number; published: number; content_json: any; videos: any[]; subtitles: any[]; assets: any[] }
interface SessionRow { id: string; title: string; subtitle: string; order_index: number; published: number; lessons: LessonRow[]; exam: any }

export default function Curriculum() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newSession, setNewSession] = useState({ title: '', subtitle: '', description: '' });
  const reload = useCallback(() => api<{ sessions: SessionRow[] }>('/api/instructor/curriculum').then(r => setSessions(r.sessions)).catch(e => toast.show(e.message, 'warn')), []);
  useEffect(() => { reload(); }, [reload]);

  const addSession = async () => {
    if (!newSession.title.trim()) return;
    await post('/api/instructor/sessions', newSession);
    setAddOpen(false); setNewSession({ title: '', subtitle: '', description: '' });
    toast.show('Session created.'); reload();
  };

  const reorder = async (session: SessionRow, index: number, dir: -1 | 1) => {
    const ids = session.lessons.map(l => l.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await post('/api/instructor/lessons/reorder', { sessionId: session.id, orderedIds: ids });
    reload();
  };

  return (
    <div className="stack">
      <div className="row-between">
        <div><div className="eyebrow">ACECODES</div><h1 className="section-title" style={{ fontSize: '2rem' }}>Course management</h1></div>
        <Bouncy variant="primary" onClick={() => setAddOpen(true)}><Plus size={16} /> Add session</Bouncy>
      </div>
      <p className="muted" style={{ fontSize: '.85rem' }}>
        Edit lesson content, publish/unpublish, reorder lessons, add verified YouTube videos, upload independent .vtt subtitles and attach learning material. Every change is saved to the database.
      </p>
      <div className="comic-note" style={{ fontSize: '.82rem' }}>
        <strong>Caption rule:</strong> a lesson is only shown to Daniella as captioned after you upload a WebVTT file AND mark it checked/published. The nine preloaded videos have verified titles but no invented subtitles or durations.
      </div>

      {sessions.map(s => (
        <ComicCard key={s.id} className="tight">
          <button className="accordion-head" onClick={() => setExpanded(e => ({ ...e, [s.id]: !e[s.id] }))}>
            <div>
              <div className="eyebrow">Session {s.order_index}</div>
              <strong style={{ fontSize: '1.02rem' }}>{s.title}</strong>
              <div className="muted" style={{ fontSize: '.78rem' }}>{s.lessons.length} lessons · {s.subtitle}</div>
            </div>
            <div className="row" style={{ gap: 7 }}>
              <Pill tone={s.published ? 'green' : 'red'}>{s.published ? 'Published' : 'Hidden'}</Pill>
              {expanded[s.id] ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
            </div>
          </button>
          {expanded[s.id] && (
            <div className="stack" style={{ gap: 10, marginTop: 12 }}>
              <div className="row">
                <Bouncy size="sm" onClick={async () => { await patch(`/api/instructor/sessions/${s.id}`, { published: !s.published }); reload(); }}>
                  {s.published ? 'Unpublish session' : 'Publish session'}
                </Bouncy>
                <AddLesson session={s} onDone={reload} />
              </div>
              {s.lessons.length === 0 && <div className="empty-state">No lessons in this session yet.</div>}
              {s.lessons.map((l, i) => (
                <div key={l.id} className="card soft tight">
                  <div className="row-between">
                    <div style={{ minWidth: 0 }}>
                      <div className="eyebrow">Lesson {i + 1} · {l.minutes} min</div>
                      <strong style={{ fontSize: '.9rem' }}>{l.title}</strong>
                      <div className="row" style={{ gap: 6, marginTop: 5 }}>
                        <Pill tone={l.published ? 'green' : 'red'}>{l.published ? 'Live' : 'Hidden'}</Pill>
                        <Pill tone={l.videos.length ? 'plain' : 'plain'}><Youtube size={12} /> {l.videos.length} video{l.videos.length === 1 ? '' : 's'}</Pill>
                        <Pill tone={l.subtitles.some(t => t.checked && ['checked', 'published'].includes(t.captionStatus)) ? 'green' : 'amber'}>
                          <Captions size={12} /> {l.subtitles.some(t => t.checked && ['checked', 'published'].includes(t.captionStatus)) ? 'Captioned' : 'No checked subtitles'}
                        </Pill>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 5, flex: 'none' }}>
                      <button className="icon-btn small" onClick={() => reorder(s, i, -1)} aria-label="Move up" disabled={i === 0}><ArrowUp size={15} /></button>
                      <button className="icon-btn small" onClick={() => reorder(s, i, 1)} aria-label="Move down" disabled={i === s.lessons.length - 1}><ArrowDown size={15} /></button>
                    </div>
                  </div>
                  <div className="btn-row" style={{ marginTop: 10 }}>
                    <LessonEditor lesson={l} onDone={reload} />
                    <VideoManager lesson={l} onDone={reload} />
                    <SubtitleManager lesson={l} onDone={reload} />
                    <AssetManager lesson={l} onDone={reload} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ComicCard>
      ))}

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add a session"
        footer={<Bouncy variant="primary" block onClick={addSession}>Create session</Bouncy>}>
        <div className="inline-form">
          <div><label className="field-label">Title</label><input className="input" value={newSession.title} onChange={e => setNewSession({ ...newSession, title: e.target.value })} /></div>
          <div><label className="field-label">Subtitle</label><input className="input" value={newSession.subtitle} onChange={e => setNewSession({ ...newSession, subtitle: e.target.value })} /></div>
          <div><label className="field-label">Description</label><textarea className="textarea" value={newSession.description} onChange={e => setNewSession({ ...newSession, description: e.target.value })} /></div>
        </div>
      </Sheet>
    </div>
  );
}

function AddLesson({ session, onDone }: { session: SessionRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(20);
  const save = async () => {
    if (!title.trim()) return;
    await post('/api/instructor/lessons', { sessionId: session.id, title, minutes });
    setOpen(false); setTitle(''); toast.show('Lesson created — edit its content next.'); onDone();
  };
  return <>
    <Bouncy size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Add lesson</Bouncy>
    <Sheet open={open} onClose={() => setOpen(false)} title="Add a lesson" footer={<Bouncy variant="primary" block onClick={save}>Create lesson</Bouncy>}>
      <div className="inline-form two">
        <div><label className="field-label">Lesson title</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div><label className="field-label">Minutes</label><input className="input" type="number" value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></div>
      </div>
      <p className="muted" style={{ fontSize: '.8rem', marginTop: 12 }}>New lessons start with the full 13-section structure (empty). Use “Edit content” to fill it in.</p>
    </Sheet>
  </>;
}

function LessonEditor({ lesson, onDone }: { lesson: LessonRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const c = lesson.content_json || {};
  const [form, setForm] = useState({
    title: lesson.title, minutes: lesson.minutes, published: !!lesson.published,
    whyItMatters: c.whyItMatters || '', exerciseBrief: c.practicalExercise?.brief || '',
    recap: (c.recap || []).join('\n'),
    advanced: JSON.stringify(c, null, 2),
  });
  const save = async () => {
    let content: any = {};
    try { content = JSON.parse(form.advanced); }
    catch { toast.show('Advanced content is not valid JSON.', 'warn'); return; }
    content.title = form.title;
    content.whyItMatters = form.whyItMatters;
    content.recap = String(form.recap).split('\n').map((s: string) => s.trim()).filter(Boolean);
    content.practicalExercise = { ...(content.practicalExercise || {}), brief: form.exerciseBrief };
    await patch(`/api/instructor/lessons/${lesson.id}`, { title: form.title, minutes: form.minutes, published: form.published, content });
    setOpen(false); toast.show('Lesson saved.'); onDone();
  };
  return <>
    <Bouncy size="sm" onClick={() => setOpen(true)}><Pencil size={14} /> Edit content</Bouncy>
    <Sheet open={open} onClose={() => setOpen(false)} title={`Edit · ${lesson.title}`} footer={<Bouncy variant="primary" block onClick={save}>Save lesson</Bouncy>}>
      <div className="inline-form two">
        <div><label className="field-label">Title</label><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div><label className="field-label">Minutes</label><input className="input" type="number" value={form.minutes} onChange={e => setForm({ ...form, minutes: Number(e.target.value) })} /></div>
      </div>
      <label className="row" style={{ gap: 8, margin: '12px 0', fontWeight: 800, fontSize: '.87rem' }}>
        <input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} /> Published (visible to Daniella)
      </label>
      <div><label className="field-label">Why it matters</label><textarea className="textarea" value={form.whyItMatters} onChange={e => setForm({ ...form, whyItMatters: e.target.value })} /></div>
      <div style={{ marginTop: 10 }}><label className="field-label">Practical exercise brief</label><textarea className="textarea" value={form.exerciseBrief} onChange={e => setForm({ ...form, exerciseBrief: e.target.value })} /></div>
      <div style={{ marginTop: 10 }}><label className="field-label">Recap (one point per line)</label><textarea className="textarea" value={form.recap} onChange={e => setForm({ ...form, recap: e.target.value })} /></div>
      <details style={{ marginTop: 14 }}>
        <summary style={{ fontWeight: 900, cursor: 'pointer', fontSize: '.85rem' }}>Advanced: edit the full 13-section lesson JSON</summary>
        <p className="muted" style={{ fontSize: '.78rem' }}>Includes explanations, step-by-step, examples, code snippets with line notes, common mistakes and knowledge checks.</p>
        <textarea className="textarea" style={{ minHeight: 260, fontFamily: 'ui-monospace, monospace', fontSize: '.76rem' }} value={form.advanced} onChange={e => setForm({ ...form, advanced: e.target.value })} />
      </details>
    </Sheet>
  </>;
}

function VideoManager({ lesson, onDone }: { lesson: LessonRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    try { setPreview(await post('/api/media/videos/preview', { url })); }
    catch (e: any) { toast.show(e.message, 'warn'); setPreview(null); }
    finally { setBusy(false); }
  };
  const save = async () => {
    try {
      const r = await post<{ note: string }>('/api/media/videos', { url, lessonId: lesson.id });
      toast.show('Video added to this lesson.');
      setUrl(''); setPreview(null); setOpen(false); onDone();
    } catch (e: any) { toast.show(e.message, 'warn'); }
  };
  return <>
    <Bouncy size="sm" onClick={() => setOpen(true)}><Youtube size={14} /> Videos ({lesson.videos.length})</Bouncy>
    <Sheet open={open} onClose={() => setOpen(false)} title={`YouTube videos · ${lesson.title}`}>
      <div className="stack" style={{ gap: 8 }}>
        {lesson.videos.map(v => (
          <div key={v.id} className="card soft tight">
            <div className="row" style={{ gap: 10 }}>
              {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" style={{ width: 92, borderRadius: 8, border: '2px solid var(--outline)' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: '.83rem' }}>{v.title || 'Title not verified'}</strong>
                <div className="muted" style={{ fontSize: '.74rem' }}>{v.channel || 'Channel unknown'} · {v.metadataStatus}</div>
                <div className="muted" style={{ fontSize: '.71rem' }}>{v.durationSeconds ? `${Math.round(v.durationSeconds / 60)} min` : 'Duration not supplied by oEmbed'}</div>
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <a className="btn sm" href={v.youtubeUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Verify on YouTube</a>
              <Bouncy size="sm" onClick={async () => { await patch(`/api/media/videos/${v.id}`, { verify: true }); toast.show('Metadata re-checked.'); onDone(); }}>Re-check metadata</Bouncy>
              <Bouncy size="sm" variant="danger" onClick={async () => { await del(`/api/media/videos/${v.id}`); onDone(); }}><Trash2 size={13} /></Bouncy>
            </div>
          </div>
        ))}
        {lesson.videos.length === 0 && <div className="empty-state">No video attached to this lesson.</div>}
      </div>
      <div className="divider-label" style={{ margin: '16px 0 10px' }}>Add a YouTube URL</div>
      <label className="field-label">Watch link, youtu.be link, shorts link or playlist link</label>
      <input className="input" value={url} onChange={e => { setUrl(e.target.value); setPreview(null); }} placeholder="https://www.youtube.com/watch?v=…" />
      <div className="btn-row" style={{ marginTop: 10 }}>
        <Bouncy size="sm" onClick={check} disabled={busy || !url}>{busy ? 'Checking…' : 'Preview metadata'}</Bouncy>
        <Bouncy size="sm" variant="primary" onClick={save} disabled={!preview}>Add to lesson</Bouncy>
      </div>
      {preview && (
        <div className="card soft tight pop-in" style={{ marginTop: 12 }}>
          <strong style={{ fontSize: '.85rem' }}>ID: {preview.parsed.videoId || preview.parsed.playlistId}</strong>
          <div className="muted" style={{ fontSize: '.78rem' }}>Playlist: {String(preview.parsed.isPlaylist)} · Thumbnail: {preview.parsed.thumbnailUrl ? 'derived from ID' : 'playlist (none)'}</div>
          <div className="muted" style={{ fontSize: '.78rem' }}>Title: {preview.metadata.title || 'not available'} · Channel: {preview.metadata.channel || 'not available'} · Status: {preview.metadata.status}</div>
          <p className="muted" style={{ fontSize: '.75rem', margin: '8px 0 0' }}>Duration is never invented. If oEmbed cannot be reached, the video is stored as unverified with a null title.</p>
        </div>
      )}
    </Sheet>
  </>;
}

function SubtitleManager({ lesson, onDone }: { lesson: LessonRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [vtt, setVtt] = useState(lesson.subtitles[0]?.vtt || '');
  const [fileName, setFileName] = useState(lesson.subtitles[0]?.fileName || 'english.vtt');
  const fileRef = useRef<HTMLInputElement>(null);
  const current = lesson.subtitles.find(t => t.language === 'en');
  const upload = async () => {
    if (!vtt.trim()) return;
    try { await post('/api/media/subtitles', { lessonId: lesson.id, fileName, vtt }); toast.show('Subtitle file uploaded. Check and publish it to enable captions.'); onDone(); }
    catch (e: any) { toast.show(e.message, 'warn'); }
  };
  const mark = async (checked: boolean, publish: boolean) => {
    if (!current) return;
    await patch(`/api/media/subtitles/${current.id}`, { checked, publish });
    toast.show(checked ? 'Subtitles checked and published as captioned.' : 'Subtitles unchecked.');
    onDone();
  };
  return <>
    <Bouncy size="sm" onClick={() => setOpen(true)}><Captions size={14} /> Subtitles</Bouncy>
    <Sheet open={open} onClose={() => setOpen(false)} title={`Independent English subtitles · ${lesson.title}`}>
      <div className={current?.checked ? 'comic-note' : 'warn-note'} style={{ fontSize: '.83rem', marginBottom: 12 }}>
        Status: <strong>{current?.captionStatus || 'not_supplied'}</strong>. {current?.checked ? 'Checked — Daniella can toggle these captions and read the transcript.' : 'Not checked — this lesson is NOT presented as captioned.'}
      </div>
      <label className="field-label">Upload a .vtt file</label>
      <input ref={fileRef} type="file" accept=".vtt,text/vtt,text/plain" className="input" style={{ padding: 9 }}
        onChange={e => {
          const f = e.target.files?.[0]; if (!f) return;
          setFileName(f.name);
          const reader = new FileReader();
          reader.onload = () => setVtt(String(reader.result || ''));
          reader.readAsText(f);
        }} />
      <div style={{ marginTop: 10 }}><label className="field-label">Or paste / edit WebVTT content</label>
        <textarea className="textarea" style={{ minHeight: 190, fontFamily: 'ui-monospace, monospace', fontSize: '.78rem' }} value={vtt} onChange={e => setVtt(e.target.value)}
          placeholder={'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nWelcome to this lesson.'} />
      </div>
      <p className="muted" style={{ fontSize: '.76rem' }}>A valid file starts with WEBVTT and contains timestamped cues. These are independent of YouTube's built-in CC.</p>
      <div className="btn-row">
        <Bouncy variant="primary" size="sm" onClick={upload}><Upload size={14} /> Save subtitles</Bouncy>
        {current && <Bouncy size="sm" onClick={() => mark(true, true)} disabled={!!current.checked}><Check size={14} /> Check & publish</Bouncy>}
        {current?.checked && <Bouncy size="sm" variant="danger" onClick={() => mark(false, false)}>Uncheck</Bouncy>}
        {current && <Bouncy size="sm" variant="danger" onClick={async () => { await del(`/api/media/subtitles/${current.id}`); onDone(); }}><Trash2 size={13} /></Bouncy>}
      </div>
    </Sheet>
  </>;
}

function AssetManager({ lesson, onDone }: { lesson: LessonRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const addLink = async () => {
    if (!title || !url) return;
    await post('/api/media/assets', { lessonId: lesson.id, kind: 'link', title, url });
    setTitle(''); setUrl(''); toast.show('Resource added.'); onDone();
  };
  const addImage = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file);
    });
    await post('/api/media/assets', { lessonId: lesson.id, kind: 'image', title: file.name, fileName: file.name, dataUrl });
    toast.show('Image uploaded.'); onDone();
  };
  return <>
    <Bouncy size="sm" onClick={() => setOpen(true)}><Link2 size={14} /> Materials ({lesson.assets.length})</Bouncy>
    <Sheet open={open} onClose={() => setOpen(false)} title={`Learning materials · ${lesson.title}`}>
      <div className="stack" style={{ gap: 8 }}>
        {lesson.assets.map(a => (
          <div key={a.id} className="card soft tight row-between">
            <div><strong style={{ fontSize: '.83rem' }}>{a.title}</strong><div className="muted" style={{ fontSize: '.73rem', wordBreak: 'break-all' }}>{a.url}</div></div>
            <Bouncy size="sm" variant="danger" onClick={async () => { await del(`/api/media/assets/${a.id}`); onDone(); }}><Trash2 size={13} /></Bouncy>
          </div>
        ))}
        {lesson.assets.length === 0 && <div className="empty-state">No extra material attached.</div>}
      </div>
      <div className="divider-label" style={{ margin: '16px 0 10px' }}>Add external link</div>
      <div className="inline-form">
        <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
        <input className="input" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} />
        <Bouncy size="sm" onClick={addLink}>Add link</Bouncy>
      </div>
      <div className="divider-label" style={{ margin: '16px 0 10px' }}>Upload an image or diagram</div>
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="input" style={{ padding: 9 }}
        onChange={e => { const f = e.target.files?.[0]; if (f) addImage(f).catch(err => toast.show(err.message, 'warn')); }} />
      <p className="muted" style={{ fontSize: '.76rem' }}>Files go to the local storage directory, or Supabase Storage in production mode.</p>
    </Sheet>
  </>;
}
