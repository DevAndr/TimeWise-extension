// Активная сессия хранится в chrome.storage.session, чтобы пережить перезапуск service worker
// timeData хранится в chrome.storage.local (персистентно)

interface ActiveSession {
  tabId: number;
  startTime: number;
  url: string;
}

function getDomainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Получить активную сессию из storage
async function getActiveSession(): Promise<ActiveSession | null> {
  const result = await chrome.storage.session.get("activeSession");
  return (result.activeSession as ActiveSession | undefined) ?? null;
}

// Сохранить активную сессию в storage
async function setActiveSession(session: ActiveSession | null) {
  if (session) {
    await chrome.storage.session.set({ activeSession: session });
  } else {
    await chrome.storage.session.remove("activeSession");
  }
}

// Накопить время из текущей сессии в timeData
async function flushSession() {
  const session = await getActiveSession();
  if (!session) return;

  const now = Date.now();
  const elapsed = now - session.startTime;

  if (elapsed > 500) {
    const domain = getDomainFromUrl(session.url);
    if (domain) {
      const result = await chrome.storage.local.get("timeData");
      const timeData = (result.timeData as Record<string, number> | undefined) ?? {};
      timeData[domain] = (timeData[domain] ?? 0) + elapsed;
      await chrome.storage.local.set({ timeData });
      console.log(`[TimeWise] flush: +${Math.round(elapsed / 1000)}s на ${domain}`);
    }
  }

  // Сдвигаем startTime на "сейчас", чтобы не считать дважды
  await setActiveSession({ ...session, startTime: now });
}

// Начать трекать вкладку
async function startTracking(tabId: number, url: string | undefined) {
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) return;

  // Сначала сохраняем накопленное время предыдущей сессии
  await flushSession();

  await setActiveSession({ tabId, startTime: Date.now(), url });
}

// Остановить трекинг (idle / закрытие вкладки)
async function stopTracking() {
  await flushSession();
  await setActiveSession(null);
}

// --- Listeners ---

// Переключение между вкладками
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await startTracking(activeInfo.tabId, tab.url);
  } catch {
    // вкладка могла быть уже закрыта
  }
});

// Навигация внутри вкладки
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  // Трекаем только если это активная вкладка
  const session = await getActiveSession();
  if (!session || session.tabId !== tabId) return;

  await startTracking(tabId, tab.url);
});

// Закрытие вкладки
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const session = await getActiveSession();
  if (session && session.tabId === tabId) {
    await stopTracking();
  }
});

// Idle — пользователь отошёл
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === "idle" || state === "locked") {
    await stopTracking();
  } else if (state === "active") {
    // Вернулся — возобновляем трекинг активной вкладки
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id !== undefined) {
      await startTracking(tabs[0].id, tabs[0].url);
    }
  }
});

// Переключение между окнами
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Все окна потеряли фокус (свернули браузер)
    await stopTracking();
    return;
  }
  const tabs = await chrome.tabs.query({ active: true, windowId });
  const tab = tabs[0];
  if (tab?.id !== undefined && tab.url) {
    // Не сбрасываем трекинг для chrome-extension:// (popup) — оставляем текущую сессию
    if (tab.url.startsWith("chrome-extension://")) return;
    await startTracking(tab.id, tab.url);
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

      // Если сессия потерялась (SW перезапустился, focus-событие сбросило) — восстановим
      let session = await getActiveSession();
      if (!session) {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const tab = tabs[0];
        if (tab?.id !== undefined && tab.url && !tab.url.startsWith("chrome")) {
          await setActiveSession({ tabId: tab.id, startTime: Date.now(), url: tab.url });
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

// Alarm — периодический flush каждые 30 секунд (вместо setInterval, который не работает в MV3)
chrome.alarms.create("timewise-flush", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "timewise-flush") {
    await flushSession();
  }
});

// При старте service worker — начать трекать текущую вкладку
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  if (tabs[0]?.id !== undefined) {
    await startTracking(tabs[0].id, tabs[0].url);
  }
});
