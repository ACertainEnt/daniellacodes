import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize2, Captions, Type, Palette, ChevronDown } from 'lucide-react';
import { parseYouTubeRef, privacyEmbed } from '@/lib/youtube';
import { SPRING_SOFT } from '@/lib/motion';
import type { VideoResource, SubtitleFile } from '@shared/types';
import { Bouncy } from './Bouncy';

/* ── YouTube IFrame Player API ─────────────────────────────────────────── */
declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void } }
let apiPromise: Promise<any> | null = null;
function loadYouTubeAPI(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prior?.(); resolve(window.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('YouTube player could not load'));
    document.head.appendChild(script);
    setTimeout(() => { if (!window.YT?.Player) reject(new Error('YouTube player timed out')); }, 12000);
  });
  return apiPromise;
}

/* ── Independent WebVTT parsing (not YouTube CC) ───────────────────────── */
export interface Cue { start: number; end: number; text: string }
const toSeconds = (stamp: string) => {
  const parts = stamp.trim().replace(',', '.').split(':');
  const s = parts.pop() || '0';
  const m = parts.pop() || '0';
  const h = parts.pop() || '0';
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
};
export function parseVTT(text: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of text.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n').filter(Boolean);
    const idx = lines.findIndex(l => l.includes('-->'));
    if (idx < 0) continue;
    const [a, b] = lines[idx].split('-->');
    const caption = lines.slice(idx + 1).join(' ').trim();
    if (!caption) continue;
    cues.push({ start: toSeconds(a), end: toSeconds(b), text: caption });
  }
  return cues.sort((x, y) => x.start - y.start);
}
const stamp = (s: number) => {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

type Prefs = { enabled: boolean; size: 'sm' | 'md' | 'lg'; bg: 'none' | 'soft' | 'solid' };
const PREFS_KEY = 'dc-caption-prefs';
const loadPrefs = (): Prefs => {
  try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) || ''); if (p && typeof p.enabled === 'boolean') return p; } catch { /* ignore */ }
  return { enabled: true, size: 'md', bg: 'solid' };
};

