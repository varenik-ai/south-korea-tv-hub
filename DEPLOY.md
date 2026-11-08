# Выкатка: секреты и защита прокси

Порядок важен: сначала секреты, потом новый код. Без секретов новый код
намеренно не работает (бот отвечает 500, прокси 503).

## 1. Новый токен бота
1. @BotFather → `/revoke` → @KoreaTVHub_bot. Старый токен лежит в истории
   этого публичного репозитория, поэтому его нужно отозвать, а не просто удалить из кода.
2. Скопировать новый токен (никуда в репозиторий его не вставлять).

## 2. Секреты воркеров
```bash
cd bot-worker
npx wrangler secret put BOT_TOKEN        # новый токен из шага 1
npx wrangler secret put WEBHOOK_SECRET   # случайная строка, например: openssl rand -hex 32
npx wrangler secret put ADMIN_IDS        # ваш Telegram user id (узнать: @userinfobot), через запятую
cd ..
npx wrangler secret put PROXY_SECRET     # для korea-worker, ещё одна случайная строка
```
Или то же самое в Cloudflare dashboard → Workers → (воркер) → Settings → Variables and Secrets.

## 3. Деплой кода
```bash
npx wrangler deploy                         # korea-worker (прокси)
cd bot-worker && npx wrangler deploy        # korea-bot-worker
```
Если воркеры подключены к GitHub через Cloudflare Workers Builds, деплой
запустится сам после push — тогда шаг 2 обязательно сделать до push.

## 4. Перерегистрировать webhook
Открыть один раз: `https://korea-bot-worker.dyaltd.workers.dev/set-webhook?key=<WEBHOOK_SECRET>`
Проверка: `.../webhook-info?key=<WEBHOOK_SECRET>`.

## 5. Проверка
- `/start` в боте отвечает, миниап открывается и играет.
- `https://korea-worker.dyaltd.workers.dev/proxy?url=https%3A%2F%2Fexample.com%2F` → 403.
- `/post` от чужого аккаунта молча игнорируется.
