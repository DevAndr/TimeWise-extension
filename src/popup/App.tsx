import { useEffect, useState } from "react";
import { Clock, Globe } from "lucide-react";

interface SiteTime {
  domain: string;
  time: number;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  if (minutes > 0) {
    return `${minutes}м ${seconds}с`;
  }
  return `${seconds}с`;
}

function App() {
  const [sites, setSites] = useState<SiteTime[]>([]);

  useEffect(() => {
    chrome.storage.local.get(["timeData"], (result) => {
      if (result.timeData) {
        const entries: SiteTime[] = Object.entries(result.timeData as Record<string, number>)
          .map(([domain, time]) => ({ domain, time }))
          .sort((a, b) => b.time - a.time);
        setSites(entries);
      }
    });
  }, []);

  const totalTime = sites.reduce((sum, s) => sum + s.time, 0);

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-blue-400" />
        <h1 className="text-lg font-semibold">TimeWise</h1>
      </div>

      {totalTime > 0 && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-gray-800 text-sm text-gray-300">
          Всего: <span className="text-white font-medium">{formatTime(totalTime)}</span>
        </div>
      )}

      {sites.length === 0 ? (
        <p className="text-gray-500 text-sm text-center mt-8">
          Пока нет данных. Начните просматривать сайты.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sites.map((site) => (
            <li
              key={site.domain}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-sm truncate">{site.domain}</span>
              </div>
              <span className="text-sm text-gray-400 whitespace-nowrap ml-3 font-mono">
                {formatTime(site.time)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
