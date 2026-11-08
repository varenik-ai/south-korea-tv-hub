# Korea TV Hub — мини-апп, воркер потоков и бот

39 корейских каналов в прямом эфире: Telegram-мини-апп **Korea TV Live** (@KoreaTVHub_bot), Cloudflare-воркер,
который отдаёт плейлисты, и бот. Сайт korea-tv.uk лежит в соседнем репозитории
[`varenik-ai/korea-tv-uk-website`](https://github.com/varenik-ai/korea-tv-uk-website) и использует тот же воркер.

Репозиторий **публичный**: токенов и секретов в нём нет и быть не должно (см. `DEPLOY.md`).

## Документация
| Файл | Что в нём |
|---|---|
| `ETALON.md` | что работает в мини-аппе, воркере и боте и **не должно ломаться** при правках |
| `DEPLOY.md` | как всё выкатывается, секреты Cloudflare, `/setup`, смена токена, проверка после выкладки |
| `BOT.md` | бот: команды, донаты Stars, закреплённый пост, тексты |
| `ADD_CHANNEL.md` | как добавить, заменить или убрать канал во всех местах (воркер, мини-апп, бот, сайт) |

## Что где лежит
| Путь | Что это | Куда выкатывается |
|---|---|---|
| `index.html` | мини-апп (один файл: HTML + CSS + JS) | GitHub Pages: `https://varenik-ai.github.io/south-korea-tv-hub/` |
| `korea-worker.js` + `wrangler.toml` | воркер потоков `korea-worker` | Cloudflare Workers Builds при push в `main` |
| `bot-worker/korea-bot-worker.js` + `bot-worker/wrangler.toml` | бот `korea-bot-worker` (webhook) | Cloudflare Workers Builds при push в `main` |
| `bot.js` | запасной локальный запуск бота через polling (отладка) | не выкатывается |

## Адреса
- Мини-апп в Telegram: `https://t.me/KoreaTVHub_bot/koreatv` (канал сразу: `?startapp=ebs1`, окно ⭐: `?startapp=donate`)
- Канал Telegram: `https://t.me/Korea_TV_hub`
- Воркер потоков: `https://korea-worker.dyaltd.workers.dev` (`/version`, `/stream?channel=ID`)
- Бот: `https://korea-bot-worker.dyaltd.workers.dev` (`/invoice`, `/setup?key=…`)
- Сайт: `https://korea-tv.uk/` (ko), `https://korea-tv.uk/en/` (en)

## Откуда взято
Проект — порт Russia TV (`varenik-ai/russia-tv-hub@753da78`, ETALON v1.8, и `varenik-ai/russian-tv-site@3df9191`).
Сознательно не перенесены: реклама (Monetag, Яндекс.Метрика), «📺 На ТВ» с привязкой телефона (`/tv/`, Durable Objects),
EPG (у корейских каналов нет открытого источника расписания), специфика российских источников (НТВ-native,
`PREEMPTIVE_IDS`, `SYNTH_MASTERS`, прямые плейлисты), языки бота кроме ko/en.

## Локальная проверка
Мини-апп — статический файл: `python3 -m http.server 8765` в корне и открыть `http://localhost:8765/`.
Потоки берутся с боевого воркера, поэтому локально проверяется интерфейс и воспроизведение, но не изменения в `korea-worker.js`.
