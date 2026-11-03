export interface ParsedRef { videoId: string | null; playlistId: string | null; isPlaylist: boolean; thumbnailUrl: string | null }

export function parseYouTubeRef(raw: string): ParsedRef | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');
    if (!['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return null;
    let videoId: string | null = null;
    let playlistId = url.searchParams.get('list');
    if (host === 'youtu.be') videoId = url.pathname.slice(1).split('/')[0] || null;
    else if (url.pathname === '/watch') videoId = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);
      if (m) videoId = m[1];
    }
    if (videoId && !/^[A-Za-z0-9_-]{11}$/.test(videoId)) videoId = null;
    if (!videoId && !playlistId) return null;
    return { videoId, playlistId, isPlaylist: !videoId && !!playlistId, thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null };
  } catch { return null; }
}

/** Privacy-enhanced embed, opened inside the platform — never a redirect. */
export function privacyEmbed(ref: ParsedRef): string {
  if (ref.isPlaylist && ref.playlistId) return `https://www.youtube-nocookie.com/embed/videoseries?list=${ref.playlistId}`;
  return `https://www.youtube-nocookie.com/embed/${ref.videoId}${ref.playlistId ? `?list=${ref.playlistId}` : ''}`;
}
