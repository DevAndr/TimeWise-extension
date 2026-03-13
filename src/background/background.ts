// Активная сессия хранится в chrome.storage.session, чтобы пережить перезапуск service worker
// timeData хранится в chrome.storage.local (персистентно)
// Синхронизация с бэкендом через API

import { api, getAuthHeaders } from "../api/axiosInstance";

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
      // Сохраняем локально
      const result = await chrome.storage.local.get("timeData");
      const timeData = (result.timeData as Record<string, number> | undefined) ?? {};
      timeData[domain] = (timeData[domain] ?? 0) + elapsed;
      await chrome.storage.local.set({ timeData });

      // Отправляем на бэк
      await recordActivity(domain, session.url, session.title, elapsed, session.startTime);

      console.log(`[TimeWise] flush: +${Math.round(elapsed / 1000)}s на ${domain}`);
    }
  }

  await setActiveSession({ ...session, startTime: now });
}

async function startTracking(tabId: number, url: string | undefined, title?: string) {
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) return;

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

      const timeResult = await chrome.storage.local.get("timeData");
      sendResponse({
        timeData: timeResult.timeData ?? {},
        activeSession: session,
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

// При старте service worker
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  if (tabs[0]?.id !== undefined) {
    await startTracking(tabs[0].id, tabs[0].url, tabs[0].title);
  }
});
