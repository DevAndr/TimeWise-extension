// Хранилище активных сессий
interface Session {
  startTime: number;
  url: string;
  title: string | undefined;
}

const activeSessions = new Map<number, Session>(); // tabId -> { startTime, url, title }
let timeData = new Map<string, number>(); // domain -> общее время в мс

// Загрузка сохраненных данных при старте
chrome.storage.local.get(['timeData'], (result: { timeData?: Record<string, number> }) => {
  if (result.timeData) {
    timeData = new Map(Object.entries(result.timeData));
  }
});

// Функция для получения домена из URL
function getDomainFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

// Сохранение времени для текущей вкладки
async function saveCurrentSession(tabId: number) {
  const session = activeSessions.get(tabId);
  if (!session) return;

  const now = Date.now();
  const elapsed = now - session.startTime;

  if (elapsed > 1000) { // Сохраняем только если прошло больше секунды
    const domain = getDomainFromUrl(session.url);
    if (domain) {
      const currentTime = timeData.get(domain) || 0;
      timeData.set(domain, currentTime + elapsed);

      // Сохраняем в chrome.storage
      await chrome.storage.local.set({
        timeData: Object.fromEntries(timeData)
      });

      console.log(`[TimeWise] +${Math.round(elapsed/1000)}s на ${domain}`);
    }
  }

  // Удаляем сессию
  activeSessions.delete(tabId);
}

// Начало отслеживания вкладки
function startTracking(tabId: number, url: string | undefined, title: string | undefined) {
  if (!url || url.startsWith('chrome://')) return;

  // Сохраняем предыдущую сессию для этой вкладки (если была)
  if (activeSessions.has(tabId)) {
    saveCurrentSession(tabId);
  }

  // Начинаем новую сессию
  activeSessions.set(tabId, {
    startTime: Date.now(),
    url: url,
    title: title
  });

  console.log(`[TimeWise] Начал трекать: ${url}`);
}

// Слушаем активацию вкладки (переключение между вкладками)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Сохраняем время для ВСЕХ активных вкладок (на случай, если их было несколько)
  for (const [tabId] of activeSessions.entries()) {
    await saveCurrentSession(tabId);
  }

  // Начинаем трекать новую активную вкладку
  const tab = await chrome.tabs.get(activeInfo.tabId);
  startTracking(activeInfo.tabId, tab.url, tab.title);
});

// Слушаем обновление вкладки (навигация в той же вкладке)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Если это та же вкладка, но новый URL
    if (activeSessions.has(tabId)) {
      saveCurrentSession(tabId);
    }
    startTracking(tabId, tab.url, tab.title);
  }
});

// Слушаем закрытие вкладки
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await saveCurrentSession(tabId);
});

// Обработка idle-режима (пользователь отошел от компа)
chrome.idle.setDetectionInterval(60); // 60 секунд бездействия
chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle' || state === 'locked') {
    // Пользователь отошел - сохраняем все активные сессии
    activeSessions.forEach((_, tabId) => {
      saveCurrentSession(tabId);
    });
  }
});

// При запуске расширения - начинаем трекать текущую вкладку
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0] && tabs[0].id !== undefined) {
    startTracking(tabs[0].id, tabs[0].url, tabs[0].title);
  }
});

// Периодическое сохранение (на всякий случай, каждые 10 секунд)
setInterval(() => {
  activeSessions.forEach((_, tabId) => {
    saveCurrentSession(tabId);
  });
}, 10000);
