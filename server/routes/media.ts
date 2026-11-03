import { Router } from 'express';
import { requireUser, requireRole, audit } from '../auth';
import type { AuthedRequest } from '../auth';
import { db } from '../db';
import { now, randomId } from '../env';
import { parseYouTube, fetchMetadata } from '../youtube';
import { putFile } from '../storage';

export const mediaRouter = Router();
mediaRouter.use(requireUser);
const instructor = requireRole('instructor');

const vttLooksValid = (text: string) =>
  /^WEBVTT(\s|$)/m.test(text.trim()) && /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/.test(text);

/* All media routes return the SAME public shapes as the lesson detail
   endpoint, so the instructor console and the student view agree. */
const videoView = (v: Record<string, any>) => ({
  id: v.id, lessonId: v.lesson_id, sessionId: v.session_id, youtubeUrl: v.youtube_url,
  videoId: v.video_id, playlistId: v.playlist_id, isPlaylist: !!v.is_playlist,
  title: v.title, channel: v.channel, thumbnailUrl: v.thumbnail_url,
  durationSeconds: v.duration_seconds, metadataStatus: v.metadata_status,
  metadataCheckedAt: v.metadata_checked_at, note: v.note,
  orderIndex: v.order_index, createdBy: v.created_by,
});
const subtitleView = (s: Record<string, any>) => ({
  id: s.id, lessonId: s.lesson_id, videoId: s.video_id, language: s.language,
  fileName: s.file_name, storagePath: s.storage_path, vtt: s.vtt,
  checked: !!s.checked, checkedAt: s.checked_at, checkedBy: s.checked_by,
  captionStatus: s.caption_status, updatedAt: s.updated_at,
});
const assetView = (a: Record<string, any>) => ({
  id: a.id, lessonId: a.lesson_id, kind: a.kind, title: a.title, url: a.url, createdAt: a.created_at,
});

mediaRouter.get('/videos/:lessonId', async (req, res) => {
  const rows = await db.all('video_resources', { where: { lesson_id: req.params.lessonId }, order: { column: 'order_index' } });
  res.json({ videos: rows.map(videoView) });
});

mediaRouter.get('/subtitles/:lessonId', async (req, res) => {
  const rows = await db.all('subtitle_files', { where: { lesson_id: req.params.lessonId } });
  const isInstructor = (req as AuthedRequest).user.role === 'instructor';
  res.json({ subtitles: (isInstructor ? rows : rows.filter(s => s.checked && (s.caption_status === 'checked' || s.caption_status === 'published'))).map(subtitleView) });
});

mediaRouter.get('/assets/:lessonId', async (req, res) => {
  res.json({ assets: (await db.all('lesson_assets', { where: { lesson_id: req.params.lessonId } })).map(assetView) });
});

/** Preview a YouTube URL without saving anything. Metadata is real oEmbed
 *  data; if it cannot be retrieved the title stays null and status is
 *  'unverified' — nothing is invented. */
mediaRouter.post('/videos/preview', instructor, async (req, res) => {
  const parsed = parseYouTube(String(req.body?.url || ''));
  if (!parsed) return res.status(400).json({ error: 'That is not a supported YouTube watch, youtu.be, shorts or playlist link.' });
  const metadata = await fetchMetadata(parsed);
  res.json({ parsed, metadata });
});

mediaRouter.post('/videos', instructor, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { url, lessonId, note } = req.body || {};
  const parsed = parseYouTube(String(url || ''));
  if (!parsed) return res.status(400).json({ error: 'Unsupported YouTube URL.' });
  if (lessonId && !await db.one('lessons', { id: lessonId })) return res.status(404).json({ error: 'Lesson not found.' });
  const metadata = await fetchMetadata(parsed);
  const existing = await db.all('video_resources', { where: { lesson_id: lessonId ?? '' } });
  const row = await db.insert('video_resources', {
    id: randomId(), lesson_id: lessonId ?? null,
    session_id: lessonId ? (await db.one('lessons', { id: lessonId }))?.session_id ?? null : null,
    youtube_url: parsed.canonicalUrl, video_id: parsed.videoId ?? '',
    playlist_id: parsed.playlistId, is_playlist: parsed.isPlaylist ? 1 : 0,
    title: metadata.title, channel: metadata.channel,
    thumbnail_url: metadata.thumbnailUrl || parsed.thumbnailUrl,
    duration_seconds: metadata.durationSeconds, metadata_status: metadata.status,
    metadata_checked_at: metadata.checkedAt, note: note || null,
    order_index: existing.length, created_by: user.id, created_at: now(),
  });
  await audit(user.id, 'video.add', row.id, { url: parsed.canonicalUrl, status: metadata.status });
  res.json({ video: videoView(row), note: metadata.status === 'verified'
    ? 'Metadata verified from YouTube oEmbed. Duration is not provided by oEmbed and is left blank.'
    : 'URL was recognised, but YouTube metadata could not be verified from this server. The video is marked unverified; no title or duration has been invented.' });
});

