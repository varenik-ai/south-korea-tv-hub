// korea-bot-worker.js — бот @KoreaTVHub_bot на Cloudflare Workers (webhook), по образцу russia-bot-worker.js (Russia TV, BOT.md).
//
// Все секреты хранятся в настройках воркера, НЕ в коде (репозиторий публичный):
//   BOT_TOKEN       — токен бота из @BotFather
//   WEBHOOK_SECRET  — случайная строка (A-Z, a-z, 0-9, _ и -, до 256 символов);
//                     Telegram присылает её в заголовке X-Telegram-Bot-Api-Secret-Token,
//                     она же — ключ для служебных адресов /setup, /set-webhook, /webhook-info
//   ADMIN_IDS       — Telegram user id через запятую: кому разрешены /post и /fixpost
// Cloudflare dashboard → Workers → korea-bot-worker → Settings → Variables and Secrets.
//
// После деплоя один раз открыть: https://korea-bot-worker.dyaltd.workers.dev/setup?key=<WEBHOOK_SECRET>
// — воркер сам зарегистрирует webhook, команды, описание (ko/en) и кнопку меню.
// Тексты совпадают с bot.js (запасной вариант на polling; НЕ запускать одновременно с воркером).

const CHANNEL  = -1003991519999;                                   // Korea TV Hub 🇰🇷 | Live Channels
const BOT_USERNAME = 'KoreaTVHub_bot';
const APP_URL  = 'https://t.me/KoreaTVHub_bot/koreatv';
const WEB_URL  = 'https://varenik-ai.github.io/south-korea-tv-hub/?v=3';
const SITE_URL = 'https://korea-tv.uk/';
const DONATE_URL = APP_URL + '?startapp=donate';                   // открывает мини-апп сразу с окном выбора ⭐
const STARS = [25, 100, 500];                                       // суммы в чате (/donate)
const DONATE_AMOUNTS = [25, 50, 100, 250];                          // суммы окна «⭐ 감사하기» в мини-аппе (/invoice)
const CONTACT = 'dyaltd@gmail.com';

// Каналы по темам — один список для /start, /channels и /post (совпадает с мини-аппом, 40 каналов)
const GROUPS = [
  { e: '🌏', short: 'Arirang TV · Radio', ko: '국제', en: 'International', list_ko: '아리랑TV · 아리랑라디오', list_en: 'Arirang TV · Arirang Radio', n: 2 },
  { e: '📺', short: 'TV조선 · TV조선2', ko: '종합편성', en: 'General', list_ko: 'TV조선 · TV조선2', list_en: 'TV Chosun · TV Chosun 2', n: 2 },
  { e: '📚', short: 'EBS ×6 — 1TV · 2TV · Plus · Kids · English', ko: 'EBS', en: 'EBS', list_ko: 'EBS 1TV · 2TV · 플러스1 · 플러스2 · 키즈 · 잉글리시', list_en: 'EBS 1TV · 2TV · Plus1 · Plus2 · Kids · English', n: 6 },
  { e: '🏛️', short: 'KTV · 국악방송 · OUN · NBS', ko: '공영·정책', en: 'Public & Culture', list_ko: 'KTV · 국악방송 · 방송대학TV · 농수산방송', list_en: 'KTV · Gugak TV · OUN · NBS', n: 4 },
  { e: '📍', short: 'Regional ×10 — 제주 · 광주 · 울산 · TBS · 춘천 · 대전 …', ko: '지역', en: 'Regional', list_ko: '제주MBC · 광주KBC · 울산UBC · 교통방송TBS · 춘천MBC · 대전MBC · NHTV · 남인천방송 · 지방자치TV · 금강방송', list_en: 'MBC Jeju · SBS KBC · SBS UBC · TBS Seoul · MBC Chuncheon · MBC Daejeon · NHTV · NIB · JJCTV · KCN', n: 10 },
  { e: '📈', short: 'WOWTV · MK Money · Shopping ×7', ko: '경제·쇼핑', en: 'Business & Shopping', list_ko: '한국경제TV · 매일경제TV · KT알파쇼핑 · CJ온스타일 · CJ온스타일 플러스 · GS SHOP · 롯데홈쇼핑 · 신세계TV쇼핑 · 공영쇼핑', list_en: 'WOWTV · MK Money · KT Alpha Shopping · CJ OnStyle · CJ OnStyle Plus · GS SHOP · Lotte Home Shopping · Shinsegae TV Shopping · Gongyoung Shopping', n: 9 },
  { e: '⛪', short: 'BTN · ABN · FGTV · RUTC · BBS', ko: '종교', en: 'Religious', list_ko: 'BTN · ABN · FGTV · RUTC · BBS 불교방송', list_en: 'BTN · ABN · FGTV · RUTC · BBS Buddhist TV', n: 5 },
  { e: '🎵', short: 'TBS eFM · TBS FM', ko: '음악·라디오', en: 'Music & Radio', list_ko: 'TBS eFM · TBS FM', list_en: 'TBS eFM · TBS FM', n: 2 },
];
const TOTAL = GROUPS.reduce((a, g) => a + g.n, 0);   // 40

