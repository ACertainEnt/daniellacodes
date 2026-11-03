/** Recognises watch links, youtu.be short links, shorts/embed links and
 *  playlist links. Metadata comes ONLY from YouTube's public oEmbed endpoint.
 *  If it cannot be reached (offline server, removed video, network policy),
 *  the resource is stored as "unverified" with a null title — never invented. */

export interface ParsedYouTube {
  videoId: string | null;
  playlistId: string | null;
  isPlaylist: boolean;
  canonicalUrl: string;
  thumbnailUrl: string | null;
}

export function parseYouTube(raw: string): ParsedYouTube | null {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  const host = url.hostname.replace(/^www\./, '');
  const hosts = ['youtube.com', 'youtube-nocookie.com', 'm.youtube.com', 'youtu.be'];
  if (!hosts.includes(host)) return null;

  let videoId: string | null = null;
  let playlistId: string | null = url.searchParams.get('list');
  const idPattern = /^[A-Za-z0-9_-]{11}$/;
  const listPattern = /^[A-Za-z0-9_-]{2,}$/;

  if (host === 'youtu.be') {
    videoId = url.pathname.slice(1).split('/')[0] || null;
  } else if (url.pathname.startsWith('/watch')) {
    videoId = url.searchParams.get('v');
  } else {
    const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/);
    if (match) videoId = match[1];
  }
  if (videoId && !idPattern.test(videoId)) videoId = null;
  if (url.pathname.startsWith('/playlist')) playlistId = url.searchParams.get('list');
  if (playlistId && !listPattern.test(playlistId)) playlistId = null;
  if (!videoId && !playlistId) return null;

  const canonicalUrl = playlistId && !videoId
    ? `https://www.youtube.com/playlist?list=${playlistId}`
    : `https://www.youtube.com/watch?v=${videoId}${playlistId ? `&list=${playlistId}` : ''}`;

  return {
    videoId, playlistId, isPlaylist: !!playlistId && !videoId,
    canonicalUrl,
    thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null,
  };
}

/** Privacy-enhanced embed (never redirects the learner to YouTube). */
export function privacyEmbedUrl(parsed: ParsedYouTube): string {
  const base = 'https://www.youtube-nocookie.com/embed/';
  if (parsed.isPlaylist && parsed.playlistId) return `${base}videoseries?list=${parsed.playlistId}`;
  return `${base}${parsed.videoId}${parsed.playlistId ? `?list=${parsed.playlistId}` : ''}`;
}

export interface YouTubeMetadata {
  title: string | null;
  channel: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;   // oEmbed does not provide this
  status: 'verified' | 'unverified' | 'failed';
  checkedAt: string;
}

export async function fetchMetadata(parsed: ParsedYouTube): Promise<YouTubeMetadata> {
  const checkedAt = new Date().toISOString();
  const fallback: YouTubeMetadata = {
    title: null, channel: null, thumbnailUrl: parsed.thumbnailUrl,
    durationSeconds: null, status: 'unverified', checkedAt,
  };
  if (parsed.isPlaylist || !parsed.videoId) return fallback; // oEmbed has no playlist metadata
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&format=json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ...fallback, status: 'failed' };
    const data: any = await res.json();
    return {
      title: typeof data.title === 'string' ? data.title : null,
      channel: typeof data.author_name === 'string' ? data.author_name : null,
      thumbnailUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : parsed.thumbnailUrl,
      durationSeconds: null,   // deliberately unknown
      status: 'verified', checkedAt,
    };
  } catch {
    return fallback;
  }
}
