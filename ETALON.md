# Korea TV Hub — Эталон v2.0 (8 ноября 2026)

Что работает в мини-аппе, боте и воркере и **не должно ломаться** при правках. Основа — эталон Russia TV
(`varenik-ai/russia-tv-hub@753da78`, ETALON v1.8); здесь перечислено, что перенесено и чем Korea отличается.
Деплой и секреты — `DEPLOY.md`.

## Мини-апп (`index.html`)
- Хаб (группы каналов) + экран плеера; 31 канал в `CHANNEL_GROUPS`, у каждого `slug` страницы на korea-tv.uk
- hls.js закреплён **`1.5.15`** (`cdn.jsdelivr.net/npm/hls.js@1.5.15`), как на сайте; `@latest` не использовать
- Настройки hls.js: `startLevel: 0`, `capLevelToPlayerSize: true`, `abrEwmaDefaultEstimate: 500000`, `liveSyncDurationCount: 6`, `lowLatencyMode: false`, `enableWorker: false` (WebView Telegram)
- Выбор качества: `initQuality(hls)` сразу после `hls.attachMedia(video)`, `initQualityNative(streamUrl)` сразу после `video.src` (iOS, фиксированный уровень через воркер `/stream-q`); выбор в `localStorage` (`ktv_quality`)
- **Korea:** на «Авто» `hls.currentLevel` не присваивается, если ABR уже включён (`autoLevelEnabled`): присваивание обрывает загрузку первого фрагмента, медленные источники (KT알파쇼핑) не стартовали
- Повторы только через `_scheduleInit(baseMs)`: пауза ×2 до 30 с, после `MAX_FAIL_STREAK` (6) — «채널을 일시적으로 이용할 수 없습니다» и кнопка «재연결»; прямых `setTimeout(() => init(), …)` быть не должно
- Сторож зависания по кадрам (`getVideoPlaybackQuality`) с попыткой перескочить разрыв буфера (`_tryNudgeGap`); во время AirPlay сторож молчит
- `_restoreSound()`: если пользователь включил звук, он возвращается после автопереподключения
- Fullscreen: Android `container.requestFullscreen()` (fallback `.css-fs`), iOS `video.webkitEnterFullscreen()`; после выхода на iOS `stopStream()` + `init()`. Не вызывать `tg.requestFullscreen()` и `container.requestFullscreen()` одновременно
- `video` вне `.overlay`; `video.muted = true` перед `play()`; `userUnmuted = false` в начале `loadStream`
- Фон: Android — `audio-bg` с тихой дорожкой `SILENT_WAV` (второй hls.js не поднимается), iOS — Media Session
- Safe area через `contentSafeAreaInsets` / `safeAreaInsets`; PiP только на ПК
- AirPlay (iOS): первое нажатие переводит канал на нативный плеер (`_forceNative`), второе — выбор устройства; без AirPlay API кнопка открывает страницу канала на korea-tv.uk
- «🌐 사이트에서 보기» открывает korea-tv.uk (`/` или `/en/` по языку)
- Прямые ссылки: `t.me/KoreaTVHub_bot/koreatv?startapp=<id канала>`; `?startapp=donate` открывает окно ⭐
- «⭐ 감사하기 / Say thanks»: кнопки в хабе и в плеере, окно 25/50/100/250, `tg.openInvoice` со ссылкой от `GET {BOT_API}/invoice?amount=N`
- Языки ko (по умолчанию) и en
- **Не перенесено из Russia** (специфика их источников): прямые плейлисты (`xhrSetup`), НТВ-native, `PREEMPTIVE_IDS` (оставлен пустым), «📺 На ТВ» через pair-воркер, iframe OK.ru

## Воркер потоков (`korea-worker.js`, v1.6.0, гибрид)
- Маршруты: `/stream?channel=ID`, `/stream-q?channel=ID&q=КБИТ`, `/proxy?url=…&s=…` (подписан HMAC `PROXY_SECRET`), `/version`, `/debug` (с `?url` — только с `key`)
- `DIRECT` (25 каналов, https + CORS у плейлиста и сегментов): плейлисты через воркер, видеосегменты браузер берёт у источника напрямую — как «только плейлисты» у Russia
- Остальные 6 (`arirang_radio`, `kcn`, `mkmoney`, `nhtv`, `nib`, `sbs_ubc` — источник только по http) идут через подписанный `/proxy`; http-сегмент в DIRECT-плейлисте тоже уходит в `/proxy`
- Флаг `d=1` у вложенных плейлистов входит в подпись; неподписанные и поддельные адреса — 403
- Новый канал в `DIRECT` — только после проверки: https и `Access-Control-Allow-Origin` на плейлисте **и** сегментах
- Известно: NHTV через воркер отдаёт 403 на вложенный плейлист (сессия источника привязана к IP, у Cloudflare IP меняются)

## Бот (`bot-worker/korea-bot-worker.js`)
- Синтаксис Service Worker; секреты `BOT_TOKEN`, `WEBHOOK_SECRET`, `ADMIN_IDS` — глобальные переменные
- Webhook принимает только запросы с `X-Telegram-Bot-Api-Secret-Token`; ответ сразу, обработка в `waitUntil`
- Команды: `/start` (+ `start help`, `start donate`), `/help`, `/channels`, `/donate`, `/post`, `/fixpost` (последние две — только `ADMIN_IDS`, только в личке)
- Stars: `sendInvoice` (25/100/500, `XTR`), `answerPreCheckoutQuery`, «감사합니다» на `successful_payment`; `GET /invoice?amount=25|50|100|250` для мини-аппа
- `GET /setup?key=…` — webhook, команды, описания ko/en, кнопка меню (`/set-webhook` — алиас)
- Один список `GROUPS` (31 канал) для `/start`, `/channels`, `/post`: при изменении каналов правится только он
- `bot.js` — запасной polling: загружает код воркера и передаёт ему обновления; не запускать одновременно с воркером

## Сайт korea-tv.uk (репозиторий `korea-tv-uk-website`)
- `assets/player-ui.js`, `quality.js`, `cast.js` — копии из russian-tv.com (строки ko/en и правки описаны в шапке каждого файла); `quality.js` подключён сразу после hls.js, остальные `defer`
- На страницах каналов `CH_ID`, `CH_NAME` и `createHls()` — общий вход для повтора (player-ui) и Cast/AirPlay (cast.js); нативных `controls` у `<video>` нет
- Cast скрыт у 6 http-каналов (тот же список, что вне `DIRECT`): Chromecast сам качает сегменты и требует https + CORS
