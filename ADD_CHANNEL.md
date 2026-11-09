# Добавить, заменить или убрать канал

Канал живёт в **двух репозиториях и шести местах**. Пропустишь одно — получишь битую карточку, неверный счётчик
или страницу без плеера. Порядок важен: сначала воркер (без него нигде не играет), потом всё остальное.

Обозначения: `id` — латиница с `_` (`ebs_plus1`), `slug` — `id` с `-` + `-live` (`ebs-plus1-live`),
логотип — `<slug без -live>.png` (`ebs-plus1.png`).

## 0. Проверить источник (до любых правок)
Берём только **официальные** потоки вещателя, круглосуточные, без токенов в адресе (токен протухнет) и без чужих
зеркал. Источники-кандидаты: сайт вещателя, `iptv-org` (`streams/kr.m3u`).

```bash
curl -sI "<url плейлиста>" | head -5                     # 200, тип mpegurl
curl -s "<url плейлиста>" | head -20                      # мастер или медиаплейлист
curl -sI -H "Origin: https://korea-tv.uk" "<url сегмента .ts/.m4s>" | grep -i "access-control\|HTTP/"
```
Решение по режиму воркера:
- плейлист **и** сегменты по https и с `Access-Control-Allow-Origin` → канал в `DIRECT` (сегменты браузер берёт напрямую)
- иначе (http, нет CORS, привязка к IP) → не в `DIRECT`, всё идёт через подписанный `/proxy`; на сайте такой канал
  попадает в `NO_CAST` (Chromecast не сможет взять сегменты сам)

Отказываемся, если: поток только по расписанию (не 24/7), Cloudflare получает 403/52x, ссылка с одноразовым токеном,
неофициальный рестрим.

## 1. Воркер — `south-korea-tv-hub/korea-worker.js`
- `STREAMS`: `<id>: '<url плейлиста>',` в подходящий раздел
- `DIRECT`: добавить `id`, только если проверка из шага 0 прошла
- Поднять `VERSION` (patch), push в `main` → Workers Builds выкатит сам (~30 с)
- Проверка:
  ```bash
  curl -s https://korea-worker.dyaltd.workers.dev/version          # новая версия, channels +1
  curl -s "https://korea-worker.dyaltd.workers.dev/stream?channel=<id>" | head -20
  ```
  В ответе — плейлист; у DIRECT-каналов сегменты указывают на источник, у остальных — на `/proxy?url=…&s=…`.
  Открыть одну ссылку на сегмент/вложенный плейлист из ответа — должна отдаваться (200)

## 2. Логотип и превью — `korea-tv-uk-website`
- Логотип: найти официальный (сайт вещателя или `iptv-org` `logos.json`), положить как `<id>.png|jpg` в отдельную папку и
  ```bash
  python3 -I tools/normalize_logos.py <папка с исходниками> assets/logos
  ```
  (обрежет поля, уменьшит до 240×120, назовёт `<slug без -live>.png`). Нет логотипа — пропустить, будет текстовый значок
- Превью для соцсетей и Cast (`thumbnails/<slug>.jpg`, 1280×720):
  ```bash
  python3 -I tools/make_thumbnails.py thumbnails <slug> <ICON> "<English name>" '#цвет'
  ```
  Обоим нужен Pillow (`pip install pillow` в venv)

## 3. Мини-апп — `south-korea-tv-hub/index.html`
В нужную группу `CHANNEL_GROUPS`:
```js
{ id:'<id>', name:'<название>', desc:'<короткое описание>', icon:'<2–3 буквы>', color:'#rrggbb', iconBg:'#rrggbb',
  logo:SITE+'/assets/logos/<slug без -live>.png', slug:'<slug>', stream: PROXY+'/stream?channel=<id>' },
```
`logo` не указывать, если логотипа нет. Мини-апп берёт логотип с сайта, поэтому сначала выкатить шаг 2.

## 4. Бот — `south-korea-tv-hub/bot-worker/korea-bot-worker.js`
В `GROUPS` у нужной группы дописать название в `list_ko` и `list_en`, увеличить `n`. После выкладки —
`https://korea-bot-worker.dyaltd.workers.dev/setup?key=<WEBHOOK_SECRET>` (обновит описание бота с новым числом каналов).

