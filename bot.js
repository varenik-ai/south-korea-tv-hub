// bot.js — запасной локальный запуск бота @KoreaTVHub_bot через polling (для отладки).
// Основной бот работает в Cloudflare Worker: bot-worker/korea-bot-worker.js.
//
// ⚠️ НЕ запускать одновременно с воркером: getUpdates не работает, пока у бота
// зарегистрирован webhook (Telegram отдаёт обновления только одному получателю).
// Скрипт сам снимает webhook (deleteWebhook) — после отладки откройте
// https://korea-bot-worker.dyaltd.workers.dev/setup?key=<WEBHOOK_SECRET>, чтобы вернуть воркер.
//
// Тексты и логику не дублируем: скрипт загружает код воркера и передаёт ему
// каждое обновление так, как это сделал бы Telegram через webhook.
//
// Запуск (Node 18+, зависимостей нет):
//   BOT_TOKEN=... ADMIN_IDS=123456789 node bot.js
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) { console.error('BOT_TOKEN is not set'); process.exit(1); }
const LOCAL_SECRET = 'local-polling';

// Секреты воркера — глобальные переменные, как в Cloudflare (синтаксис Service Worker)
globalThis.BOT_TOKEN = TOKEN;
globalThis.WEBHOOK_SECRET = LOCAL_SECRET;
globalThis.ADMIN_IDS = process.env.ADMIN_IDS || '';

let handler = null;
globalThis.addEventListener = (type, fn) => { if (type === 'fetch') handler = fn; };
(0, eval)(fs.readFileSync(path.join(__dirname, 'bot-worker', 'korea-bot-worker.js'), 'utf8'));
if (!handler) { console.error('worker did not register a fetch handler'); process.exit(1); }

async function deliver(update) {
  const pending = [];
  let response;
  handler({
    request: new Request('https://local.bot/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': LOCAL_SECRET },
      body: JSON.stringify(update),
    }),
    respondWith: (p) => { response = p; },
    waitUntil: (p) => pending.push(p),
  });
  await response;
  await Promise.all(pending);
}

async function api(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  });
  return r.json();
}

(async () => {
  await api('deleteWebhook', {});
  console.log('✅ Korea TV Hub бот запущен (polling). Остановить: Ctrl+C');
  let offset = 0;
  for (;;) {
    try {
      const res = await api('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query', 'pre_checkout_query'] });
      if (!res.ok) { console.error('getUpdates:', res.description); await new Promise((r) => setTimeout(r, 5000)); continue; }
      for (const u of res.result) {
        offset = u.update_id + 1;
        try { await deliver(u); } catch (e) { console.error('update', u.update_id, e.message); }
      }
    } catch (e) {
      console.error('polling error:', e.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
})();
