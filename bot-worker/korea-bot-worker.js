// korea-bot-worker.js — Cloudflare Worker, обрабатывает Telegram webhook (@KoreaTVHub_bot).
//
// Все секреты хранятся в настройках воркера, НЕ в коде (репозиторий публичный):
//   BOT_TOKEN       — токен бота из @BotFather
//   WEBHOOK_SECRET  — любая случайная строка (A-Z, a-z, 0-9, _ и -, до 256 символов);
//                     Telegram присылает её в заголовке X-Telegram-Bot-Api-Secret-Token,
//                     и она же нужна для служебных адресов /set-webhook и /webhook-info
//   ADMIN_IDS       — Telegram user id через запятую: кому разрешена команда /post
//
// Задать: npx wrangler secret put BOT_TOKEN   (и так же остальные)
//   или в Cloudflare dashboard → Workers → korea-bot-worker → Settings → Variables and Secrets.
// После деплоя один раз открыть: https://<worker-url>/set-webhook?key=<WEBHOOK_SECRET>

const CHANNEL  = -1003991519999;                                   // Korea TV Hub 🇰🇷 | Live Channels
const APP_URL  = 'https://t.me/KoreaTVHub_bot/koreatv';
const WEB_URL  = 'https://varenik-ai.github.io/south-korea-tv-hub/?v=1';
const SITE_URL = 'https://korea-tv.uk/';

const CHANNEL_COUNT = 31;

const greetings = {
  ko: (name) => `🇰🇷 안녕하세요, ${name}님!

📺 *KOREA·TV — 텔레그램에서 실시간 채널 ${CHANNEL_COUNT}개*

한국 방송을 온라인으로 시청하세요 — 무료, VPN 불필요, 가입 불필요, 24/7.

🌏 *국제:* 아리랑TV, 아리랑라디오
📚 *EBS:* 1TV, 2TV, 플러스1, 플러스2, 키즈, 잉글리시
🏛️ *공영·정책:* KTV, 국악방송, 방송대학TV, 농수산방송
📍 *지역:* 제주MBC, 광주KBC, 울산UBC, 교통방송TBS, 춘천MBC, 대전MBC, NHTV, 남인천방송, 지방자치TV, 금강방송
📈 *경제·쇼핑:* 한국경제TV, 매일경제TV, KT알파쇼핑
⛪ *종교·기타:* BTN, ABN, FGTV, RUTC
🎵 *음악·라디오:* TBS eFM, TBS FM

✅ HD · iOS · Android · Desktop

ℹ️ 실시간으로 확인된 채널만 등록되어 있습니다.`,

  en: (name) => `🇰🇷 Hello, ${name}!

📺 *KOREA·TV — ${CHANNEL_COUNT} live channels on Telegram*

Watch South Korean television online — free, no VPN, no registration, 24/7.

🌏 *International:* Arirang TV, Arirang Radio
📚 *EBS:* 1TV, 2TV, Plus1, Plus2, Kids, English
🏛️ *Public/Culture:* KTV, Gugak TV, OUN, NBS
📍 *Regional:* MBC Jeju, SBS KBC, SBS UBC, TBS Seoul, MBC Chuncheon, MBC Daejeon, NHTV, NIB, JJCTV, KCN
📈 *Business/Shopping:* WOWTV, MK Money, KT Alpha Shopping
⛪ *Religious/Other:* BTN, ABN, FGTV, RUTC
🎵 *Music/Radio:* TBS eFM, TBS FM

✅ HD · iOS · Android · Desktop

ℹ️ Only channels verified live are included.`,
};

const btnWatch = {
  ko: '📺 Korea TV Live 열기',
  en: '📺 Open Korea TV Live',
};

const btnBrowser = {
  ko: '🌐 브라우저에서 열기',
  en: '🌐 Open in browser',
};

const btnSite = {
  ko: '📰 채널 정보 · korea-tv.uk',
  en: '📰 Channel guide · korea-tv.uk',
};