const LANGS = ['ko', 'en'];
const pickLang = (code) => { const l = (code || 'ko').split('-')[0].toLowerCase(); return LANGS.includes(l) ? l : 'en'; };
const esc = (s) => String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ── Тексты ────────────────────────────────────────────────────────────────
const L = {
  ko: {
    start: (n) => `📺 <b>안녕하세요${n ? ', ' + n + '님' : ''}!</b>\n한국 TV 실시간 채널 ${TOTAL}개 — 무료, 가입 없이, 어느 나라에서나.\n\n👇 앱을 열고 채널을 선택하세요`,
    open: '📺 Korea TV Live 열기', site: '🌐 사이트 korea-tv.uk', help: '❓ 도움말', donate: '⭐ 감사하기',
    help_t: `❓ <b>시청 방법</b>\n1. «Korea TV Live 열기»를 누르고 채널을 선택하세요.\n2. 소리가 안 나요? «소리 켜기»를 누르세요.\n3. 화면이 끊겨요? 플레이어의 ⚙ → 더 낮은 화질.\n4. 채널이 안 열려요: 1분 정도 기다리거나 다른 채널을 선택하세요.\n\n📺 <b>TV로 보기</b>\n• 컴퓨터나 Android의 Chrome: korea-tv.uk 플레이어의 Cast 버튼 (Chromecast 또는 Google Cast TV).\n• iPhone: Safari에서 korea-tv.uk → AirPlay 버튼 (Apple TV 또는 AirPlay TV).\n\n📧 문제나 방송 관련 문의: ${CONTACT}`,
    channels_t: '주제별 채널', donate_t: '프로젝트 후원', donate_d: '시청해 주셔서 감사합니다! 스타는 서버 비용과 채널 유지에 도움이 됩니다.', donate_ask: '⭐ 텔레그램 스타로 감사를 전하세요. 얼마나 보낼까요? 스타 결제는 텔레그램 앱(휴대폰, 컴퓨터)에서 작동하며 웹 버전에서는 열리지 않을 수 있습니다.', donate_ok: '🙏 후원해 주셔서 감사합니다! 프로젝트에 큰 도움이 됩니다.',
    desc: `텔레그램에서 보는 한국 TV: 실시간 채널 ${TOTAL}개 — 아리랑, EBS, KTV, 지역·종교·경제 채널. 무료, 가입 없이, 어느 나라에서나.`, short: `한국 TV 실시간 채널 ${TOTAL}개`,
    menu: '📺 시청하기', cmds: { start: '앱 열기', help: '시청 방법 / TV로 보기', channels: '채널 목록', donate: '감사하기' },
  },
  en: {
    start: (n) => `📺 <b>Hello${n ? ', ' + n : ''}!</b>\n${TOTAL} South Korean TV channels live — free, no registration, from any country.\n\n👇 Open the app and pick a channel`,
    open: '📺 Open Korea TV Live', site: '🌐 Website korea-tv.uk', help: '❓ Help', donate: '⭐ Say thanks',
    help_t: `❓ <b>How to watch</b>\n1. Tap “Open Korea TV Live” and pick a channel.\n2. No sound? Tap “Unmute”.\n3. Choppy picture? ⚙ in the player → lower quality.\n4. Channel not loading: wait a minute or pick another one.\n\n📺 <b>On your TV</b>\n• Chrome on a computer or Android: the Cast button in the player on korea-tv.uk (Chromecast or a TV with Google Cast).\n• iPhone: korea-tv.uk in Safari → AirPlay button (Apple TV or an AirPlay TV).\n\n📧 Found a problem or a question about streams: ${CONTACT}`,
    channels_t: 'Channels by topic', donate_t: 'Support the project', donate_d: 'Thanks for watching! Stars help pay for servers and keep the channels running.', donate_ask: '⭐ Say thanks with Telegram Stars. How many? Stars payments work in the Telegram app (phone or desktop); they may not open in the web version.', donate_ok: '🙏 Thank you for your support! It really helps.',
    desc: `South Korean TV on Telegram: ${TOTAL} live channels — Arirang, EBS, KTV, regional, religious and business channels. Free, no registration, from any country.`, short: `${TOTAL} South Korean TV channels live`,
    menu: '📺 Watch', cmds: { start: 'Open the app', help: 'How to watch / on TV', channels: 'Channel list', donate: 'Say thanks' },
  },
};

