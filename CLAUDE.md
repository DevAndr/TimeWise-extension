# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TimeWise is a Chrome extension (Manifest V3) that tracks time spent on websites. It uses a background service worker to monitor active tabs and stores per-domain time data in `chrome.storage.local`. The popup UI displays tracking data. Comments in the codebase are in Russian.

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build:** Vite 8 with `@crxjs/vite-plugin` (CRXJS) for Chrome extension bundling
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Icons:** lucide-react
- **HTTP:** axios
- **Package manager:** yarn (yarn.lock present)

## Commands

- `yarn dev` — Start dev server on port 3000 (CRXJS handles HMR for the extension)
- `yarn build` — TypeScript check + production build (`tsc -b && vite build`)
- `yarn lint` — ESLint
- `yarn preview` — Preview production build

## Architecture

- `src/manifest.ts` — Chrome extension manifest (MV3) defined programmatically via `defineManifest()`. Permissions: storage, tabs, activeTab, clipboardWrite, idle.
- `src/background/background.ts` — Service worker. Tracks active tab sessions using `chrome.tabs` and `chrome.idle` APIs. Stores cumulative per-domain time (ms) in `chrome.storage.local` under key `timeData`. Auto-saves every 10 seconds.
- `src/popup/` — React popup UI. Entry point is `main.tsx` → `App.tsx`. CSS sets popup dimensions to 360px wide, min 480px tall.
- `index.html` — Extension popup HTML entry point, loaded by CRXJS.
- `vite.config.ts` — Wires together React, Tailwind, and CRXJS plugins.

## Development Workflow

To load the extension in Chrome during development:
1. Run `yarn dev`
2. Go to `chrome://extensions`, enable Developer Mode
3. Click "Load unpacked" and select the `dist/` folder


## Архитектура

Расширение для учета сколько времени проводит пользователь на сайтах 
взаимодействие с бэком с помощью axios
использовать токен для апи

## Уведомления

WebSocket (/ws)

Подключение: ws://localhost:3031/ws?token=<api_token>

Клиент подключается с API-токеном в query-параметре. При невалидном токене соединение закрывается с кодом 4003.

Уведомление goal_reached

Когда currentProgress пересекает порог dailyGoal при обработке POST /activities или POST /activities/batch, всем подключённым клиентам с этим токеном отправляется сообщение:

```json
{                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             
    "event": "goal_reached",                                                                                                                                                                                                                                                                                                                                                                                                                                                                  
    "data": {
        "domain": "youtube.com",                                                                                                                                                                                                                                                                                                                                                                                                                                                                  
        "dailyGoal": 7200,                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
        "currentProgress": 7320                                                                                                                                                                                                                                                                                                                                                                                                                                                                   
    }                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           
}
```

Уведомление срабатывает ровно один раз — только при пересечении порога (было < dailyGoal, стало >= dailyGoal).     