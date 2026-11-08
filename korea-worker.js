// korea-worker.js — CF Worker для South Korea TV Hub
// Клон структуры russia-worker.js (github.com/varenik-ai/russia-tv-hub)
// Деплой: cd ~/korea-worker && cp ~/south-korea-tv-hub/korea-worker.js src/index.js && npx wrangler deploy

const VERSION = '1.6.0';

// ── Защита прокси ────────────────────────────────────────────────────────────
// Секрет PROXY_SECRET задаётся в настройках воркера (не в коде, репозиторий публичный):
//   npx wrangler secret put PROXY_SECRET
// Каждый адрес, который воркер вставляет в плейлист, подписывается HMAC-SHA256.
// /proxy принимает только подписанные адреса, поэтому через воркер нельзя
// скачать произвольный URL. /debug?url=... требует ?key=<PROXY_SECRET>.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

// Подтверждённые рабочие потоки — каждый проверен прямым HTTP-запросом
// (2026-07-12, четвёртый проход): статус 200, Content-Type application/x-mpegURL /
// application/vnd.apple.mpegurl, непустое тело ответа. Источники —
// hujingguang/ChinaIPTV, iptv-org/iptv, Free-TV/IPTV, MyeongJun-Park/iptv
// (все открытые GitHub-плейлисты).
//
// Из ~100 проверенных кандидатов рабочими подтвердились 36; 2026-11-08 убраны
// переставшие отвечать MBC Chungbuk (403), GoodTV (522) и National Assembly TV (404), а также SBS и OBS Gyeongin
// (зеркало allanf181 ссылается на seezntv.com, домен больше не резолвится — CF error 1016). Осталось 31. GCN (по
// просьбе пользователя) удалён — легитимность организации-владельца
// сомнительна. SBS/OBS через community-зеркало allanf181/adaptive-streams —
// см. README_DEPLOY.md для деталей. Музыкальные каналы: попытка найти
// прямые K-pop видео-каналы (Mnet, 1theK, SBS KPOP и т.д.) не увенчалась
// успехом — единственный найденный источник (ythls.armelin.one,
// YouTube→HLS прокси) не прошёл верификацию: он возвращает одинаковый
// "успешный" ответ даже для заведомо несуществующего ID канала, то есть
// не позволяет отличить рабочий поток от ошибки. Вместо этого добавлены
// TBS eFM и TBS FM — официальные радиоканалы tbs.seoul.kr с музыкальным
// вещанием (тот же домен, что и уже проверенный TBS TV). Мёртвые/не
// проверяемые (KBS1, KBS2, KBS World + зеркала, YTN (оба порта), tvN,
// Channel A, TV Chosun/2, SBS KNN, CGNTV, BBS, CTS, MTN, Job Plus TV, WBS
// TV, MBC Busan, MBC Daegu, MBC Jeonju, MBC Gyeongnam, KNN, TJB, JTV, RTV,
// HCN Busan, KMTV, SBS/MBC радио (mbc.co.kr, streamguys1.com) и др.) сюда
// не включены — см. README_DEPLOY.md.
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

  // ── Региональные MBC/SBS-филиалы ───────────────────────────────────
  mbc_jeju:      'https://wowza.jejumbc.com/live/tv_jejumbc/playlist.m3u8',
  sbs_kbc:  'https://vod.ikbc.co.kr/KBCTV/tv/playlist.m3u8',
  sbs_ubc:  'https://stream.ubc.co.kr/hls/ubctvstream/index.m3u8',

  // ── Религиозные / нишевые ──────────────────────────────────────────
  btn:    'https://btn.nowcdn.co.kr/btn/btnlive2m/playlist.m3u8',
  abn:    'https://vod2.abn.co.kr/IPHONE/abn.m3u8',
  fgtv:   'https://fgtvlive.fgtv.com/smil:fgtv.smil/playlist.m3u8',
  rutc:   'https://d26sxnc75smwvh.cloudfront.net/livehttporigin/rutclive_720p2.stream/playlist.m3u8',

  // ── Прочие региональные/отраслевые ──────────────────────────────────
  nhtv:          'http://nonghyup.flive.skcdn.com/nonghyup/_definst_/nhlive/playlist.m3u8',
  mbc_chuncheon: 'https://stream.chmbc.co.kr/TV/myStream/playlist.m3u8',
  mbc_daejeon:   'https://ns1.tjmbc.co.kr/live/myStream.sdp/playlist.m3u8',
  nib:           'http://stream.nibtv.co.kr:1935/live/nib/playlist.m3u8',
  jjctv:         'https://jjctv.ecn.cdn.infralab.net/jjctv/live/playlist.m3u8',
  kcn:           'http://62db982017b54.streamlock.net:1935/live/_definst_/tv.stream/playlist.m3u8',

  // ── Экономические / деловые ────────────────────────────────────────
  wowtv:  'https://cdnmlive.wowtv.co.kr/wowmo/livestream/playlist.m3u8',
  mkmoney:'http://mmoney.flive.skcdn.com/mmoneymobile/smil:money.smil/playlist.m3u8',

  // ── Шопинг ────────────────────────────────────────────────────────
  ktalpha: 'https://livetv.kshop.co.kr/klive/_definst_/smil:klive.smil/playlist.m3u8',

  // ── Музыка / радио ────────────────────────────────────────────────
  tbs_efm: 'https://cdntv.tbs.seoul.kr/tbs/tbs_efm_web.smil/playlist.m3u8',
  tbs_fm:  'https://cdntv.tbs.seoul.kr/tbs/tbs_fm_web.smil/playlist.m3u8',
  // ── КАНДИДАТЫ (временно, проверка через Cloudflare; на сайте/в мини-аппе/в боте не показываются) ──
  // Источник: таблица «корейские каналы.xlsx» (2026-11-09). После проверки остаются только прошедшие.
  cand_tvchosun:      'http://onair.cdn.tvchosun.com/origin1/_definst_/tvchosun_s1/playlist.m3u8',
  cand_tvchosun2:     'http://onair2.cdn.tvchosun.com/origin2/_definst_/tvchosun_s3/playlist.m3u8',
  cand_channela:      'http://channelalive.ktcdn.co.kr/chalivepc/_definst_/atv2/playlist.m3u8',
  cand_mbc_andong:    'http://andong.webcasting.co.kr/live/mbc/playlist.m3u8',
  cand_mbc_busan:     'https://stream.bsmbc.com/livetv/BusanMBC_TV_onairstream/playlist.m3u8',
  cand_mbc_daegu:     'https://5ee1ec6f32118.streamlock.net/live/livetv/playlist.m3u8',
  cand_mbc_gangwon:   'http://123.254.93.7:1935/tvlive/livestream2/playlist.m3u8',
  cand_mbc_gwangju:   'https://media.kjmbc.co.kr/hls/live/stream/playlist.m3u8',
  cand_mbc_gyeongnam: 'https://624a79c87201d.streamlock.net/MBCTV/TV1.stream/playlist.m3u8',
  cand_mbc_jeonju:    'https://5ee9633b25727.streamlock.net/jmbc_tv/_definst_/jmbc_tv.stream/playlist.m3u8',
  cand_mbc_mokpo:     'http://vod.mpmbc.co.kr:1935/live/encoder-tv/playlist.m3u8',
  cand_mbc_yeosu:     'https://5c3639aa99149.streamlock.net/live_TV/tv/playlist.m3u8',
  cand_sbs_cjb:       'http://1.222.207.80:1935/live/cjbtv/playlist.m3u8',
  cand_sbs_g1:        'http://61.82.49.4:1935/live/_definst_/tv.stream/playlist.m3u8',
  cand_sbs_jibs:      'http://123.140.197.22/stream/1/play.m3u8',
  cand_sbs_knn:       'https://stream1.knn.co.kr/hls/9ly4534y7dm2xfa123r2_tv/index.m3u8',
  cand_sbs_tbc:       'http://203.251.91.122:1935/on-air-Backup/tv/playlist.m3u8',
  cand_kctv:          'http://119.77.96.184:1935/chn05/chn05/playlist.m3u8',
  cand_jobplus:       'https://live.jobplustv.or.kr/live/wowtvlive1.sdp/playlist.m3u8',
  cand_gugbang:       'http://mediaworks.dema.mil.kr:1935/live_edge/cudo.sdp/playlist.m3u8',
  cand_bbs:           'http://bbstv.clouducs.com:1935/bbstv-live/livestream/playlist.m3u8',
  cand_cgntv:         'https://du35ivadp6cxj.cloudfront.net/out/v1/81781d23cbbf490990b2aa9181d4ce19/CGNWebLiveKR.m3u8',
  cand_wbs:           'http://157.245.196.186/live/livestream.m3u8',
  cand_rtv:           'https://rtv-stream2.a04f922e9e85c8d25ebfeae3dfd22a67.com/rtv/rtv.m3u8',
  cand_cjonstyle:     'https://live-ch1.cjonstyle.net/cjmalllive/stream2/playlist.m3u8',
  cand_cjonstyle_plus:'https://live-ch2.cjonstyle.net/cjosplus/live2/playlist.m3u8',
  cand_gsshop:        'https://gstv-gsshop.gsshop.com/gsshop_hd/gsshop_hd.stream/playlist.m3u8',
  cand_hyundai:       'https://livejj.hyundaihmall.com:8443/live/ngrp:hmall.stream_pc/playlist.m3u8',
  cand_lotte:         'https://pchlslivesw.lotteimall.com/live/livestream/lotteimalllive_mp4.m3u8',
  cand_nsshop:        'https://livestream.nsmall.com/IPHONE/nsmallMobile.m3u8',
  cand_shinsegae:     'https://liveout.catenoid.net/live-02-shinsegaetvshopping/shinsegaetvshopping_720p/playlist.m3u8',
};

