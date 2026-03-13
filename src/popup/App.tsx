import { useEffect, useRef, useState } from "react";
import { Clock, Globe, Timer } from "lucide-react";

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

function App() {
  const [sites, setSites] = useState<SiteTime[]>([]);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  const baseDataRef = useRef<Record<string, number>>({});
  const sessionRef = useRef<ActiveSession | null>(null);

  useEffect(() => {
    async function loadData() {
      let timeData: Record<string, number> = {};
      let session: ActiveSession | null = null;

      try {
        const response = await chrome.runtime.sendMessage({ type: "getData" });
        timeData = response.timeData ?? {};
        session = response.activeSession ?? null;
      } catch {
        const result = await chrome.storage.local.get("timeData");
        timeData = (result.timeData as Record<string, number>) ?? {};
      }

      baseDataRef.current = timeData;
      sessionRef.current = session;
      setActiveDomain(session ? getDomainFromUrl(session.url) : null);
      updateSites(timeData, session);
    }

    loadData();

    const interval = setInterval(() => {
      updateSites(baseDataRef.current, sessionRef.current);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
          {activeDomain && (
            <div className="flex items-center gap-1.5 text-xs text-green">
              <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot" />
              Tracking
            </div>
          )}
        </div>

        {/* Total card */}
        <div className="rounded-xl bg-surface-light border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1">
                Общее время
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