const channelsText = (lang) => `<b>${esc(L[lang].channels_t)} (${TOTAL})</b>\n\n` +
  GROUPS.map((g) => `${g.e} <b>${esc(g[lang])}</b>\n${esc(g['list_' + lang])}`).join('\n\n');

// Пост в канал: корейский + английский
const POST_TEXT =
  `🇰🇷 <b>KOREA·TV — ${TOTAL} live</b> 🔴\n무료 · Free · no sign-up · no VPN · 24/7\n\n` +
  GROUPS.map((g) => `${g.e} ${esc(g.short)}`).join('\n') +
  `\n\n📱 iOS · Android · PC · AirPlay / Chromecast\n🌐 korea-tv.uk\n\n👇 앱 열기 · Open the app`;

const postKb = () => ({ inline_keyboard: [
  [{ text: '📺 Open Korea TV Live', url: APP_URL, style: 'success' }],
  [{ text: '🌐 korea-tv.uk', url: SITE_URL }],
  [{ text: '❓ 도움말 · Help', url: `https://t.me/${BOT_USERNAME}?start=help` }, { text: '⭐ 감사하기 · Say thanks', url: DONATE_URL }],
] });

function kb(lang) {
  const t = L[lang];
  return { inline_keyboard: [
    [{ text: t.open, web_app: { url: WEB_URL } }],
    [{ text: t.site, url: SITE_URL }],
    [{ text: t.help, callback_data: 'help' }, { text: t.donate, callback_data: 'donate' }],
  ] };
}
const donateKb = () => ({ inline_keyboard: [STARS.map((n) => ({ text: '⭐ ' + n, callback_data: 'don:' + n }))] });
const helpKb = (lang) => ({ inline_keyboard: [[{ text: L[lang].open, web_app: { url: WEB_URL } }], [{ text: L[lang].site, url: SITE_URL }]] });

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
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

function isAdmin(msg) {
  const ids = secret('ADMIN_IDS').split(',').map((s) => s.trim()).filter(Boolean);
  return !!msg.chat && msg.chat.type === 'private' && ids.includes(String(msg.from && msg.from.id));
}

// Сравнение строк за постоянное время, чтобы не подбирали секрет по таймингу.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj, null, 2), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

