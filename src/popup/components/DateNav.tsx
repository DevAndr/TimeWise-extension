import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTodayKey, shiftDate, formatDateLabel } from "../lib/utils";

interface DateNavProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function DateNav({ selectedDate, onDateChange }: DateNavProps) {
  const isToday = selectedDate === getTodayKey();

  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-light px-3 py-2.5 mb-3">
      <button
        onClick={() => onDateChange(shiftDate(selectedDate, -1))}
        className="w-7 h-7 rounded-lg hover:bg-surface-hover flex items-center justify-center transition-colors"
      >
        <ChevronLeft className="w-4 h-4 text-text-secondary" />
      </button>
      <button
        onClick={() => !isToday && onDateChange(getTodayKey())}
        className={`text-sm font-medium ${isToday ? "text-text-primary" : "text-accent-light hover:underline"}`}
      >
        {formatDateLabel(selectedDate)}
      </button>
      <button
        onClick={() => !isToday && onDateChange(shiftDate(selectedDate, 1))}
        disabled={isToday}
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
          isToday ? "opacity-30 cursor-not-allowed" : "hover:bg-surface-hover"
        }`}
      >
        <ChevronRight className="w-4 h-4 text-text-secondary" />
      </button>
    </div>
  );
}
