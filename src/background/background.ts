// Активная сессия хранится в chrome.storage.session, чтобы пережить перезапуск service worker
// timeData хранится в chrome.storage.local (персистентно)
// Формат: { "2026-03-14": { "google.com": 3600000 }, ... }
// Синхронизация с бэкендом через API

import { api, getAuthHeaders } from "../api/axiosInstance";

// Данные по дням: дата (YYYY-MM-DD) → домен → миллисекунды
type TimeData = Record<string, Record<string, number>>;

interface ActiveSession {
  tabId: number;
  startTime: number;
  url: string;
  title?: string;
}

interface PendingActivity {
  domain: string;
  url: string;
  title?: string;
  duration: number; // секунды
  startedAt: string; // ISO
  endedAt: string; // ISO
}

function getDomainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Миграция старого формата Record<string, number> → TimeData
async function migrateIfNeeded() {
  const result = await chrome.storage.local.get("timeData");
  const raw = result.timeData;
  if (!raw || typeof raw !== "object") return;

  // Проверяем, старый ли формат (значения — числа, а не объекты)
  const firstValue = Object.values(raw)[0];
  if (typeof firstValue === "number") {
    const today = getTodayKey();
    const migrated: TimeData = { [today]: raw as Record<string, number> };
    await chrome.storage.local.set({ timeData: migrated });
    console.log("[TimeWise] Migrated timeData to per-day format");
  }
}

// --- Storage helpers ---

async function getActiveSession(): Promise<ActiveSession | null> {
  const result = await chrome.storage.session.get("activeSession");
  return (result.activeSession as ActiveSession | undefined) ?? null;
}

async function setActiveSession(session: ActiveSession | null) {
  if (session) {
    await chrome.storage.session.set({ activeSession: session });
  } else {
    await chrome.storage.session.remove("activeSession");
  }
}

// Очередь неотправленных активностей (на случай если бэк недоступен)
async function getPendingQueue(): Promise<PendingActivity[]> {
  const result = await chrome.storage.local.get("pendingQueue");
  return (result.pendingQueue as PendingActivity[] | undefined) ?? [];
}

async function setPendingQueue(queue: PendingActivity[]) {
  await chrome.storage.local.set({ pendingQueue: queue });
}

// --- Sync с бэкендом ---

async function hasToken(): Promise<boolean> {
  const result = await chrome.storage.local.get("apiToken");
  return !!result.apiToken;
}

async function sendToBackend(activity: PendingActivity) {
  const headers = await getAuthHeaders();
  await api.post("/activities", activity, { headers });
}

// Попытка отправить очередь неотправленных (по одному, batch не поддерживает объекты)
async function flushPendingQueue() {
  if (!(await hasToken())) return;

  const queue = await getPendingQueue();
  if (queue.length === 0) return;

  const headers = await getAuthHeaders();
  const failed: PendingActivity[] = [];
  for (const activity of queue) {
    try {
      await api.post("/activities", activity, { headers });
    } catch {
      failed.push(activity);
    }
  }

  await setPendingQueue(failed);
  const sent = queue.length - failed.length;
  if (sent > 0) {
    console.log(`[TimeWise] Synced ${sent} pending activities`);
  }
  if (failed.length > 0) {
    console.warn(`[TimeWise] ${failed.length} activities still in queue`);
  }
}

// Записать activity и попробовать отправить на бэк
async function recordActivity(
  domain: string,
  url: string,
  title: string | undefined,
  durationMs: number,
  startTime: number
) {
  const durationSec = Math.round(durationMs / 1000);
  if (durationSec < 1) return;

  const activity: PendingActivity = {
    domain,
    url,
    title,
    duration: durationSec,
    startedAt: new Date(startTime).toISOString(),
    endedAt: new Date(startTime + durationMs).toISOString(),
  };

  if (!(await hasToken())) return;

  try {
    await sendToBackend(activity);
    console.log(`[TimeWise] Sent: ${durationSec}s на ${domain}`);
  } catch {
    // Бэк недоступен — сохраняем в очередь
    const queue = await getPendingQueue();
    queue.push(activity);
    await setPendingQueue(queue);
    console.warn(`[TimeWise] Queued: ${durationSec}s на ${domain} (backend unavailable)`);
  }
}

