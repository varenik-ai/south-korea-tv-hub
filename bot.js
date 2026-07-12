const TelegramBot = require('node-telegram-bot-api');

const TOKEN   = 'ТОКЕН_ОТ_BOTFATHER';           // получить у @BotFather
const CHANNEL = '@KoreaTV_Hub_Live';             // создать канал заранее, добавить бота админом
const APP_URL = 'https://t.me/KoreaTVHub_bot/koreatv';
const WEB_URL = 'https://varenik-ai.github.io/south-korea-tv-hub/?v=1';

const bot = new TelegramBot(TOKEN, { polling: { interval: 2000, autoStart: true, params: { timeout: 10 } } });

bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || '';
  const lang = (msg.from.language_code || 'ko').split('-')[0];

  const greetings = {
    ko: `🇰🇷 안녕하세요, ${name}님!

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

    en: `🇰🇷 Hello, ${name}!

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
  try {
    const post = await bot.sendMessage(CHANNEL,
`🇰🇷 *KOREA·TV — 36 КАНАЛОВ В ПРЯМОМ ЭФИРЕ* 🔴

Смотрите южнокорейское телевидение прямо в Telegram — *бесплатно, без VPN, без регистрации, 24/7.*

━━━━━━━━━━━━━━━━━━━━
🌏 *МЕЖДУНАРОДНЫЕ*
▪️ Arirang TV · Arirang Radio

📡 *ЭФИРНЫЕ*
▪️ SBS

📚 *EBS*
▪️ EBS 1TV · EBS 2TV · EBS Plus1 · EBS Plus2 · EBS Kids · EBS English

🏛️ *ОБЩЕСТВЕННЫЕ*
▪️ KTV · Gugak TV · OUN · NBS

📍 *РЕГИОНАЛЬНЫЕ*
▪️ MBC Jeju · SBS KBC · SBS UBC · TBS Seoul · MBC Chuncheon · MBC Daejeon · MBC Chungbuk · OBS Gyeonggi · NHTV · NIB · JJCTV · KCN

🏛️ *ГОСУДАРСТВЕННЫЕ*
▪️ National Assembly TV

📈 *ЭКОНОМИКА · ШОПИНГ*
▪️ WOWTV · MK Money · KT Alpha Shopping

⛪ *ПРОЧИЕ*
▪️ BTN TV · GoodTV · ABN TV · FGTV · RUTC TV

🎵 *МУЗЫКА · РАДИО*
▪️ TBS eFM · TBS FM
━━━━━━━━━━━━━━━━━━━━

✅ HD · iOS · Android · Desktop

👇 *Нажмите кнопку и выберите канал:*`,
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
