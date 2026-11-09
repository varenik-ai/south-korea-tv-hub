# Korea TV Hub — Эталон v2.2 (9 ноября 2026)

Что работает в мини-аппе, боте и воркере и **не должно ломаться** при правках. Основа — эталон Russia TV
(`varenik-ai/russia-tv-hub@753da78`, ETALON v1.8); здесь перечислено, что перенесено и чем Korea отличается.
Деплой и секреты — `DEPLOY.md`, бот — `BOT.md`, добавление каналов — `ADD_CHANNEL.md`.

## Каналы
- **40 каналов**, одинаковый набор в четырёх местах: `STREAMS` воркера, `CHANNEL_GROUPS` мини-аппа, `GROUPS` бота,
  `CHANNEL_GROUPS` главных страниц сайта (`index.html`, `en/index.html`). Расхождение = битая карточка или неверный счётчик
- Группы (8): 국제 · 종합편성 · EBS · 공영·정책 · 지역 · 종교 · 경제·쇼핑 · 음악·라디오. В мини-аппе региональные и прочие
  разбиты на две секции (9 заголовков), в боте и на сайте — 8 групп
- id канала — латиница с `_` (`ebs_plus1`); slug страницы на сайте — `id` с `-` вместо `_` + `-live` (`ebs-plus1-live`)
- Логотипы: `https://korea-tv.uk/assets/logos/<slug без -live>.png` (PNG, до 240×120, из открытой базы iptv-org),
  37 из 40. Без логотипа (текстовый значок): NIB, JJCTV, KCN. TBS FM использует логотип TBS eFM.
  В мини-аппе логотип на белой плашке — многие корейские логотипы тёмные

## Мини-апп (`index.html`)
- Хаб (группы каналов) + экран плеера; у каждого канала `id`, `name`, `desc`, `icon`, `color`, `iconBg`, `logo` (если есть),
  `slug`, `stream: PROXY + '/stream?channel=<id>'`
- Карточка с `logo` рисуется как `.ch-icon.ch-logo` с `<img>`; если картинка не загрузилась (`onerror`), карточка
  сама возвращается к текстовому значку `icon`
- hls.js закреплён **`1.5.15`** (`cdn.jsdelivr.net/npm/hls.js@1.5.15`), как на сайте; `@latest` не использовать
- Настройки hls.js: `startLevel: 0`, `capLevelToPlayerSize: true`, `abrEwmaDefaultEstimate: 500000`, `liveSyncDurationCount: 6`,
  `lowLatencyMode: false`, `enableWorker: false` (WebView Telegram)
- Выбор качества: `initQuality(hls)` сразу после `hls.attachMedia(video)`, `initQualityNative(streamUrl)` сразу после `video.src`
  (iOS, фиксированный уровень через воркер `/stream-q`); выбор в `localStorage` (`ktv_quality`)
- **Korea:** на «Авто» `hls.currentLevel` не присваивается, если ABR уже включён (`autoLevelEnabled`): присваивание обрывает
  загрузку первого фрагмента, медленные источники (KT알파쇼핑) не стартовали. То же правило в `assets/quality.js` сайта
- Повторы только через `_scheduleInit(baseMs)`: пауза ×2 до 30 с, после `MAX_FAIL_STREAK` (6) — «채널을 일시적으로 이용할 수 없습니다»
  и кнопка «재연결»; прямых `setTimeout(() => init(), …)` быть не должно
- Сторож зависания по кадрам (`getVideoPlaybackQuality`) с попыткой перескочить разрыв буфера (`_tryNudgeGap`); во время AirPlay сторож молчит
- `_restoreSound()`: если пользователь включил звук, он возвращается после автопереподключения
- Fullscreen: Android `container.requestFullscreen()` (fallback `.css-fs`), iOS `video.webkitEnterFullscreen()`; после выхода на iOS
  `stopStream()` + `init()`. Не вызывать `tg.requestFullscreen()` и `container.requestFullscreen()` одновременно