// --- Flush & Track ---

async function flushSession() {
  const session = await getActiveSession();
  if (!session) return;

  const now = Date.now();
  const elapsed = now - session.startTime;

  if (elapsed > 500) {
    const domain = getDomainFromUrl(session.url);
    if (domain) {
      // Сохраняем локально по текущему дню
      const today = getTodayKey();
      const result = await chrome.storage.local.get("timeData");
      const timeData = (result.timeData as TimeData | undefined) ?? {};
      if (!timeData[today]) timeData[today] = {};
      timeData[today][domain] = (timeData[today][domain] ?? 0) + elapsed;
      await chrome.storage.local.set({ timeData });

      // Отправляем на бэк
      await recordActivity(domain, session.url, session.title, elapsed, session.startTime);

      console.log(`[TimeWise] flush: +${Math.round(elapsed / 1000)}s на ${domain}`);
    }
  }

  await setActiveSession({ ...session, startTime: now });
}

async function getExcludedDomains(): Promise<string[]> {
  const result = await chrome.storage.local.get("excludedDomains");
  return (result.excludedDomains as string[] | undefined) ?? [];
}

function isDomainExcluded(domain: string, excludedDomains: string[]): boolean {
  return excludedDomains.some((excluded) => {
    if (domain === excluded) return true;
    // Поддержка поддоменов: исключение "example.com" блокирует "sub.example.com"
    if (domain.endsWith("." + excluded)) return true;
    return false;
  });
}

async function startTracking(tabId: number, url: string | undefined, title?: string) {
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) return;

  const domain = getDomainFromUrl(url);
  if (domain) {
    const excluded = await getExcludedDomains();
    if (isDomainExcluded(domain, excluded)) {
      await stopTracking();
      return;
    }
  }

  await flushSession();
  await setActiveSession({ tabId, startTime: Date.now(), url, title });
}

async function stopTracking() {
  await flushSession();
  await setActiveSession(null);
}

// --- Listeners ---

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await startTracking(activeInfo.tabId, tab.url, tab.title);
  } catch {
    // вкладка могла быть уже закрыта
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  const session = await getActiveSession();
  if (!session || session.tabId !== tabId) return;
  await startTracking(tabId, tab.url, tab.title);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const session = await getActiveSession();
  if (session && session.tabId === tabId) {
    await stopTracking();
  }
});

chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === "idle" || state === "locked") {
    await stopTracking();
  } else if (state === "active") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id !== undefined) {
      await startTracking(tabs[0].id, tabs[0].url, tabs[0].title);
    }
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await stopTracking();
    return;
  }
  const tabs = await chrome.tabs.query({ active: true, windowId });
  const tab = tabs[0];
  if (tab?.id !== undefined && tab.url) {
    if (tab.url.startsWith("chrome-extension://")) return;
    await startTracking(tab.id, tab.url, tab.title);
  }
});

// Сообщения от popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "flush") {
    flushSession().then(() => sendResponse());
    return true;
  }
  if (message.type === "getData") {
    (async () => {
      await flushSession();

      let session = await getActiveSession();
      if (!session) {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const tab = tabs[0];
        if (tab?.id !== undefined && tab.url && !tab.url.startsWith("chrome")) {
          await setActiveSession({ tabId: tab.id, startTime: Date.now(), url: tab.url, title: tab.title });
          session = await getActiveSession();
        }
      }

      const dateKey = message.date ?? getTodayKey();
      const timeResult = await chrome.storage.local.get("timeData");
      const allData = (timeResult.timeData as TimeData | undefined) ?? {};
      const dayData = allData[dateKey] ?? {};

      // Список доступных дат для навигации
      const availableDates = Object.keys(allData).sort();

      sendResponse({
        timeData: dayData,
        activeSession: session,
        date: dateKey,
        availableDates,
      });
    })();
    return true;
  }
});

