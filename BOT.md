# Бот @KoreaTVHub_bot (`bot-worker/korea-bot-worker.js`)

Cloudflare-воркер `korea-bot-worker`, webhook, синтаксис Service Worker (`addEventListener('fetch', …)`).
Деплой — push в `main` (Workers Builds), секреты и `/setup` — `DEPLOY.md`.

## Константы в начале файла
| Константа | Значение | Зачем |
|---|---|---|
| `CHANNEL` | `-1003991519999` | Telegram-канал «Korea TV Hub 🇰🇷 \| Live Channels» (`t.me/Korea_TV_hub`), куда идёт `/post` |
| `APP_URL` | `https://t.me/KoreaTVHub_bot/koreatv` | ссылка на мини-апп (кнопки поста) |
| `WEB_URL` | `https://varenik-ai.github.io/south-korea-tv-hub/?v=3` | адрес мини-аппа для кнопок `web_app` и кнопки меню |
| `SITE_URL` | `https://korea-tv.uk/` | кнопка «사이트» |
| `STARS` | `[25, 100, 500]` | суммы доната в чате (`/donate`) |
| `DONATE_AMOUNTS` | `[25, 50, 100, 250]` | суммы, которые принимает `/invoice` (окно ⭐ в мини-аппе) |
| `GROUPS` | 8 групп, `TOTAL` = 39 | единый список каналов для `/start`, `/channels`, `/post`, описаний бота |

`?v=3` в `WEB_URL` сбрасывает кеш WebView Telegram. Если после выкладки мини-аппа у пользователей открывается старая версия —
увеличить число, задеплоить бота и открыть `/setup?key=…` (кнопка меню перерегистрируется с новым адресом).

## Команды
| Команда | Кто | Что делает |
|---|---|---|
| `/start` | все | приветствие (имя, число каналов) + кнопки: «📺 Korea TV Live 열기» (web_app), «🌐 사이트», «❓ 도움말», «⭐ 감사하기» |
| `/start help` | все | то же, что `/help` (ссылка `t.me/KoreaTVHub_bot?start=help` из поста) |
| `/start donate` | все | выбор суммы ⭐ |
| `/help` | все | как смотреть: звук, качество ⚙, канал не грузится, AirPlay/Cast |
| `/channels` | все | 39 каналов по 8 темам |
| `/donate` | все | кнопки ⭐ 25 / 100 / 500 → `sendInvoice` |
| `/post` | только `ADMIN_IDS`, только в личке | публикует пост ko+en в канал и закрепляет его |
| `/fixpost` | только `ADMIN_IDS`, только в личке | меняет только кнопки закреплённого поста (`editMessageReplyMarkup`): новое сообщение не уходит, уведомлений нет |

От чужих аккаунтов `/post` и `/fixpost` молча игнорируются. Язык — по `language_code` пользователя: `ko` → корейский,
всё остальное → английский. Команды и описания бота регистрируются для ko (по умолчанию) и en.

## Закреплённый пост
- Текст: `POST_TEXT` (корейский блок, разделитель, английский блок; списки каналов из `GROUPS`)
- Кнопки: `postKb()` — «📺 Open Korea TV Live», «🌐 korea-tv.uk», «❓ 도움말 · Help», «⭐ 감사하기 · Say thanks»
- Поменялся только набор кнопок → `/fixpost`. Поменялся текст (например, число каналов) → текст правится вручную в канале
  (или новый `/post`: опубликует и закрепит новый пост, подписчики получат уведомление)

## Донаты Telegram Stars
- В чате: `/donate` → кнопка суммы → `sendInvoice` (валюта `XTR`, `provider_token: ''`)
- В мини-аппе: `GET /invoice?amount=25|50|100|250` → `{"url": "..."}` (`createInvoiceLink`), мини-апп открывает `tg.openInvoice(url)`.
  Другая сумма → 400. Адрес открытый, CORS `*` — ссылка на оплату не даёт доступа ни к чему, кроме оплаты
- `pre_checkout_query` → `answerPreCheckoutQuery ok: true`; `successful_payment` → «감사합니다» / «Thank you»
- Звёзды копятся на балансе бота: @BotFather → бот → Payments / Stars (вывод через Fragment)

## Служебные адреса
| Адрес | Доступ | Что делает |
|---|---|---|
| `POST /` | только с заголовком `X-Telegram-Bot-Api-Secret-Token` = `WEBHOOK_SECRET` | обновления от Telegram; ответ сразу, обработка в `waitUntil` |
| `GET /setup?key=<WEBHOOK_SECRET>` | ключ | webhook (`message`, `callback_query`, `pre_checkout_query`, сброс очереди), команды, описания ko/en, кнопка меню |
| `GET /set-webhook?key=…` | ключ | алиас `/setup` |
| `GET /webhook-info?key=…` | ключ | `getWebhookInfo` |
| `GET /invoice?amount=N` | открыт | ссылка на оплату ⭐ |
| `GET /` | открыт | `Korea TV Bot Worker OK` |

Без `BOT_TOKEN` или `WEBHOOK_SECRET` любой запрос получает 500 — это намеренно.

## Изменение каналов
Правится только `GROUPS`: эмодзи, название группы ko/en, перечень ko/en, `n` — число каналов в группе.
`TOTAL` считается сам и подставляется в `/start`, описания бота и пост. После выкладки — `/setup?key=…`
(обновит описания бота с новым числом). Полный чеклист — `ADD_CHANNEL.md`.

## Локальная отладка (`bot.js`)
```bash
BOT_TOKEN=... ADMIN_IDS=123456789 node bot.js
```
Снимает webhook и получает обновления через `getUpdates`, передавая их коду воркера без изменений.
Пока он работает, боевой бот молчит. После отладки — открыть `/setup?key=…`, чтобы вернуть webhook.
