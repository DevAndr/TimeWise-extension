import { Globe, Ban } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "../../components/ui/context-menu";
import { formatTime, getPercent } from "../lib/utils";
import type { SiteTime } from "../lib/types";

interface SiteListProps {
  sites: SiteTime[];
  activeDomain: string | null;
  onExclude: (domain: string) => void;
}

export function SiteList({ sites, activeDomain, onExclude }: SiteListProps) {
  if (sites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center pt-12 gap-3">
        <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center">
          <Globe className="w-6 h-6 text-text-muted" />
        </div>
        <p className="text-text-muted text-sm text-center">
          Пока нет данных.<br />Начните просматривать сайты.
        </p>
      </div>
    );
  }

  const maxTime = sites[0].time;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1">
        Сайты
      </p>
      {sites.map((site, index) => {
        const isActive = site.domain === activeDomain;
        return (
          <ContextMenu key={site.domain}>
            <ContextMenuTrigger asChild>
              <div
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
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onExclude(site.domain)}>
                <Ban className="w-4 h-4 text-red-400" />
                <span>Добавить в исключения</span>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
