// korea-bot-worker.js — Cloudflare Worker, обрабатывает Telegram webhook вместо nohup node bot.js.
// Работает 24/7 на инфраструктуре Cloudflare, полностью независимо от локального компьютера.
// После деплоя один раз открыть https://<worker-url>/set-webhook для регистрации webhook.

const TOKEN   = '8917618978:AAHm5EtmOHlbPbZixKnKxUmK-3Sv5P8Z8AY'; // @KoreaTVHub_bot
const CHANNEL = -1003991519999;                                   // Korea TV Hub 🇰🇷 | Live Channels
const APP_URL = 'https://t.me/KoreaTVHub_bot/koreatv';
const WEB_URL = 'https://varenik-ai.github.io/south-korea-tv-hub/?v=1';

const API = `https://api.telegram.org/bot${TOKEN}`;

const greetings = {
  ko: (name) => `🇰🇷 안녕하세요, ${name}님!

📺 *KOREA·TV — 텔레그램에서 실시간 채널 36개*

한국 방송을 온라인으로 시청하세요 — 무료, VPN 불필요, 가입 불필요, 24/7.

🌏 *국제:* 아리랑TV, 아리랑라디오
📡 *지상파:* SBS
📚 *EBS:* 1TV, 2TV, 플러스1, 플러스2, 키즈, 잉글리시
🏛️ *공영·정책:* KTV, 국악방송, 방송대학TV, 농수산방송
📍 *지역:* 제주MBC, 광주KBC, 울산UBC, 교통방송TBS, 춘천MBC, 대전MBC, 충북MBC, OBS경인TV, NHTV, 남인천방송, 지방자치TV, 금강방송
🏛️ *국가기관:* 국회방송
📈 *경제·쇼핑:* 한국경제TV, 매일경제TV, KT알파쇼핑
⛪ *종교·기타:* BTN, GoodTV, ABN, FGTV, RUTC
🎵 *음악·라디오:* TBS eFM, TBS FM

✅ HD · iOS · Android · Desktop

ℹ️ 실시간으로 확인된 채널만 등록되어 있습니다.`,

  en: (name) => `🇰🇷 Hello, ${name}!

📺 *KOREA·TV — 36 live channels on Telegram*

Watch South Korean television online — free, no VPN, no registration, 24/7.

🌏 *International:* Arirang TV, Arirang Radio
📡 *National:* SBS
📚 *EBS:* 1TV, 2TV, Plus1, Plus2, Kids, English
🏛️ *Public/Culture:* KTV, Gugak TV, OUN, NBS
📍 *Regional:* MBC Jeju, SBS KBC, SBS UBC, TBS Seoul, MBC Chuncheon, MBC Daejeon, MBC Chungbuk, OBS Gyeonggi, NHTV, NIB, JJCTV, KCN
🏛️ *Government:* National Assembly TV
📈 *Business/Shopping:* WOWTV, MK Money, KT Alpha Shopping
⛪ *Religious/Other:* BTN, GoodTV, ABN, FGTV, RUTC
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

const POST_TEXT = `🇰🇷 *KOREA·TV — 실시간 채널 36개* 🔴

한국 방송을 텔레그램에서 무료로 시청하세요 — *VPN 불필요, 가입 불필요, 24/7.*

━━━━━━━━━━━━━━━━━━━━
🌏 *국제* — Arirang TV · Arirang Radio
📡 *지상파* — SBS
📚 *EBS* — 1TV · 2TV · Plus1 · Plus2 · Kids · English
🏛️ *공영·정책* — KTV · 국악방송 · 방송대학TV · 농수산방송
📍 *지역* — 제주MBC · 광주KBC · 울산UBC · 교통방송TBS · 춘천MBC · 대전MBC · 충북MBC · OBS경인TV · NHTV · 남인천방송 · 지방자치TV · 금강방송
🏛️ *국가기관* — 국회방송
📈 *경제·쇼핑* — 한국경제TV · 매일경제TV · KT알파쇼핑
⛪ *종교·기타* — BTN · GoodTV · ABN · FGTV · RUTC
🎵 *음악·라디오* — TBS eFM · TBS FM
━━━━━━━━━━━━━━━━━━━━

✅ HD · iOS · Android · Desktop

👇 *아래 버튼을 눌러 채널을 선택하세요*

━━━━━━━━━━━━━━━━━━━━

🇬🇧 *KOREA·TV — 36 live channels* 🔴

Watch South Korean TV free on Telegram — *no VPN, no registration, 24/7.*

🌏 *International* — Arirang TV, Arirang Radio
📡 *National* — SBS
📚 *EBS* — 1TV, 2TV, Plus1, Plus2, Kids, English
🏛️ *Public* — KTV, Gugak TV, OUN, NBS
📍 *Regional* — MBC Jeju, SBS KBC, SBS UBC, TBS Seoul, MBC Chuncheon, MBC Daejeon, MBC Chungbuk, OBS Gyeonggi, NHTV, NIB, JJCTV, KCN
🏛️ *Government* — National Assembly TV
📈 *Business/Shopping* — WOWTV, MK Money, KT Alpha Shopping
⛪ *Religious/Other* — BTN, GoodTV, ABN, FGTV, RUTC
🎵 *Music/Radio* — TBS eFM, TBS FM

👇 *Tap the button below to pick a channel*`;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function tg(method, payload) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === '/set-webhook') {
    const r = await tg('setWebhook', { url: url.origin });
    return new Response(JSON.stringify(r), { headers: { 'Content-Type': 'application/json' } });
  }
  if (url.pathname === '/webhook-info') {
    const r = await tg('getWebhookInfo', {});
    return new Response(JSON.stringify(r), { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method !== 'POST') {
    return new Response('Korea TV Bot Worker OK');
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
        ],
      },
    });
  } else if (text === '/post') {
    try {
      const post = await tg('sendMessage', {
        chat_id: CHANNEL,
        text: POST_TEXT,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '📺 Open Korea TV Live', url: APP_URL }]] },
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
