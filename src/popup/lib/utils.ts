export function formatTime(ms: number): string {
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

export function formatTimeLabel(ms: number): string {
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

export function getPercent(time: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(2, Math.round((time / max) * 100));
}

export function getDomainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shiftDate(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateLabel(dateKey: string): string {
  const today = getTodayKey();
  if (dateKey === today) return "Сегодня";
  if (dateKey === shiftDate(today, -1)) return "Вчера";

  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function isDomainExcluded(domain: string, excluded: string[]): boolean {
  return excluded.some((ex) => domain === ex || domain.endsWith("." + ex));
}