async function tg(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${secret('BOT_TOKEN')}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  return res.json().catch(() => ({ ok: false }));
}
const send = (chat_id, text, extra = {}) => tg('sendMessage', { chat_id, text, ...extra });

async function handleMessage(msg) {
  if (msg.successful_payment) return send(msg.chat.id, L[pickLang(msg.from && msg.from.language_code)].donate_ok);
  const text = (msg.text || '').trim();
  if (!text.startsWith('/')) return;
  const chatId = msg.chat.id, lang = pickLang(msg.from && msg.from.language_code), t = L[lang];
  const m = /^\/(\w+)(?:@\w+)?(?:\s+(\w+))?/.exec(text);
  if (!m) return;
  const cmd = m[1].toLowerCase(), arg = m[2];

  if (cmd === 'start') {
    if (arg === 'help') return send(chatId, t.help_t, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: helpKb(lang) });
    if (arg === 'donate') return send(chatId, t.donate_ask, { reply_markup: donateKb() });
    return send(chatId, t.start(esc(msg.from && msg.from.first_name)), { parse_mode: 'HTML', reply_markup: kb(lang) });
  }
  if (cmd === 'help') return send(chatId, t.help_t, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: helpKb(lang) });
  if (cmd === 'channels') return send(chatId, channelsText(lang), { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: t.open, web_app: { url: WEB_URL } }]] } });
  if (cmd === 'donate') return send(chatId, t.donate_ask, { reply_markup: donateKb() });

  if (cmd === 'fixpost') {
    if (!isAdmin(msg)) return;   // только администраторы, только в личке
    // Меняет кнопки закреплённого поста на месте (editMessageReplyMarkup): новое сообщение не уходит, подписчики ничего не получают
    const chat = await tg('getChat', { chat_id: CHANNEL });
    const pin = chat.ok && chat.result.pinned_message;
    if (!pin) return send(chatId, '❌ Закреплённый пост не найден: ' + (chat.description || 'нет закреплённого сообщения'));
    const old = JSON.stringify(pin.reply_markup ? pin.reply_markup.inline_keyboard.map((r) => r.map((b) => b.text + ' → ' + (b.url || ''))) : null);
    const r = await tg('editMessageReplyMarkup', { chat_id: CHANNEL, message_id: pin.message_id, reply_markup: postKb() });
    if (r.ok || /message is not modified/i.test(r.description || '')) {
      return send(chatId, '✅ Кнопки закреплённого поста (id ' + pin.message_id + ') обновлены, подписчикам ничего не отправлено.\nБыло: ' + old);
    }
    return send(chatId, '❌ Не удалось: ' + (r.description || 'unknown') + '\nКнопки сейчас: ' + old);
  }

  if (cmd === 'post') {
    if (!isAdmin(msg)) return;   // только администраторы, только в личке
    const post = await send(CHANNEL, POST_TEXT, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: postKb() });
    if (post && post.ok) {
      await tg('pinChatMessage', { chat_id: CHANNEL, message_id: post.result.message_id });
      return send(chatId, '✅ Пост опубликован и закреплён!');
    }
    return send(chatId, '❌ Ошибка: ' + ((post && post.description) || 'не удалось опубликовать'));
  }
}

async function handleCallback(q) {
  const lang = pickLang(q.from && q.from.language_code), chatId = q.message && q.message.chat && q.message.chat.id, t = L[lang];
  await tg('answerCallbackQuery', { callback_query_id: q.id });
  if (!chatId) return;
  if (q.data === 'help') return send(chatId, t.help_t, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: helpKb(lang) });
  if (q.data === 'donate') return send(chatId, t.donate_ask, { reply_markup: donateKb() });
  const m = /^don:(\d+)$/.exec(q.data || '');
  if (m && STARS.includes(Number(m[1]))) {
    const amount = Number(m[1]);
    const inv = await tg('sendInvoice', { chat_id: chatId, title: t.donate_t, description: t.donate_d, payload: 'donate_' + amount, provider_token: '', currency: 'XTR', prices: [{ label: t.donate_t, amount }] });
    if (!inv.ok) await send(chatId, '⚠️ ' + t.donate_t + ' — ' + (inv.description || 'error'));   // показываем причину отказа Telegram, а не молчим
    return inv;
  }
}

