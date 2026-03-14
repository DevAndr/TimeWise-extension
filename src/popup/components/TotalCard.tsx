import { Clock } from "lucide-react";
import { formatTimeLabel } from "../lib/utils";

interface TotalCardProps {
  totalTime: number;
}

export function TotalCard({ totalTime }: TotalCardProps) {
  return (
    <div className="rounded-xl bg-surface-light p-4">
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
  );
}