/* ── Player ────────────────────────────────────────────────────────────── */
export function VideoLesson({ video, subtitles, lessonTitle }: { video: VideoResource; subtitles: SubtitleFile[]; lessonTitle: string }) {
  const ref = useMemo(() => parseYouTubeRef(video.youtubeUrl), [video.youtubeUrl]);
  const frameRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [opened, setOpened] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const reduced = useReducedMotion();

  const captions = subtitles.filter(s => s.checked && (s.captionStatus === 'checked' || s.captionStatus === 'published'));
  const cues = useMemo(() => captions[0] ? parseVTT(captions[0].vtt) : [], [captions]);
  const activeCue = cues.find(c => current >= c.start && current <= c.end) || null;
  const storageKey = `dc-position:${video.id}`;

  const savePrefs = (p: Prefs) => { setPrefs(p); try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ } };

  useEffect(() => {
    if (!opened || !frameRef.current || !ref) return;
    let cancelled = false;
    (async () => {
      try {
        const YT = await loadYouTubeAPI();
        if (cancelled || !frameRef.current) return;
        // Give the YouTube API its own throwaway mount node: it replaces that
        // node with an iframe, and React never manages children of frameRef.
        const mount = document.createElement('div');
        frameRef.current.appendChild(mount);
        const saved = Number(localStorage.getItem(storageKey) || 0);
        playerRef.current = new YT.Player(mount, {
          width: '100%', height: '100%',
          videoId: ref.isPlaylist ? undefined : ref.videoId || undefined,
          playerVars: {
            playsinline: 1, rel: 0, modestbranding: 1, controls: 1, enablejsapi: 1,
            origin: window.location.origin,
            ...(ref.isPlaylist && ref.playlistId ? { listType: 'playlist', list: ref.playlistId } : {}),
            ...(ref.playlistId && !ref.isPlaylist ? { list: ref.playlistId } : {}),
            ...(saved > 2 ? { start: Math.floor(saved) } : {}),
          },
          events: {
            onReady: (e: any) => { setDuration(e.target.getDuration?.() || 0); e.target.playVideo?.(); },
            onStateChange: (e: any) => setPlaying(e.data === 1),
            onError: () => setLoadError('This video could not be played here. Check the link in ACECODES.'),
          },
        });
      } catch (err: any) { setLoadError(err.message || 'The YouTube player is unavailable.'); }
    })();
    const tick = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      try {
        const t = p.getCurrentTime();
        setCurrent(t);
        if (t > 2) localStorage.setItem(storageKey, String(Math.floor(t)));
        if (!duration && p.getDuration?.()) setDuration(p.getDuration());
      } catch { /* player not ready */ }
    }, 250);
    return () => {
      cancelled = true;
      clearInterval(tick);
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
      if (frameRef.current) frameRef.current.innerHTML = '';
    };
  }, [opened, ref?.videoId, ref?.playlistId, storageKey]);

  const call = (fn: string, ...args: any[]) => { try { playerRef.current?.[fn]?.(...args); } catch { /* ignore */ } };
  const seek = (seconds: number) => { call('seekTo', Math.max(0, seconds), true); setCurrent(Math.max(0, seconds)); };
  const fullscreen = () => {
    const el = frameRef.current?.parentElement;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
  };
  const poster = video.thumbnailUrl || ref?.thumbnailUrl;

  return (
    <motion.div className="video-card pop-in" initial={reduced ? false : { opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING_SOFT}>
      <div className="video-frame">
        <div ref={frameRef} style={{ position: 'absolute', inset: 0 }} />
        {!opened && (
          <button className="video-play" onClick={() => setOpened(true)} aria-label={`Play ${video.title || 'lesson video'}`}>
            {poster && <img className="video-poster" src={poster} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            <motion.span whileHover={reduced ? undefined : { scale: 1.1 }} whileTap={reduced ? undefined : { scale: .9 }} transition={SPRING_SOFT}><Play size={30} fill="currentColor" /></motion.span>
          </button>
        )}
        {opened && loadError && <div className="caption-missing" style={{ position: 'absolute', inset: '20% 10%', zIndex: 4 }}>{loadError} <a href={privacyEmbed(ref!)} target="_blank" rel="noreferrer">Open the embed directly</a></div>}
        <AnimatePresence>
          {opened && captions.length > 0 && prefs.enabled && activeCue && (
            <motion.div key={activeCue.start + activeCue.text} className="subtitle-overlay"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                fontSize: prefs.size === 'sm' ? '.82rem' : prefs.size === 'lg' ? '1.25rem' : '1rem',
                color: prefs.bg === 'none' ? '#fff' : 'var(--text)',
                background: prefs.bg === 'solid' ? 'var(--surface)' : prefs.bg === 'soft' ? 'rgba(16,24,20,.72)' : 'transparent',
                WebkitTextStroke: prefs.bg === 'none' ? '1px #101814' : undefined,
                textShadow: prefs.bg === 'none' ? '0 2px 5px #000' : undefined,
                border: prefs.bg === 'solid' ? '2px solid var(--outline)' : undefined,
              }}>{activeCue.text}</motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="video-meta">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Video lesson · {lessonTitle}</div>
            <strong style={{ display: 'block', fontSize: '.95rem', marginTop: 2 }}>{video.title || 'YouTube video (title not verified)'}</strong>
            <span className="muted" style={{ fontSize: '.78rem' }}>
              {video.channel || 'Channel not verified'} · {video.metadataStatus === 'verified' ? 'Metadata verified' : 'Metadata unverified'}
              {video.durationSeconds ? ` · ${Math.round(video.durationSeconds / 60)} min` : ' · Duration not supplied'}
            </span>
          </div>
          <span className="pill green" style={{ flex: 'none' }}>In-app</span>
        </div>
      </div>

      {opened && (
        <div className="subtitle-controls">
          <Bouncy size="sm" onClick={() => (playing ? call('pauseVideo') : call('playVideo'))} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </Bouncy>
          <Bouncy size="sm" onClick={() => seek(current - 10)} aria-label="Back 10 seconds"><RotateCcw size={15} /></Bouncy>
          <Bouncy size="sm" onClick={() => seek(current + 10)} aria-label="Forward 10 seconds"><RotateCw size={15} /></Bouncy>
          <Bouncy size="sm" onClick={() => { call(muted ? 'unMute' : 'mute'); setMuted(!muted); }} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </Bouncy>
          <Bouncy size="sm" onClick={fullscreen} aria-label="Fullscreen"><Maximize2 size={15} /></Bouncy>
          <span className="muted" style={{ fontSize: '.76rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {stamp(current)}{duration ? ` / ${stamp(duration)}` : ''}
          </span>
          <div style={{ flex: 1 }} />
          {captions.length > 0
            ? <Bouncy size="sm" variant={prefs.enabled ? 'primary' : 'outline'} onClick={() => savePrefs({ ...prefs, enabled: !prefs.enabled })}><Captions size={15} /> EN</Bouncy>
            : <span className="pill amber"><Captions size={13} /> Subtitles not supplied</span>}
        </div>
      )}

      {captions.length === 0 ? (
        <div className="caption-missing" style={{ margin: 10, borderRadius: 12 }}>
          <strong>No independent English subtitles yet.</strong> This lesson is not published as captioned until ACECODES uploads and checks a .vtt file. YouTube's built-in captions are not used or claimed here.
        </div>
      ) : (
        <>
          <div className="row" style={{ padding: '8px 12px', gap: 8 }}>
            <Bouncy size="sm" variant="ghost" onClick={() => setShowSettings(v => !v)}><Palette size={14} /> Caption settings <ChevronDown size={13} /></Bouncy>
            <Bouncy size="sm" variant="ghost" onClick={() => setShowTranscript(v => !v)}><Type size={14} /> {showTranscript ? 'Hide' : 'Read'} transcript</Bouncy>
          </div>
          {showSettings && (
            <div className="card soft tight" style={{ margin: '0 12px 10px' }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Subtitle size</div>
              <div className="row" style={{ marginBottom: 10 }}>
                {(['sm', 'md', 'lg'] as const).map(s => <Bouncy key={s} size="sm" variant={prefs.size === s ? 'primary' : 'outline'} onClick={() => savePrefs({ ...prefs, size: s })}>{s.toUpperCase()}</Bouncy>)}
              </div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Subtitle background</div>
              <div className="row">
                {(['none', 'soft', 'solid'] as const).map(b => <Bouncy key={b} size="sm" variant={prefs.bg === b ? 'primary' : 'outline'} onClick={() => savePrefs({ ...prefs, bg: b })}>{b}</Bouncy>)}
              </div>
              <p className="muted" style={{ fontSize: '.75rem', margin: '10px 0 0' }}>These are independent WebVTT subtitles synchronised with the player's current time — not YouTube CC.</p>
            </div>
          )}
          {showTranscript && (
            <div className="transcript">
              {cues.map((c, i) => (
                <button key={i} className={`transcript-line ${activeCue === c ? 'active' : ''}`} onClick={() => { if (!opened) setOpened(true); setTimeout(() => seek(c.start), 400); }}>
                  <span className="transcript-time">{stamp(c.start)}</span><span>{c.text}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {video.note && <p className="muted" style={{ fontSize: '.75rem', padding: '0 12px 12px', margin: 0 }}>{video.note}</p>}
    </motion.div>
  );
}

/** For videos hosted in our own storage: native HTML5 <video> with real
 *  <track> subtitles, rather than a YouTube overlay. */
export function LocalVideoPlayer({ src, vtt, title }: { src: string; vtt?: string; title: string }) {
  const url = useMemo(() => vtt ? URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' })) : '', [vtt]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <div className="video-card">
      <video className="video-frame" controls playsInline preload="metadata" style={{ objectFit: 'contain', background: '#0c1510' }}>
        <source src={src} />
        {url && <track kind="subtitles" src={url} srcLang="en" label="English" default />}
        Your browser does not support HTML video.
      </video>
      <div className="video-meta"><strong style={{ fontSize: '.9rem' }}>{title}</strong><div className="muted" style={{ fontSize: '.76rem' }}>Self-hosted video · native HTML subtitle track{vtt ? '' : ' (no independent subtitles supplied)'}</div></div>
    </div>
  );
}