mediaRouter.patch('/videos/:id', instructor, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const video = await db.one('video_resources', { id: req.params.id });
  if (!video) return res.status(404).json({ error: 'Video not found.' });
  const patch: Record<string, unknown> = {};
  if (typeof req.body?.title === 'string') patch.title = req.body.title;
  if (typeof req.body?.note === 'string') patch.note = req.body.note;
  if (Number.isFinite(Number(req.body?.order_index))) patch.order_index = Number(req.body.order_index);
  if (req.body?.verify) {
    const parsed = parseYouTube(video.youtube_url);
    if (parsed) {
      const meta = await fetchMetadata(parsed);
      patch.title = meta.title; patch.channel = meta.channel;
      patch.thumbnail_url = meta.thumbnailUrl;
      patch.metadata_status = meta.status; patch.metadata_checked_at = meta.checkedAt;
    }
  }
  await db.update('video_resources', { id: video.id }, patch);
  await audit(user.id, 'video.edit', video.id, patch);
  res.json({ ok: true });
});

mediaRouter.delete('/videos/:id', instructor, async (req, res) => {
  const user = (req as AuthedRequest).user;
  await db.remove('video_resources', { id: req.params.id });
  await audit(user.id, 'video.delete', req.params.id);
  res.json({ ok: true });
});

/** Independent English subtitles. A lesson is only "captioned" once a real
 *  .vtt file has been uploaded AND checked by the instructor. */
mediaRouter.post('/subtitles', instructor, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { lessonId, videoId = null, fileName, vtt } = req.body || {};
  if (!lessonId || !await db.one('lessons', { id: lessonId })) return res.status(404).json({ error: 'Lesson not found.' });
  if (typeof vtt !== 'string' || !vttLooksValid(vtt)) {
    return res.status(400).json({ error: 'Upload a valid WebVTT file: it must start with WEBVTT and contain at least one timestamped cue.' });
  }
  const name = String(fileName || 'captions.vtt').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = await putFile('subtitles', `${lessonId}-${Date.now()}-${name}`, vtt, 'text/vtt');
  const existing = await db.one('subtitle_files', { lesson_id: lessonId, language: 'en' });
  if (existing) {
    await db.update('subtitle_files', { id: existing.id }, {
      file_name: name, storage_path: storagePath, vtt, checked: 0, checked_at: null,
      checked_by: null, caption_status: 'uploaded', video_id: videoId, updated_at: now(),
    });
    await audit(user.id, 'subtitle.replace', existing.id, { name });
    return res.json({ ok: true, id: existing.id, captionStatus: 'uploaded', note: 'Subtitles replaced. Check and publish them before the lesson is shown as captioned.' });
  }
  const row = await db.insert('subtitle_files', {
    id: randomId(), lesson_id: lessonId, video_id: videoId, language: 'en',
    file_name: name, storage_path: storagePath, vtt, checked: 0, checked_at: null,
    checked_by: null, caption_status: 'uploaded', updated_at: now(),
  });
  await audit(user.id, 'subtitle.upload', row.id, { name });
  res.json({ ok: true, id: row.id, captionStatus: 'uploaded' });
});

mediaRouter.patch('/subtitles/:id', instructor, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const row = await db.one('subtitle_files', { id: req.params.id });
  if (!row) return res.status(404).json({ error: 'Subtitle file not found.' });
  const patch: Record<string, unknown> = { updated_at: now() };
  if (typeof req.body?.vtt === 'string') {
    if (!vttLooksValid(req.body.vtt)) return res.status(400).json({ error: 'Invalid WebVTT content.' });
    patch.vtt = req.body.vtt; patch.checked = 0; patch.caption_status = 'uploaded'; patch.checked_at = null;
  }
  if (req.body?.checked === true) {
    patch.checked = 1; patch.checked_at = now(); patch.checked_by = user.id;
    patch.caption_status = req.body.publish === true ? 'published' : 'checked';
  }
  if (req.body?.checked === false) { patch.checked = 0; patch.caption_status = 'uploaded'; patch.checked_at = null; }
  await db.update('subtitle_files', { id: row.id }, patch);
  await audit(user.id, 'subtitle.edit', row.id, { checked: patch.checked, status: patch.caption_status });
  res.json({ ok: true });
});

mediaRouter.delete('/subtitles/:id', instructor, async (req, res) => {
  await db.remove('subtitle_files', { id: req.params.id });
  res.json({ ok: true });
});

mediaRouter.post('/assets', instructor, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { lessonId, kind, title, url, dataUrl, fileName } = req.body || {};
  if (!lessonId || !await db.one('lessons', { id: lessonId })) return res.status(404).json({ error: 'Lesson not found.' });
  let finalUrl = String(url || '');
  if (kind === 'image' && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data.' });
    finalUrl = await putFile('lesson-assets', `${lessonId}-${Date.now()}-${String(fileName || 'image').replace(/[^a-zA-Z0-9._-]/g, '_')}`,
      Buffer.from(match[2], 'base64'), match[1]);
  }
  if (!finalUrl) return res.status(400).json({ error: 'Provide a URL or an image upload.' });
  const row = await db.insert('lesson_assets', {
    id: randomId(), lesson_id: lessonId, kind: kind === 'image' ? 'image' : kind === 'file' ? 'file' : 'link',
    title: String(title || 'Resource'), url: finalUrl, created_at: now(),
  });
  await audit(user.id, 'asset.add', row.id, { kind });
  res.json({ asset: assetView(row) });
});

mediaRouter.delete('/assets/:id', instructor, async (req, res) => {
  await db.remove('lesson_assets', { id: req.params.id });
  res.json({ ok: true });
});