- `video` вне `.overlay`; `video.muted = true` перед `play()`; `userUnmuted = false` в начале `loadStream`
- Фон: Android — `audio-bg` с тихой дорожкой `SILENT_WAV` (второй hls.js не поднимается), iOS — Media Session
- Safe area через `contentSafeAreaInsets` / `safeAreaInsets`; PiP только на ПК
- AirPlay (iOS): первое нажатие переводит канал на нативный плеер (`_forceNative`), второе — выбор устройства; без AirPlay API
  кнопка открывает страницу канала на korea-tv.uk
- «🌐 사이트에서 보기» открывает korea-tv.uk (`/` или `/en/` по языку)
- Прямые ссылки: `t.me/KoreaTVHub_bot/koreatv?startapp=<id канала>`; `?startapp=donate` открывает окно ⭐
- «⭐ 감사하기 / Say thanks»: кнопки в хабе и в плеере, окно 25/50/100/250, `tg.openInvoice` со ссылкой от `GET {BOT_API}/invoice?amount=N`
- Языки ko (по умолчанию) и en
- Константы: `PROXY` = korea-worker, `SITE` = `https://korea-tv.uk`, `BOT_API` = korea-bot-worker
- **Не перенесено из Russia** (специфика их источников): прямые плейлисты (`xhrSetup`), НТВ-native, `PREEMPTIVE_IDS` (оставлен пустым),
  «📺 На ТВ» через pair-воркер, iframe OK.ru, EPG

## Воркер потоков (`korea-worker.js`, v1.7.1, гибрид)
- Маршруты: `/stream?channel=ID`, `/stream-q?channel=ID&q=КБИТ`, `/proxy?url=…&s=…` (подписан HMAC `PROXY_SECRET`), `/version`,
  `/debug` (без параметров — список каналов; с `?url` — только с `key`)
- `DIRECT` (30 каналов, https + CORS у плейлиста и сегментов): плейлисты через воркер, видеосегменты браузер берёт у источника
  напрямую — как «только плейлисты» у Russia
- Остальные 10 идут целиком через подписанный `/proxy`: `arirang_radio`, `sbs_ubc`, `nhtv`, `nib`, `kcn`, `mkmoney`,
  `tvchosun`, `tvchosun2`, `bbs`, `lotte` (источник по http, без CORS или с ограничениями); http-сегмент в DIRECT-плейлисте тоже уходит в `/proxy`
- Флаг `d=1` у вложенных плейлистов входит в подпись; неподписанные и поддельные адреса — 403
- `/stream-q` урезает мастер-плейлист до одного уровня, ближайшего к `q` (для выбора качества в нативном плеере iOS)
- Новый канал в `DIRECT` — только после проверки: https и `Access-Control-Allow-Origin` на плейлисте **и** сегментах
- Известно: NHTV через воркер отдаёт 403 на вложенный плейлист (сессия источника привязана к IP, у Cloudflare IP меняются);
  у OUN, WOWTV, TBS eFM бывают временные ошибки источника; BBS стартует медленно (~20 с), медленные источники переподключаются один раз

## Бот (`bot-worker/korea-bot-worker.js`)
Подробно — `BOT.md`. Не ломать:
- Синтаксис Service Worker; секреты `BOT_TOKEN`, `WEBHOOK_SECRET`, `ADMIN_IDS` читаются как глобальные переменные (`typeof BOT_TOKEN`), не через `globalThis`
- Webhook принимает только запросы с `X-Telegram-Bot-Api-Secret-Token`; ответ сразу, обработка в `waitUntil`
- Один список `GROUPS` (8 групп, `TOTAL` = 40) для `/start`, `/channels`, `/post`
- `bot.js` — запасной polling: загружает код воркера и передаёт ему обновления; не запускать одновременно с воркером

## Сайт korea-tv.uk (репозиторий `korea-tv-uk-website`)
Подробно — `README.md` того репозитория. Связи с этим репозиторием:
- Сайт берёт потоки у того же `korea-worker` (`/stream`, `/stream-q`)
- Логотипы мини-аппа лежат на сайте (`assets/logos/`): удалить или переименовать их — значит сломать карточки мини-аппа
- Cast скрыт на сайте у тех же 10 каналов, что вне `DIRECT` (`NO_CAST` в `assets/cast.js`): Chromecast сам качает сегменты.
  Меняешь `DIRECT` — поменяй и `NO_CAST`
