export type EmbedPlatform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'pinterest';

function parseHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function pathParts(url: URL): string[] {
  return url.pathname.split('/').map((part) => part.trim()).filter(Boolean);
}

function hostMatches(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}

/** Official TikTok embed iframe (oEmbed's player, without injecting embed.js). */
export function tiktokEmbedSrc(sourceUrl: string): string | null {
  const url = parseHttpUrl(sourceUrl);
  if (!url || !hostMatches(url.hostname, 'tiktok.com')) return null;
  const parts = pathParts(url);
  const videoAt = parts.findIndex((part) => part.toLowerCase() === 'video');
  const id = videoAt >= 0 ? parts[videoAt + 1] : '';
  if (!id || !/^\d+$/.test(id)) return null;
  return `https://www.tiktok.com/embed/v2/${id}`;
}

/** Instagram's public embed iframe — not the blockquote widget (that hits a login wall in srcDoc). */
export function instagramEmbedSrc(sourceUrl: string): string | null {
  const url = parseHttpUrl(sourceUrl);
  if (!url) return null;
  if (!hostMatches(url.hostname, 'instagram.com') && !hostMatches(url.hostname, 'instagr.am')) {
    return null;
  }
  const parts = pathParts(url);
  const kind = parts[0]?.toLowerCase() === 'reels' ? 'reel' : parts[0]?.toLowerCase();
  const code = parts[1] ?? '';
  if ((kind !== 'p' && kind !== 'reel' && kind !== 'tv') || !/^[\w-]+$/.test(code)) return null;
  return `https://www.instagram.com/${kind}/${code}/embed/`;
}

function isFacebookVideoPath(url: URL): boolean {
  const parts = pathParts(url);
  if (hostMatches(url.hostname, 'fb.watch')) return true;
  if (parts[0]?.toLowerCase() === 'watch') return true;
  if (parts[0]?.toLowerCase() === 'reel') return true;
  if (parts[0]?.toLowerCase() === 'share' && /^(v|r)$/i.test(parts[1] ?? '')) return true;
  if (parts.some((part) => part.toLowerCase() === 'videos')) return true;
  if (url.searchParams.get('v') && /^\d+$/.test(url.searchParams.get('v') ?? '')) return true;
  return false;
}

/**
 * Meta's official plugin iframes.
 * Videos: https://developers.facebook.com/docs/plugins/embedded-video-player/
 * Posts:  https://developers.facebook.com/docs/plugins/embedded-posts/
 */
export function facebookEmbedSrc(sourceUrl: string): string | null {
  const url = parseHttpUrl(sourceUrl);
  if (!url) return null;
  const href = encodeURIComponent(sourceUrl);
  if (isFacebookVideoPath(url)) {
    return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=500`;
  }
  return `https://www.facebook.com/plugins/post.php?href=${href}&show_text=false&width=500`;
}

/** Pinterest's official single-pin embed iframe. */
export function pinterestEmbedSrc(sourceUrl: string): string | null {
  const url = parseHttpUrl(sourceUrl);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./i, '');
  if (!/^pinterest\.[a-z.]+$/i.test(host)) return null;
  const parts = pathParts(url);
  if (parts[0]?.toLowerCase() !== 'pin') return null;
  const id = parts[1]?.match(/^\d+/)?.[0];
  if (!id) return null;
  return `https://assets.pinterest.com/ext/embed.html?id=${id}`;
}

export function youtubeIdFromUrl(sourceUrl: string): string | null {
  const url = parseHttpUrl(sourceUrl);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = pathParts(url)[0] ?? '';
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  const fromQuery = url.searchParams.get('v');
  if (fromQuery && /^[\w-]{11}$/.test(fromQuery)) return fromQuery;
  const parts = pathParts(url);
  if ((parts[0]?.toLowerCase() === 'shorts' || parts[0]?.toLowerCase() === 'embed') && /^[\w-]{11}$/.test(parts[1] ?? '')) {
    return parts[1];
  }
  return null;
}

export function youtubeEmbedSrc(videoId: string | null | undefined): string | null {
  if (!videoId) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pro-community.vercel.app';
  const params = new URLSearchParams({
    rel: '0',
    enablejsapi: '1',
    origin,
    modestbranding: '1',
    playsinline: '1',
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function officialEmbedSrc(
  platform: EmbedPlatform,
  sourceUrl: string,
  youtubeVideoId?: string | null,
): string | null {
  if (platform === 'youtube') return youtubeEmbedSrc(youtubeVideoId);
  if (platform === 'tiktok') return tiktokEmbedSrc(sourceUrl);
  if (platform === 'instagram') return instagramEmbedSrc(sourceUrl);
  if (platform === 'facebook') return facebookEmbedSrc(sourceUrl);
  return pinterestEmbedSrc(sourceUrl);
}

export function officialEmbedHeight(platform: EmbedPlatform): number {
  if (platform === 'youtube') return 200;
  if (platform === 'pinterest') return 520;
  return 540;
}
