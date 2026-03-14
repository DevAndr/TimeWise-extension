import { useEffect, useRef, useState } from "react";
import { Header } from "../components/Header";
import { DateNav } from "../components/DateNav";
import { TotalCard } from "../components/TotalCard";
import { SiteList } from "../components/SiteList";
import { getDomainFromUrl, getTodayKey, isDomainExcluded } from "../lib/utils";
import type { SiteTime, ActiveSession } from "../lib/types";

export function MainPage() {
  const [sites, setSites] = useState<SiteTime[]>([]);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayKey());

  const baseDataRef = useRef<Record<string, number>>({});
  const sessionRef = useRef<ActiveSession | null>(null);
  const selectedDateRef = useRef(selectedDate);
  const excludedRef = useRef<string[]>([]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
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

      const excluded = excludedRef.current;
      const entries: SiteTime[] = Object.entries(data)
        .filter(([domain]) => !isDomainExcluded(domain, excluded))
        .map(([domain, time]) => ({ domain, time }))
        .sort((a, b) => b.time - a.time);

      setSites(entries);
    }

    const todayKey = getTodayKey();
    const viewingToday = selectedDate === todayKey;

    async function loadData() {
      const exResult = await chrome.storage.local.get("excludedDomains");
      excludedRef.current = (exResult.excludedDomains as string[] | undefined) ?? [];

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
  }, [selectedDate]);

  async function addToExcluded(domain: string) {
    const result = await chrome.storage.local.get("excludedDomains");
    const current = (result.excludedDomains as string[] | undefined) ?? [];
    if (current.includes(domain)) return;
    const updated = [...current, domain];
    await chrome.storage.local.set({ excludedDomains: updated });
    excludedRef.current = updated;
    setSites((prev) => prev.filter((s) => s.domain !== domain));
  }

  const totalTime = sites.reduce((sum, s) => sum + s.time, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-4">
        <Header activeDomain={activeDomain} />
        <DateNav selectedDate={selectedDate} onDateChange={setSelectedDate} />
        <TotalCard totalTime={totalTime} />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 pb-5">
        <SiteList
          sites={sites}
          activeDomain={activeDomain}
          onExclude={addToExcluded}
        />
      </div>
    </div>
  );
}