## 5. Сайт — `korea-tv-uk-website`
1. **Главные** `index.html` и `en/index.html`, массив `CHANNEL_GROUPS` (строка в нужной группе, ko и en тексты отдельно):
   ```js
   { id:'<id>', name:'<название>', desc:'<описание>', icon:'<ICON>', color:'#rrggbb', iconBg:'#rrggbb22', logo:'/assets/logos/<…>.png', tags:['<тег группы>'] },
   ```
   `tags` — тег группы из `TAG_NAMES`: `intl`, `general`, `ebs`, `public`, `regional`, `religious`, `business`, `music`
   (как у соседних каналов группы)
2. **Заготовки страниц** `<slug>/index.html` и `en/<slug>/index.html`: скопировать страницу похожего канала и заменить
   в ней `<head>` (title, description, canonical, hreflang ko/en, `og:*`, `og:image` → `thumbnails/<slug>.jpg`, JSON-LD),
   текст в `<div class="desc-box">` и вопросы в `<div class="faq-box">`. Остальное сгенерируется
3. **Генерация** (шаблоны russian-tv.com `varenik-ai/russian-tv-site@3df9191`: страница канала `perviy-kanal-live/index.html`,
   категория `novosti/index.html`, страна `russkie-kanaly-v-ssha/index.html`; скачать в папку вне репозитория):
   ```bash
   python3 -I tools/gen_channels.py <путь>/perviy-kanal-live.html .
   python3 -I tools/gen_cat_geo.py <путь>/novosti.html <путь>/russkie-kanaly-v-ssha.html .
   ```
   Первый пересобирает все 2×N страниц каналов (боковой список, похожие каналы, плеер), второй — 8 категорий и 5 страниц по странам.
   Число каналов в текстах страниц каналов и стран скрипты считают сами из `CHANNEL_GROUPS`; проверяют, что групп 8 и ни одна не пуста
4. **Число каналов в остальных текстах** (их генераторы не трогают): `grep -rnE "(^|[^&#0-9])40(개| |<|\")" --include=index.html --include=404.html .`
   (подставь текущее число) — главные (title, meta, JSON-LD, FAQ, счётчик), блог, `404.html`. Заменить на новое.
   Если канал упомянут в SEO-тексте категории («포함된 채널: …»), дописать его туда: генератор сохраняет этот текст как есть
5. **`sitemap.xml`**: две записи `<url>` (ko и en) по образцу соседних, с `xhtml:link` hreflang ko/en/x-default и `lastmod`
6. Канал не в `DIRECT` → добавить `id` в `NO_CAST` в `assets/cast.js` и поднять `?v=` у `cast.js` во всех страницах
   (и в `tools/gen_channels.py`)

## 6. Проверка
- Локально: `python3 -m http.server 8765` в репозитории сайта → главная ko/en, новая страница канала, категория:
  канал играет, логотип виден, консоль без ошибок, ширина 375 px
- Мини-апп локально так же; после push — в Telegram (iPhone и Android): канал играет, `?startapp=<id>` открывает его
- Бот: `/channels` показывает канал, `/start` — новое число

## Заменить поток у существующего канала
Только `STREAMS` в воркере (+ `DIRECT`/`NO_CAST`, если режим поменялся). Остальное не трогать: id и slug остаются.

## Убрать канал
1. Убрать из `STREAMS`/`DIRECT`, `CHANNEL_GROUPS` мини-аппа, `GROUPS` бота, `CHANNEL_GROUPS` главных сайта, `NO_CAST`, `sitemap.xml`
2. Страницы `<slug>/` и `en/<slug>/` **не удалять**, а заменить заглушкой «이 채널은 더 이상 제공되지 않습니다» с
   `noindex, follow`, `canonical` на главную и переходом на главную через 3 с (образец — `natv-live/index.html`).
   Так поисковики и старые ссылки не упираются в 404
3. Перегенерировать сайт (шаг 5.3), поправить число каналов (5.4)
4. Логотип и превью можно оставить
