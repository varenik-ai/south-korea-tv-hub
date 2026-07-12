// korea-worker.js — CF Worker для South Korea TV Hub
// Клон структуры russia-worker.js (github.com/varenik-ai/russia-tv-hub)
// Деплой: cd ~/korea-worker && cp ~/south-korea-tv-hub/korea-worker.js src/index.js && npx wrangler deploy

const VERSION = '1.2.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

// Подтверждённые рабочие потоки — каждый проверен прямым HTTP-запросом
// (2026-07-12, второй проход): статус 200, Content-Type application/x-mpegURL /
// application/vnd.apple.mpegurl, непустое тело ответа. Источники —
// hujingguang/ChinaIPTV и iptv-org/iptv (оба открытые GitHub-плейлисты).
//
// Из ~60 проверенных кандидатов рабочими подтвердились эти 27. Источники
// третьего прохода — Free-TV/IPTV и MyeongJun-Park/iptv (открытые
// GitHub-плейлисты). Мёртвые/не проверяемые (KBS1, KBS2, KBS World +
// зеркала, YTN (оба порта), tvN, Channel A, TV Chosun/2, SBS KNN, CGNTV,
// BBS, MTN, Job Plus TV, WBS TV, National Assembly TV, MBC Busan, MBC
// Daegu, MBC Jeonju, MBC Gyeongnam, KNN, TJB, JTV, RTV и др.) сюда не
// включены — см. README_DEPLOY.md. GCN24 (지구촌복음방송) технически
// рабочий, но сознательно не включён — канал связан с организацией, чей
// основатель осуждён по уголовному делу.
const STREAMS = {
  // ── Международное вещание ─────────────────────────────────────────
  arirang:       'https://amdlive-ch01-ctnd-com.akamaized.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8',
  arirang_radio: 'http://amdlive-ch01.ctnd.com.edgesuite.net/arirang_3ch/smil:arirang_3ch.smil/playlist.m3u8',

  // ── EBS (образовательное вещание) ─────────────────────────────────
  ebs1:         'https://ebsonair.ebs.co.kr/ebs1familypc/familypc1m/playlist.m3u8',
  ebs2:         'https://ebsonair.ebs.co.kr/ebs2familypc/familypc1m/playlist.m3u8',
  ebs_plus1:    'https://ebsonair.ebs.co.kr/plus1familypc/familypc1m/playlist.m3u8',
  ebs_plus2:    'https://ebsonair.ebs.co.kr/plus2familypc/familypc1m/playlist.m3u8',
  ebs_kids:     'https://ebsonair.ebs.co.kr/ebsufamilypc/familypc1m/playlist.m3u8',
  ebs_english:  'https://ebsonair.ebs.co.kr/plus3familypc/familypc1m/playlist.m3u8',

  // ── Государственные / общественные ────────────────────────────────
  ktv:   'https://hlive.ktv.go.kr/live/klive_h.stream/playlist.m3u8',
  gugak: 'https://mgugaklive.nowcdn.co.kr/gugakvideo/gugakvideo.stream/playlist.m3u8',
  oun:   'https://live.knou.ac.kr/knou1/live1/playlist.m3u8',
  nbs:   'https://media.joycorp.co.kr:4443/live/ngrp:live_all/playlist.m3u8',
  tbs:   'https://cdntv.tbs.seoul.kr/tbs/tbs_tv_web.smil/playlist.m3u8',

  // ── Национальное вещание ──────────────────────────────────────────
  sbs: 'https://allanf181.github.io/adaptive-streams/streams/kr/SBSTV.m3u8',

  // ── Региональные MBC/SBS-филиалы ───────────────────────────────────
  mbc_jeju:      'https://wowza.jejumbc.com/live/tv_jejumbc/playlist.m3u8',
  mbc_chungbuk:  'http://211.33.246.4:32954/cj_live/myStream.sdp/playlist.m3u8',
  sbs_kbc:  'https://vod.ikbc.co.kr/KBCTV/tv/playlist.m3u8',
  sbs_ubc:  'https://stream.ubc.co.kr/hls/ubctvstream/index.m3u8',
  obs_gyeonggi: 'https://allanf181.github.io/adaptive-streams/streams/kr/OBSGyeonginTV.m3u8',

  // ── Религиозные / нишевые ──────────────────────────────────────────
  btn:    'https://btn.nowcdn.co.kr/btn/btnlive2m/playlist.m3u8',
  goodtv: 'http://mobliestream.c3tv.com:1935/live/goodtv.sdp/playlist.m3u8',
  abn:    'https://vod2.abn.co.kr/IPHONE/abn.m3u8',
  fgtv:   'https://fgtvlive.fgtv.com/smil:fgtv.smil/playlist.m3u8',
  rutc:   'http://d26sxnc75smwvh.cloudfront.net/livehttporigin/rutclive_720p2.stream/playlist.m3u8',

  // ── Прочие региональные/отраслевые ──────────────────────────────────
  nhtv:          'http://nonghyup.flive.skcdn.com/nonghyup/_definst_/nhlive/playlist.m3u8',
  mbc_chuncheon: 'https://stream.chmbc.co.kr/TV/myStream/playlist.m3u8',
  mbc_daejeon:   'https://ns1.tjmbc.co.kr/live/myStream.sdp/playlist.m3u8',
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // /stream?channel=NAME — получить прокси-поток для канала
  if (path === '/stream') {
    const channel = url.searchParams.get('channel');
    const streamUrl = STREAMS[channel];
    if (!streamUrl) {
      return new Response(JSON.stringify({ error: 'Channel not found', channel }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    return fetchM3u8(streamUrl, url.origin);
  }

  // /proxy?url=ENCODED_URL — прокси для плейлистов и сегментов
  if (path === '/proxy') {
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response('Missing url param', { status: 400, headers: CORS });
    }
    return proxyTarget(target, url.origin);
  }

  // /debug?url=ENCODED_URL — проверка доступности URL с CF Worker
  if (path === '/debug') {
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response(JSON.stringify({ channels: Object.keys(STREAMS), version: VERSION }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    try {
      const res = await fetch(target, { headers: { 'User-Agent': UA }, cf: { cacheEverything: false, cacheTtl: -1 } });
      const body = await res.text();
      return new Response(JSON.stringify({
        status: res.status,
        contentType: res.headers.get('Content-Type'),
        body: body.slice(0, 500),
      }), { headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  }

  // /version
  if (path === '/version') {
    return new Response(JSON.stringify({ version: VERSION, channels: Object.keys(STREAMS).length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(`Korea TV Worker v${VERSION}`, { headers: CORS });
}

// ── User-Agent для запросов к CDN ────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Разрешить относительный URL относительно базового ───────────────────────
function resolveUrl(base, relative) {
  if (!relative) return base;
  if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

// ── Определить базовый URL для m3u8-плейлиста (директория файла) ─────────────
function baseDir(url) {
  return url.substring(0, url.lastIndexOf('/') + 1);
}

// ── Перезаписать m3u8: все URL → /proxy?url=... ──────────────────────────────
function rewriteM3u8(content, sourceUrl, workerOrigin) {
  const base = baseDir(sourceUrl);
  const lines = content.split('\n');
  const out = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('#EXT-X-MEDIA') && line.includes('TYPE=SUBTITLES')) continue;

    if (line === '' || line.startsWith('#')) {
      let fixed = line.replace(/URI="([^"]+)"/g, (_, uri) => {
        const abs = resolveUrl(base, uri);
        return `URI="${workerOrigin}/proxy?url=${encodeURIComponent(abs)}"`;
      });
      if (fixed.startsWith('#EXT-X-STREAM-INF')) {
        fixed = fixed.replace(/,?SUBTITLES="[^"]*"/, '');
      }
      out.push(fixed);
    } else {
      const abs = resolveUrl(base, line);
      out.push(`${workerOrigin}/proxy?url=${encodeURIComponent(abs)}`);
    }
  }

  return out.join('\n');
}

// ── Получить мастер-плейлист и переписать для прокси ─────────────────────────
async function fetchM3u8(streamUrl, workerOrigin) {
  let res;
  try {
    res = await fetch(streamUrl, {
      headers: {
        'User-Agent': UA,
        'Referer': new URL(streamUrl).origin + '/',
        'Origin':  new URL(streamUrl).origin,
      },
      cf: { cacheEverything: false, cacheTtl: -1 },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, url: streamUrl }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (!res.ok) {
    return new Response(`Source returned ${res.status} for ${streamUrl}`, {
      status: res.status, headers: CORS,
    });
  }

  const body = await res.text();
  const rewritten = rewriteM3u8(body, streamUrl, workerOrigin);

  return new Response(rewritten, {
    headers: {
      ...CORS,
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache, no-store',
    },
  });
}

// ── Прокси для произвольного URL (суб-плейлист или сегмент) ──────────────────
async function proxyTarget(targetUrl, workerOrigin) {
  let res;
  try {
    res = await fetch(targetUrl, {
      headers: {
        'User-Agent': UA,
        'Referer':    new URL(targetUrl).origin + '/',
        'Origin':     new URL(targetUrl).origin,
      },
      cf: { cacheEverything: false, cacheTtl: -1 },
    });
  } catch (e) {
    return new Response(`Fetch error: ${e.message}`, { status: 502, headers: CORS });
  }

  if (!res.ok) {
    return new Response(`Upstream ${res.status}`, { status: res.status, headers: CORS });
  }

  const ct = (res.headers.get('Content-Type') || '').toLowerCase();
  const isTs = /\.ts([?#]|$)/.test(targetUrl) || ct.includes('video/') || ct.includes('audio/') || ct.includes('octet-stream');
  const isM3u8 = !isTs && (ct.includes('mpegurl') || ct.includes('m3u') ||
                 targetUrl.includes('.m3u8') || targetUrl.includes('playlist') ||
                 targetUrl.includes('chunklist') || targetUrl.includes('variant'));

  if (isM3u8) {
    const body = await res.text();
    const rewritten = rewriteM3u8(body, targetUrl, workerOrigin);
    return new Response(rewritten, {
      headers: {
        ...CORS,
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache, no-store',
      },
    });
  }

  return new Response(res.body, {
    status: res.status,
    headers: {
      ...CORS,
      'Content-Type': ct || 'video/MP2T',
    },
  });
}
