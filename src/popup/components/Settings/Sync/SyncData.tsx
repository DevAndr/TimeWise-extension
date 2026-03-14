import {type FC, useState} from "react";
import {Loader2, RefreshCw} from "lucide-react";
import {api, getAuthHeaders} from "@/api/axiosInstance.ts";
import * as React from "react";

interface SyncDataProps {
    token: string | null
    setPendingCount: React.Dispatch<React.SetStateAction<number>>
}

const SyncData: FC<SyncDataProps> = ({token, setPendingCount}) => {
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);

    async function handleSync() {
        setSyncing(true);
        setSyncResult(null);

        try {
            // Flush текущую сессию чтобы данные были актуальны
            try {
                await chrome.runtime.sendMessage({type: "flush"});
            } catch { /* sw might not be ready */
            }

            const result = await chrome.storage.local.get("timeData");
            const allData = (result.timeData as Record<string, Record<string, number>> | undefined) ?? {};
            const allDates = Object.keys(allData);

            if (allDates.length === 0) {
                setSyncResult({ok: true, message: "Нет данных для синхронизации"});
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
            await api.post("/activities/batch", activities, {headers});

            setSyncResult({ok: true, message: `Отправлено: ${activities.length} сайтов`});

            // Отправляем и pending очередь
            const pendingResult = await chrome.storage.local.get("pendingQueue");
            const queue = (pendingResult.pendingQueue as unknown[]) ?? [];
            if (queue.length > 0) {
                await api.post("/activities/batch", queue, {headers});
                await chrome.storage.local.set({pendingQueue: []});
                setPendingCount(0);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Ошибка соединения";
            setSyncResult({ok: false, message});
        }

        setSyncing(false);
    }

    return (
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
                        <Loader2 className="w-4 h-4 animate-spin"/>
                        Синхронизация...
                    </>
                ) : (
                    <>
                        <RefreshCw className="w-4 h-4"/>
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
    );
}

export default SyncData;