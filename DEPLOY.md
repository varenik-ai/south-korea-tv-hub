# Деплой и секреты

Актуально на **9 ноября 2026**. Что работает и что нельзя ломать — `ETALON.md`, бот — `BOT.md`, каналы — `ADD_CHANNEL.md`.

## Как всё выкатывается
| Что | Откуда | Как обновляется |
|---|---|---|
| Мини-апп `index.html` | этот репозиторий, ветка `main` | GitHub Pages: `https://varenik-ai.github.io/south-korea-tv-hub/` (~1 мин, кеш до 10 мин) |
| Воркер потоков `korea-worker` (`korea-worker.js`, `wrangler.toml` в корне) | `main` | Cloudflare Workers Builds сам деплоит после push (~30 с) |
| Бот `korea-bot-worker` (`bot-worker/`) | `main` | так же, Workers Builds |
| Сайт korea-tv.uk | репозиторий `varenik-ai/korea-tv-uk-website` | GitHub Pages |

Проверка версии воркера: `https://korea-worker.dyaltd.workers.dev/version` (сейчас `1.7.0`, `mode: hybrid`, `channels: 39`, `direct: 29`).

## Секреты (только в Cloudflare, никогда в репозитории — он публичный)
Cloudflare → Workers & Pages → воркер → Settings → Variables and Secrets (тип Secret), после изменения — Deploy.

| Воркер | Секрет | Что это |
|---|---|---|
| `korea-bot-worker` | `BOT_TOKEN` | токен @KoreaTVHub_bot из @BotFather |
| `korea-bot-worker` | `WEBHOOK_SECRET` | случайная строка (`openssl rand -hex 32`): заголовок webhook и ключ для `/setup` |
| `korea-bot-worker` | `ADMIN_IDS` | Telegram user id через запятую — кому разрешены `/post` и `/fixpost` |
| `korea-worker` | `PROXY_SECRET` | случайная строка: HMAC-подпись ссылок `/proxy` |

Без секретов код намеренно не работает: бот отвечает 500, прокси 503.
Секреты в коде читаются как глобальные переменные (`typeof BOT_TOKEN`), не через `globalThis` — так они не видны.
Секреты задаются **каждому воркеру отдельно**: бот не видит секреты прокси и наоборот.

## После деплоя бота
Один раз открыть `https://korea-bot-worker.dyaltd.workers.dev/setup?key=<WEBHOOK_SECRET>` — регистрирует webhook
(`message`, `callback_query`, `pre_checkout_query`), команды, описания ko/en и кнопку меню. Ожидаемо: `"webhook": true, "menu": true`.
Проверка: `.../webhook-info?key=<WEBHOOK_SECRET>`.

## Смена токена
1. @BotFather → `/revoke` → новый токен.
2. Обновить секрет `BOT_TOKEN` у `korea-bot-worker` → Deploy.
3. Открыть `/setup?key=…`.

## Проверка после выкладки
- `/start`, `/help`, `/channels`, «⭐ 감사하기» в боте; мини-апп открывается и играет.
- `https://korea-worker.dyaltd.workers.dev/proxy?url=https%3A%2F%2Fexample.com%2F` → 403.
- `/post` от чужого аккаунта молча игнорируется.
- `https://korea-bot-worker.dyaltd.workers.dev/invoice?amount=30` → 400, `amount=25` → `{"url": ...}`.
