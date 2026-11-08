const TelegramBot = require('node-telegram-bot-api');

// Устаревший вариант (polling). Основной бот работает в bot-worker/korea-bot-worker.js.
// Токен берётся из переменной окружения, в репозитории его быть не должно:
//   BOT_TOKEN=... ADMIN_IDS=123456789 node bot.js
const TOKEN   = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
if (!TOKEN) { console.error('BOT_TOKEN is not set'); process.exit(1); }
const CHANNEL = -1003991519999;                  // Korea TV Hub 🇰🇷 | Live Channels (приватный канал)
                                                  // ⚠️ бота нужно вручную назначить админом канала
                                                  // (Channel → Administrators → Add Admin → @KoreaTVHub_bot) —
                                                  // поиск бота через веб-версию Telegram не сработал, сделайте это в приложении
const APP_URL = 'https://t.me/KoreaTVHub_bot/koreatv';
const WEB_URL = 'https://varenik-ai.github.io/south-korea-tv-hub/?v=1';

const bot = new TelegramBot(TOKEN, { polling: { interval: 2000, autoStart: true, params: { timeout: 10 } } });

bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || '';
  const lang = (msg.from.language_code || 'ko').split('-')[0];

  const greetings = {
    ko: `🇰🇷 안녕하세요, ${name}님!

📺 *KOREA·TV — 텔레그램에서 실시간 채널 31개*

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

    en: `🇰🇷 Hello, ${name}!

📺 *KOREA·TV — 31 live channels on Telegram*

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

  bot.sendMessage(msg.chat.id, greetings[lang] || greetings.ko, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: btnWatch[lang]   || btnWatch.ko,   web_app: { url: WEB_URL } }],
        [{ text: btnBrowser[lang] || btnBrowser.ko, url: WEB_URL }],
      ]
    }
  });
});

// /post — публикует и закрепляет пост в канале
bot.onText(/^\/post$/, async (msg) => {
  if (msg.chat.type !== 'private' || !ADMIN_IDS.includes(String(msg.from.id))) return;
  try {
    const post = await bot.sendMessage(CHANNEL,
`🇰🇷 *KOREA·TV — 실시간 채널 31개* 🔴

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

🇬🇧 *KOREA·TV — 31 live channels* 🔴

Watch South Korean TV free on Telegram — *no VPN, no registration, 24/7.*

🌏 *International* — Arirang TV, Arirang Radio
📚 *EBS* — 1TV, 2TV, Plus1, Plus2, Kids, English
🏛️ *Public* — KTV, Gugak TV, OUN, NBS
📍 *Regional* — MBC Jeju, SBS KBC, SBS UBC, TBS Seoul, MBC Chuncheon, MBC Daejeon, NHTV, NIB, JJCTV, KCN
📈 *Business/Shopping* — WOWTV, MK Money, KT Alpha Shopping
⛪ *Religious/Other* — BTN, ABN, FGTV, RUTC
🎵 *Music/Radio* — TBS eFM, TBS FM

👇 *Tap the button below to pick a channel*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📺 Open Korea TV Live', url: APP_URL }
          ]]
        }
      }
    );
    await bot.pinChatMessage(CHANNEL, post.message_id);
    bot.sendMessage(msg.chat.id, '✅ Пост опубликован и закреплён!');
  } catch(e) {
    bot.sendMessage(msg.chat.id, '❌ Ошибка: ' + e.message);
  }
});

console.log('✅ South Korea TV Hub бот запущен!');