async function handleUpdate(u) {
  if (u.message) return handleMessage(u.message);
  if (u.callback_query) return handleCallback(u.callback_query);
  if (u.pre_checkout_query) return tg('answerPreCheckoutQuery', { pre_checkout_query_id: u.pre_checkout_query.id, ok: true });
}

async function setup(origin) {
  const out = {};
  out.webhook = (await tg('setWebhook', {
    url: origin + '/',
    secret_token: secret('WEBHOOK_SECRET'),
    allowed_updates: ['message', 'callback_query', 'pre_checkout_query'],
    drop_pending_updates: true,
  })).ok;
  out.commands = {};
  for (const lang of LANGS) {
    const t = L[lang], extra = lang === 'ko' ? {} : { language_code: lang };   // ko — по умолчанию, en — для английского интерфейса
    out.commands[lang] = (await tg('setMyCommands', { commands: Object.entries(t.cmds).map(([command, description]) => ({ command, description })), ...extra })).ok;
    await tg('setMyDescription', { description: t.desc, ...extra });
    await tg('setMyShortDescription', { short_description: t.short, ...extra });
  }
  out.menu = (await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: L.ko.menu, web_app: { url: WEB_URL } } })).ok;
  const info = await tg('getWebhookInfo', {});
  out.webhookUrl = info.result && info.result.url;
  out.pending = info.result && info.result.pending_update_count;
  out.lastError = info.result && info.result.last_error_message;
  return out;
}

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  const whSecret = secret('WEBHOOK_SECRET');

  if (!secret('BOT_TOKEN') || !whSecret) {
    return json({ ok: false, error: 'BOT_TOKEN / WEBHOOK_SECRET are not configured' }, 500);
  }

  // /invoice?amount=N — ссылка на оплату Stars для мини-аппа (tg.openInvoice). Открытый адрес, как у Russia TV.
  if (url.pathname === '/invoice') {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const amount = parseInt(url.searchParams.get('amount'), 10);
    if (!DONATE_AMOUNTS.includes(amount)) return json({ error: 'bad amount' }, 400, cors);
    const r = await tg('createInvoiceLink', { title: L.en.donate_t, description: L.en.donate_d, payload: 'donate_' + amount, provider_token: '', currency: 'XTR', prices: [{ label: 'Korea TV', amount }] });
    return json(r.ok ? { url: r.result } : { error: r.description }, r.ok ? 200 : 502, cors);
  }

  // Служебные адреса — только с ?key=<WEBHOOK_SECRET>. /set-webhook оставлен как алиас /setup.
  if (url.pathname === '/setup' || url.pathname === '/set-webhook' || url.pathname === '/webhook-info') {
    if (!safeEqual(url.searchParams.get('key') || '', whSecret)) return new Response('Forbidden', { status: 403 });
    if (url.pathname === '/webhook-info') return json(await tg('getWebhookInfo', {}));
    return json(await setup(url.origin));
  }

  if (request.method !== 'POST') return new Response('Korea TV Bot Worker OK');

  // Апдейты принимаем только от Telegram (он присылает secret_token в заголовке).
  if (!safeEqual(request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '', whSecret)) {
    return new Response('Forbidden', { status: 403 });
  }

  let update;
  try { update = await request.json(); } catch (e) { return new Response('bad request', { status: 400 }); }
  // Отвечаем Telegram сразу, работа продолжается в фоне (как ctx.waitUntil у Russia TV)
  event.waitUntil(handleUpdate(update).catch(() => {}));
  return new Response('ok');
}