// Alarm — flush каждые 30 секунд + попытка отправить очередь
chrome.alarms.create("timewise-flush", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "timewise-flush") {
    await flushSession();
    await flushPendingQueue();
  }
});

// --- WebSocket уведомления ---

const WS_BASE_URL = (import.meta.env.VITE_API_WS ?? "ws://192.168.50.233:3031/ws") //"ws://localhost:3031/ws";
const WS_RECONNECT_DELAY = 5000; // 5 секунд между попытками реконнекта

let ws: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function formatGoalTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes} мин`;
}

async function connectWebSocket() {
  // Закрываем предыдущее соединение
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }

  const result = await chrome.storage.local.get("apiToken");
  const token = result.apiToken as string | undefined;
  if (!token) {
    console.log("[TimeWise WS] Нет токена, WebSocket не подключён");
    return;
  }

  const url = `${WS_BASE_URL}?token=${encodeURIComponent(token)}`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("[TimeWise WS] Подключён");
  };

  ws.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data as string);
      console.log("[TimeWise WS] Получено:", message);

      const notifResult = await chrome.storage.local.get("notificationsEnabled");
      if (notifResult.notificationsEnabled === false) return;

      const iconUrl = chrome.runtime.getURL("icon-128.png");
      const { domain, dailyGoal, currentProgress } = message.data ?? {};
      const id = `${message.event}-${domain}-${Date.now()}`;

      switch (message.event) {
        case "goal_halfway":
          chrome.notifications.create(id, {
            type: "basic",
            iconUrl,
            title: `Половина лимита — ${domain}`,
            message: `${formatGoalTime(currentProgress)} из ${formatGoalTime(dailyGoal)} (50%)`,
            priority: 1,
          });
          break;

        case "goal_warning":
          chrome.notifications.create(id, {
            type: "basic",
            iconUrl,
            title: `Приближение к лимиту — ${domain}`,
            message: `${formatGoalTime(currentProgress)} из ${formatGoalTime(dailyGoal)} (80%)`,
            priority: 2,
          });
          break;

        case "goal_reached":
          chrome.notifications.create(id, {
            type: "basic",
            iconUrl,
            title: `Цель достигнута — ${domain}`,
            message: `Вы провели ${formatGoalTime(currentProgress)} из ${formatGoalTime(dailyGoal)}`,
            priority: 2,
          });
          break;

        case "goal_exceeded":
          chrome.notifications.create(id, {
            type: "basic",
            iconUrl,
            title: `Лимит превышен — ${domain}`,
            message: `${formatGoalTime(currentProgress)} из ${formatGoalTime(dailyGoal)} (150%)`,
            priority: 2,
          });
          break;

        case "new_domain":
          chrome.notifications.create(id, {
            type: "basic",
            iconUrl,
            title: "Новый сайт",
            message: `Первое посещение ${domain}`,
            priority: 0,
          });
          break;
      }
    } catch {
      console.warn("[TimeWise WS] Ошибка парсинга:", event.data);
    }
  };

  ws.onclose = (event) => {
    ws = null;
    // Код 4003 — невалидный токен, не реконнектимся
    if (event.code === 4003) {
      console.warn("[TimeWise WS] Невалидный токен, реконнект отменён");
      return;
    }
    console.log("[TimeWise WS] Отключён, реконнект через", WS_RECONNECT_DELAY, "мс");
    scheduleReconnect();
  };

  ws.onerror = () => {
    console.warn("[TimeWise WS] Ошибка соединения");
  };
}

function scheduleReconnect() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    connectWebSocket();
  }, WS_RECONNECT_DELAY);
}

// Переподключаемся при изменении токена
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.apiToken) {
    console.log("[TimeWise WS] Токен изменён, переподключение...");
    connectWebSocket();
  }
});

// При старте service worker — миграция, отслеживание, WebSocket
migrateIfNeeded().then(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0]?.id !== undefined) {
      await startTracking(tabs[0].id, tabs[0].url, tabs[0].title);
    }
  });
  connectWebSocket();
});
