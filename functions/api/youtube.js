// Cloudflare Pages Function — POST /api/youtube
// Body: { url: string }
// Returns: { videoId, title, author, thumbnail, transcript }
//
// Title + author come from YouTube's public oEmbed endpoint (no key needed).
// Transcript is best-effort — we scrape the watch-page HTML for a
// captionTracks URL and fetch the timedtext XML. If anything fails we
// return an empty transcript and the client falls back to title-only
// flashcard generation (it already handles that gracefully).

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function extractVideoId(input) {
  const m = String(input || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function fetchTitle(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!res.ok) return { title: 'YouTube Video', author: '' };
    const j = await res.json();
    return { title: j.title || 'YouTube Video', author: j.author_name || '' };
  } catch (_) {
    return { title: 'YouTube Video', author: '' };
  }
}

// Best-effort transcript scrape. YouTube renders an `ytInitialPlayerResponse`
// JSON blob into the watch-page HTML containing captionTracks with baseUrls.
// We grab the first available captions URL and fetch its timedtext XML.
async function fetchTranscript(videoId) {
  try {
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        // Looking like a real browser improves the odds of getting captions in the payload.
        'User-Agent':       'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language':  'en-US,en;q=0.9',
      },
    });
    if (!watchRes.ok) return '';
    const html = await watchRes.text();

    // Find the JSON blob and pull out the first captionTrack baseUrl.
    // The blob is large; we use a focused regex to avoid parsing all of it.
    const trackMatch = html.match(/"captionTracks":\[\{"baseUrl":"([^"]+)"/);
    if (!trackMatch) return '';

    // The URL is JSON-escaped — unescape the slashes and ampersands.
    const captionUrl = trackMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');

    const xmlRes = await fetch(captionUrl);
    if (!xmlRes.ok) return '';
    const xml = await xmlRes.text();

    // Each <text> node contains a transcript segment. Strip tags, decode
    // basic HTML entities, collapse whitespace.
    const segments = [];
    const segRe = /<text[^>]*>([\s\S]*?)<\/text>/g;
    let m;
    while ((m = segRe.exec(xml)) !== null) {
      const seg = m[1]
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, '')        // strip nested tags
        .replace(/\s+/g, ' ').trim();
      if (seg) segments.push(seg);
    }
    let text = segments.join(' ');
    // Token-limit guard — same 12 000 char cap as the old server
    if (text.length > 12000) text = text.slice(0, 12000) + '…';
    return text;
  } catch (_) {
    return '';
  }
}

export async function onRequestPost(context) {
  const { request } = context;

  let body;
  try { body = await request.json(); }
  catch (_) { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

  const videoId = extractVideoId(body.url);
  if (!videoId) return jsonResponse({ error: 'Invalid YouTube URL' }, 400);

  // Title and transcript run in parallel
  const [info, transcript] = await Promise.all([
    fetchTitle(videoId),
    fetchTranscript(videoId),
  ]);

  return jsonResponse({
    videoId,
    title:      info.title,
    author:     info.author,
    thumbnail:  `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    transcript,
  });
}
