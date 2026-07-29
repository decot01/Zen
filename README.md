# Zen

Minimalistic one-finger arcade for mobile web, Telegram Mini App, and GitHub Pages.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Static output lands in `dist/`. Push to `main` deploys it via GitHub Actions (`vite.config.ts` uses `base: './'`).

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Live URL: https://decot01.github.io/Zen/

## Telegram Mini App

Обычная ссылка в чате открывает урезанный браузер — так игра работает плохо. Нужен **Mini App** через бота.

1. Открой [@BotFather](https://t.me/BotFather) → `/newbot` (или возьми существующего бота).
2. `/newapp` → выбери бота → имя/описание → загрузи иконку (опционально).
3. **Web App URL:** `https://decot01.github.io/Zen/`
4. (Опционально) `/setmenubutton` → тот же URL, чтобы кнопка «Play» была внизу чата с ботом.
5. Открой бота в Telegram и запусти Mini App оттуда — не через браузер.

Внутри Mini App игра сама:
- разворачивается на весь экран;
- отключает вертикальный свайп «свернуть/закрыть» (чтобы не мешал hold);
- использует Telegram haptic feedback;
- учитывает safe-area Telegram.

## Play

Hold to attract the orb. Release to coast with inertia. Collect white orbs, avoid red ones.