const POST_TEXT = `🇰🇷 *KOREA·TV — 실시간 채널 ${CHANNEL_COUNT}개* 🔴

한국 방송을 텔레그램에서 무료로 시청하세요 — *VPN 불필요, 가입 불필요, 24/7.*

━━━━━━━━━━━━━━━━━━━━
🌏 *국제* — Arirang TV · Arirang Radio
📚 *EBS* — 1TV · 2TV · Plus1 · Plus2 · Kids · English
🏛️ *공영·정책* — KTV · 국악방송 · 방송대학TV · 농수산방송
📍 *지역* — 제주MBC · 광주KBC · 울산UBC · 교통방송TBS · 춘천MBC · 대전MBC · NHTV · 남인천방송 · 지방자치TV · 금강방송
📈 *경제·쇼핑* — 한국경제TV · 매일경제TV · KT알파쇼핑
⛪ *종교·기타* — BTN · ABN · FGTV · RUTC
🎵 *음악·라디오* — TBS eFM · TBS FM
━━━━━━━━━━━━━━━━━━━━

✅ HD · iOS · Android · Desktop

👇 *아래 버튼을 눌러 채널을 선택하세요*

━━━━━━━━━━━━━━━━━━━━

🇬🇧 *KOREA·TV — ${CHANNEL_COUNT} live channels* 🔴

Watch South Korean TV free on Telegram — *no VPN, no registration, 24/7.*

🌏 *International* — Arirang TV, Arirang Radio
📚 *EBS* — 1TV, 2TV, Plus1, Plus2, Kids, English
🏛️ *Public* — KTV, Gugak TV, OUN, NBS
📍 *Regional* — MBC Jeju, SBS KBC, SBS UBC, TBS Seoul, MBC Chuncheon, MBC Daejeon, NHTV, NIB, JJCTV, KCN
📈 *Business/Shopping* — WOWTV, MK Money, KT Alpha Shopping
⛪ *Religious/Other* — BTN, ABN, FGTV, RUTC
🎵 *Music/Radio* — TBS eFM, TBS FM

👇 *Tap the button below to pick a channel*`;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Секреты в синтаксисе Service Worker доступны как глобальные переменные
// (через globalThis они не видны, поэтому обращаемся по имени).
function secret(name) {
  switch (name) {
    case 'BOT_TOKEN':      return typeof BOT_TOKEN === 'string' ? BOT_TOKEN : '';
    case 'WEBHOOK_SECRET': return typeof WEBHOOK_SECRET === 'string' ? WEBHOOK_SECRET : '';
    case 'ADMIN_IDS':      return typeof ADMIN_IDS === 'string' ? ADMIN_IDS : '';
    default: return '';
  }
}

function adminIds() {
  return secret('ADMIN_IDS').split(',').map(s => s.trim()).filter(Boolean);
}

// Сравнение строк за постоянное время, чтобы не подбирали секрет по таймингу.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

async function tg(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${secret('BOT_TOKEN')}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const whSecret = secret('WEBHOOK_SECRET');

  if (!secret('BOT_TOKEN') || !whSecret) {
    return json({ ok: false, error: 'BOT_TOKEN / WEBHOOK_SECRET are not configured' }, 500);
  }

  // Служебные адреса — только с ?key=<WEBHOOK_SECRET>.
  if (url.pathname === '/set-webhook' || url.pathname === '/webhook-info') {
    if (!safeEqual(url.searchParams.get('key') || '', whSecret)) {
      return new Response('Forbidden', { status: 403 });
    }
    const r = url.pathname === '/set-webhook'
      ? await tg('setWebhook', {
          url: url.origin + '/',
          secret_token: whSecret,
          allowed_updates: ['message'],
          drop_pending_updates: true,
        })
      : await tg('getWebhookInfo', {});
    return json(r);
  }

  if (request.method !== 'POST') {
    return new Response('Korea TV Bot Worker OK');
  }

  // Принимаем апдейты только от Telegram (он присылает secret_token в заголовке).
  if (!safeEqual(request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '', whSecret)) {
    return new Response('Forbidden', { status: 403 });
  }

  let update;
  try {
    update = await request.json();
  } catch (e) {
    return new Response('bad request', { status: 400 });
  }

  const msg = update.message;
  if (!msg || !msg.text) return new Response('ok');

  const text = msg.text.trim();

  if (text.startsWith('/start')) {
    const name = msg.from.first_name || '';
    const lang = (msg.from.language_code || 'ko').split('-')[0];
    const greet = greetings[lang] || greetings.ko;
    await tg('sendMessage', {
      chat_id: msg.chat.id,
      text: greet(name),
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: btnWatch[lang] || btnWatch.ko, web_app: { url: WEB_URL } }],
          [{ text: btnBrowser[lang] || btnBrowser.ko, url: WEB_URL }],
          [{ text: btnSite[lang] || btnSite.ko, url: SITE_URL }],
        ],
      },
    });
  } else if (text === '/post' || text.startsWith('/post@')) {
    // Публиковать в канал могут только админы из ADMIN_IDS, и только в личке с ботом.
    if (msg.chat.type !== 'private' || !adminIds().includes(String(msg.from.id))) {
      return new Response('ok');
    }
    try {
      const post = await tg('sendMessage', {
        chat_id: CHANNEL,
        text: POST_TEXT,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [{ text: '📺 Open Korea TV Live', url: APP_URL }],
          [{ text: '📰 채널 가이드 · Guide · korea-tv.uk', url: SITE_URL }],
        ] },
      });
      if (post.ok) {
        await tg('pinChatMessage', { chat_id: CHANNEL, message_id: post.result.message_id });
        await tg('sendMessage', { chat_id: msg.chat.id, text: '✅ Пост опубликован и закреплён!' });
      } else {
        await tg('sendMessage', { chat_id: msg.chat.id, text: '❌ Ошибка: ' + (post.description || 'unknown') });
      }
    } catch (e) {
      await tg('sendMessage', { chat_id: msg.chat.id, text: '❌ Ошибка: ' + e.message });
    }
  }

  return new Response('ok');
}
