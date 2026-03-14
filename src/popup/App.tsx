import { useEffect, useRef, useState } from "react";
import { Clock, Globe, Timer, Settings, Check, Cloud, CloudOff, ArrowLeft, Eye, EyeOff, RefreshCw, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { api, getAuthHeaders } from "../api/axiosInstance";

interface SiteTime {
  domain: string;
  time: number;
}

interface ActiveSession {
  tabId: number;
  startTime: number;
  url: string;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

function formatTimeLabel(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  if (minutes > 0) {
    return `${minutes} мин`;
  }
  return `< 1 мин`;
}

function getPercent(time: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(2, Math.round((time / max) * 100));
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

function shiftDate(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(dateKey: string): string {
  const today = getTodayKey();
  if (dateKey === today) return "Сегодня";
  if (dateKey === shiftDate(today, -1)) return "Вчера";

  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// --- Settings page ---
function SettingsPage({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    chrome.storage.local.get(["apiToken", "pendingQueue"], (result) => {
      setToken((result.apiToken as string) ?? "");
      const queue = (result.pendingQueue as unknown[]) ?? [];
      setPendingCount(queue.length);
    });
  }, []);

  async function handleSave() {
    const trimmed = token.trim();
    if (trimmed) {
      await chrome.storage.local.set({ apiToken: trimmed });
    } else {
      await chrome.storage.local.remove("apiToken");
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);

    try {
      // Flush текущую сессию чтобы данные были актуальны
      try {
        await chrome.runtime.sendMessage({ type: "flush" });
      } catch { /* sw might not be ready */ }

      const result = await chrome.storage.local.get("timeData");
      const allData = (result.timeData as Record<string, Record<string, number>> | undefined) ?? {};
      const allDates = Object.keys(allData);

      if (allDates.length === 0) {
        setSyncResult({ ok: true, message: "Нет данных для синхронизации" });
        setSyncing(false);
        return;
      }

      // Собираем активности по всем дням
      const activities: { domain: string; duration: number; startedAt: string; endedAt: string }[] = [];
      for (const [dateKey, domains] of Object.entries(allData)) {
        const dayEnd = new Date(dateKey + "T23:59:59");
        for (const [domain, timeMs] of Object.entries(domains)) {
          activities.push({
            domain,
            duration: Math.round(timeMs / 1000),
            startedAt: new Date(dayEnd.getTime() - timeMs).toISOString(),
            endedAt: dayEnd.toISOString(),
          });
        }
      }

      const headers = await getAuthHeaders();
      await api.post("/activities/batch", activities, { headers });

      setSyncResult({ ok: true, message: `Отправлено: ${activities.length} сайтов` });

      // Отправляем и pending очередь
      const pendingResult = await chrome.storage.local.get("pendingQueue");
      const queue = (pendingResult.pendingQueue as unknown[]) ?? [];
      if (queue.length > 0) {
        await api.post("/activities/batch", queue, { headers });
        await chrome.storage.local.set({ pendingQueue: [] });
        setPendingCount(0);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка соединения";
      setSyncResult({ ok: false, message });
    }

    setSyncing(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5 mb-5">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-surface-light border border-border flex items-center justify-center hover:bg-surface-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-text-secondary" />
          </button>
          <h1 className="text-base font-semibold tracking-tight">Настройки</h1>
        </div>

        {/* Token input */}
        <div className="rounded-xl bg-surface-light border border-border p-4 mb-3">
          <label className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2 block">
            API Токен
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Вставьте токен..."
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 pr-9 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-colors"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleSave}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                saved
                  ? "bg-green/20 text-green"
                  : "bg-accent/15 text-accent-light hover:bg-accent/25"
              }`}
            >
              {saved ? <Check className="w-4 h-4" /> : "Сохранить"}
            </button>
          </div>
          <p className="text-xs text-text-muted mt-2">
            Получите токен через POST /api-tokens на сервере
          </p>
        </div>

        {/* Sync status */}
        <div className="rounded-xl bg-surface-light border border-border p-4">
          <label className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2 block">
            Синхронизация
          </label>
          <div className="flex items-center gap-2.5">
            {token ? (
              <>
                <Cloud className="w-4 h-4 text-green" />
                <span className="text-sm text-text-secondary">Подключено</span>
              </>
            ) : (
              <>
                <CloudOff className="w-4 h-4 text-text-muted" />
                <span className="text-sm text-text-muted">Токен не задан</span>
              </>
            )}
          </div>
          {pendingCount > 0 && (
            <p className="text-xs text-amber-400 mt-2">
              В очереди: {pendingCount} {pendingCount === 1 ? "запись" : "записей"}
            </p>
          )}
        </div>

        {/* Sync button */}
        <div className="rounded-xl bg-surface-light border border-border p-4 mt-3">
          <label className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2 block">
            Отправить данные на сервер
          </label>
          <p className="text-xs text-text-muted mb-3">
            Отправит все локальные данные на бэкенд через POST /activities/batch
          </p>
          <button
            onClick={handleSync}
            disabled={syncing || !token}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              !token
                ? "bg-surface border border-border text-text-muted cursor-not-allowed"
                : syncing
                  ? "bg-accent/10 text-accent-light cursor-wait"
                  : "bg-accent/15 text-accent-light hover:bg-accent/25"
            }`}
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Синхронизация...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Синхронизировать
              </>
            )}
          </button>
          {syncResult && (
            <p className={`text-xs mt-2 ${syncResult.ok ? "text-green" : "text-red-400"}`}>
              {syncResult.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main page ---
function App() {
  const [page, setPage] = useState<"main" | "settings">("main");
  const [sites, setSites] = useState<SiteTime[]>([]);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayKey());

  const baseDataRef = useRef<Record<string, number>>({});
  const sessionRef = useRef<ActiveSession | null>(null);
  const selectedDateRef = useRef(selectedDate);

  // Синхронизируем ref с состоянием для использования в интервале
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const isToday = selectedDate === getTodayKey();

  useEffect(() => {
    chrome.storage.local.get("apiToken", (result) => {
      setSynced(!!result.apiToken);
    });
  }, [page]);

  useEffect(() => {
    if (page !== "main") return;

    function updateSites(
      baseData: Record<string, number>,
      session: ActiveSession | null
    ) {
      const data = { ...baseData };

      if (session) {
        const domain = getDomainFromUrl(session.url);
        if (domain) {
          const elapsed = Date.now() - session.startTime;
          data[domain] = (data[domain] ?? 0) + elapsed;
        }
      }

      const entries: SiteTime[] = Object.entries(data)
        .map(([domain, time]) => ({ domain, time }))
        .sort((a, b) => b.time - a.time);

      setSites(entries);
    }

    const todayKey = getTodayKey();
    const viewingToday = selectedDate === todayKey;

    async function loadData() {
      let timeData: Record<string, number> = {};
      let session: ActiveSession | null = null;

      try {
        const response = await chrome.runtime.sendMessage({ type: "getData", date: selectedDate });
        timeData = response.timeData ?? {};
        session = response.activeSession ?? null;
      } catch {
        const result = await chrome.storage.local.get("timeData");
        const allData = (result.timeData as Record<string, Record<string, number>>) ?? {};
        timeData = allData[selectedDate] ?? {};
      }

      baseDataRef.current = timeData;
      sessionRef.current = session;
      setActiveDomain(session ? getDomainFromUrl(session.url) : null);
      updateSites(timeData, viewingToday ? session : null);
    }

    loadData();

    const interval = setInterval(() => {
      const showSession = selectedDateRef.current === getTodayKey();
      updateSites(baseDataRef.current, showSession ? sessionRef.current : null);
    }, 1000);

    return () => clearInterval(interval);
  }, [page, selectedDate]);

  if (page === "settings") {
    return <SettingsPage onBack={() => setPage("main")} />;
  }

  const totalTime = sites.reduce((sum, s) => sum + s.time, 0);
  const maxTime = sites.length > 0 ? sites[0].time : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <Timer className="w-4.5 h-4.5 text-accent-light" />
            </div>
            <h1 className="text-base font-semibold tracking-tight">TimeWise</h1>
          </div>
          <div className="flex items-center gap-2">
            {activeDomain && (
              <div className="flex items-center gap-1.5 text-xs text-green">
                <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot" />
                Tracking
              </div>
            )}
            {synced && (
              <Cloud className="w-3.5 h-3.5 text-accent-light" />
            )}
            <button
              onClick={() => setPage("settings")}
              className="w-8 h-8 rounded-lg bg-surface-light border border-border flex items-center justify-center hover:bg-surface-hover transition-colors"
            >
              <Settings className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-between rounded-xl bg-surface-light border border-border px-3 py-2.5 mb-3">
          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            className="w-7 h-7 rounded-lg hover:bg-surface-hover flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-text-secondary" />
          </button>
          <button
            onClick={() => !isToday && setSelectedDate(getTodayKey())}
            className={`text-sm font-medium ${isToday ? "text-text-primary" : "text-accent-light hover:underline"}`}
          >
            {formatDateLabel(selectedDate)}
          </button>
          <button
            onClick={() => !isToday && setSelectedDate(shiftDate(selectedDate, 1))}
            disabled={isToday}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isToday ? "opacity-30 cursor-not-allowed" : "hover:bg-surface-hover"
            }`}
          >
            <ChevronRight className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        {/* Total card */}
        <div className="rounded-xl bg-surface-light border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1">
                Время за день
              </p>
              <p className="text-2xl font-bold tracking-tight text-text-primary">
                {formatTimeLabel(totalTime)}
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-accent-glow flex items-center justify-center">
              <Clock className="w-5 h-5 text-accent-light" />
            </div>
          </div>
        </div>
      </div>

      {/* Sites list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 pb-5">
        {sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-12 gap-3">
            <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center">
              <Globe className="w-6 h-6 text-text-muted" />
            </div>
            <p className="text-text-muted text-sm text-center">
              Пока нет данных.<br />Начните просматривать сайты.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1">
              Сайты
            </p>
            {sites.map((site, index) => {
              const isActive = site.domain === activeDomain;
              return (
                <div
                  key={site.domain}
                  className={`group relative rounded-xl px-3.5 py-3 transition-all duration-200 ${
                    isActive
                      ? "bg-accent-glow border border-accent/20"
                      : "bg-surface-light/60 hover:bg-surface-hover border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs text-text-muted w-4 text-right shrink-0 font-mono">
                        {index + 1}
                      </span>
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`}
                        alt=""
                        className="w-4 h-4 rounded shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <span className={`text-sm truncate ${
                        isActive ? "text-text-primary font-medium" : "text-text-secondary"
                      }`}>
                        {site.domain}
                      </span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot shrink-0" />
                      )}
                    </div>
                    <span className={`text-sm tabular-nums font-mono shrink-0 ml-3 ${
                      isActive ? "text-accent-light font-medium" : "text-text-secondary"
                    }`}>
                      {formatTime(site.time)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="ml-6.5 h-1 rounded-full bg-border/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isActive
                          ? "bg-accent"
                          : "bg-text-muted/40"
                      }`}
                      style={{ width: `${getPercent(site.time, maxTime)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
