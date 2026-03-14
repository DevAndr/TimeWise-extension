import { useEffect, useState } from "react";
import { Timer, Settings, Cloud, Target } from "lucide-react";
import { useNavigate } from "react-router";

interface HeaderProps {
  activeDomain: string | null;
}

export function Header({ activeDomain }: HeaderProps) {
  const navigate = useNavigate();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    chrome.storage.local.get("apiToken", (result) => {
      setSynced(!!result.apiToken);
    });
  }, []);

  return (
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
          onClick={() => navigate("/goals")}
          className="w-8 h-8 rounded-lg bg-surface-light flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <Target className="w-4 h-4 text-text-secondary" />
        </button>
        <button
          onClick={() => navigate("/settings")}
          className="w-8 h-8 rounded-lg bg-surface-light flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4 text-text-secondary" />
        </button>
      </div>
    </div>
  );
}