// ── Гибридный режим (v1.6.0) ────────────────────────────────────────────────
// Как у Russia TV («только плейлисты»): у каналов из DIRECT плейлисты идут через
// воркер, а видеосегменты (.ts/.aac/.mp4/.m4s) браузер берёт прямо у источника.
// Условие для DIRECT: плейлист и сегменты по https с Access-Control-Allow-Origin
// (проверено 2026-11-08). Остальные каналы (источник только по http, браузер на
// https-странице такие сегменты заблокирует) идут через подписанный /proxy, как раньше.
// Если в плейлисте DIRECT-канала сегмент окажется по http, он тоже пойдёт через /proxy.
const DIRECT = new Set([
  'arirang', 'ebs1', 'ebs2', 'ebs_plus1', 'ebs_plus2', 'ebs_kids', 'ebs_english',
  'ktv', 'gugak', 'oun', 'nbs', 'tbs', 'tbs_efm', 'tbs_fm',
  'mbc_jeju', 'mbc_chuncheon', 'mbc_daejeon', 'sbs_kbc',
  'btn', 'abn', 'fgtv', 'rutc', 'jjctv', 'wowtv', 'ktalpha',
]);

function isSegment(u) {
  return /\.(ts|aac|mp4|m4s|fmp4)([?#]|$)/i.test(u);
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // /stream-q?channel=NAME&q=КБИТ — мастер, урезанный до одного уровня, ближайшего к q
  // (выбор качества в нативном плеере iPhone/iPad, как /stream-q у Russia TV)
  if (path === '/stream-q') {
    const inner = await handleRequest(new Request(url.origin + '/stream?channel=' + encodeURIComponent(url.searchParams.get('channel') || '')));
    if (!inner.ok) return inner;
    const text = await inner.text();
    const want = (parseInt(url.searchParams.get('q') || '0', 10) || 0) * 1e3;
    const rows = text.split('\n');
    const pairs = [];
    const head = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].startsWith('#EXT-X-STREAM-INF')) { pairs.push([rows[i], rows[i + 1] || '']); i++; }
      else if (!pairs.length && rows[i].trim()) head.push(rows[i]);
    }
    const m3u8Headers = { ...CORS, 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' };
    if (!want || !pairs.length) return new Response(text, { headers: m3u8Headers });
    let best = pairs[0], bestD = Infinity;
    for (const p of pairs) {
      const m = p[0].match(/BANDWIDTH=(\d+)/);
      const d = Math.abs((m ? +m[1] : 0) - want);
      if (d < bestD) { bestD = d; best = p; }
    }
    return new Response(head.join('\n') + '\n' + best[0] + '\n' + best[1] + '\n', { headers: m3u8Headers });
  }

  // /stream?channel=NAME — получить поток канала
  if (path === '/stream') {
    const channel = url.searchParams.get('channel');
    const streamUrl = STREAMS[channel];
    if (!streamUrl) {
      return new Response(JSON.stringify({ error: 'Channel not found', channel }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (!proxySecret()) {
      return new Response('Proxy is not configured', { status: 503, headers: CORS });
    }
    return fetchM3u8(streamUrl, url.origin, DIRECT.has(channel));
  }

  // /proxy?url=ENCODED_URL — прокси для плейлистов и сегментов
  if (path === '/proxy') {
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response('Missing url param', { status: 400, headers: CORS });
    }
    if (!proxySecret()) {
      return new Response('Proxy is not configured', { status: 503, headers: CORS });
    }
    const direct = url.searchParams.get('d') === '1';
    if (!/^https?:\/\//i.test(target) || !safeEqual(url.searchParams.get('s') || '', await sign(direct ? 'd:' + target : target))) {
      return new Response('Forbidden', { status: 403, headers: CORS });
    }
    return proxyTarget(target, url.origin, direct);
  }

  // /debug?url=ENCODED_URL — проверка доступности URL с CF Worker
  if (path === '/debug') {
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response(JSON.stringify({ channels: Object.keys(STREAMS), version: VERSION }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (!proxySecret() || !safeEqual(url.searchParams.get('key') || '', proxySecret())) {
      return new Response('Forbidden', { status: 403, headers: CORS });
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
    return new Response(JSON.stringify({ version: VERSION, channels: Object.keys(STREAMS).length, direct: DIRECT.size, mode: 'hybrid' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(`Korea TV Worker v${VERSION}`, { headers: CORS });
}

// ── User-Agent для запросов к CDN ────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── HMAC-подпись адресов для /proxy ─────────────────────────────────────────
let _keyPromise = null;
function proxySecret() {
  return typeof PROXY_SECRET === 'string' ? PROXY_SECRET : '';
}
function hmacKey() {
  if (!_keyPromise) {
    _keyPromise = crypto.subtle.importKey(
      'raw', new TextEncoder().encode(proxySecret()),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
  }
  return _keyPromise;
}
async function sign(target) {
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(), new TextEncoder().encode(target));
  const bytes = new Uint8Array(mac).slice(0, 16);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
// direct=true помечает вложенный плейлист DIRECT-канала: при его переписывании
// сегменты тоже пойдут напрямую. Флаг входит в подпись, подменить его нельзя.
async function proxyLink(abs, workerOrigin, direct) {
  if (direct) return `${workerOrigin}/proxy?url=${encodeURIComponent(abs)}&d=1&s=${await sign('d:' + abs)}`;
  return `${workerOrigin}/proxy?url=${encodeURIComponent(abs)}&s=${await sign(abs)}`;
}
// Сегмент отдаём прямой ссылкой, только если канал в DIRECT и ссылка https.
function directSegment(abs, direct) {
  return direct && abs.startsWith('https://') && isSegment(abs);
}

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
async function rewriteM3u8(content, sourceUrl, workerOrigin, direct) {
  const base = baseDir(sourceUrl);
  const lines = content.split('\n');
  const out = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('#EXT-X-MEDIA') && line.includes('TYPE=SUBTITLES')) continue;

    if (line === '' || line.startsWith('#')) {
      let fixed = line;
      for (const m of line.matchAll(/URI="([^"]+)"/g)) {
        const abs = resolveUrl(base, m[1]);
        fixed = fixed.replace(m[0], directSegment(abs, direct) ? `URI="${abs}"` : `URI="${await proxyLink(abs, workerOrigin, direct)}"`);
      }
      if (fixed.startsWith('#EXT-X-STREAM-INF')) {
        fixed = fixed.replace(/,?SUBTITLES="[^"]*"/, '');
      }
      out.push(fixed);
    } else {
      const abs = resolveUrl(base, line);
      out.push(directSegment(abs, direct) ? abs : await proxyLink(abs, workerOrigin, direct));
    }
  }

  return out.join('\n');
}

// ── Получить мастер-плейлист и переписать для прокси ─────────────────────────
async function fetchM3u8(streamUrl, workerOrigin, direct) {
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
  const rewritten = await rewriteM3u8(body, res.url || streamUrl, workerOrigin, direct);

  return new Response(rewritten, {
    headers: {
      ...CORS,
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache, no-store',
    },
  });
}

// ── Прокси для произвольного URL (суб-плейлист или сегмент) ──────────────────
async function proxyTarget(targetUrl, workerOrigin, direct) {
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
    const rewritten = await rewriteM3u8(body, res.url || targetUrl, workerOrigin, direct);
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
