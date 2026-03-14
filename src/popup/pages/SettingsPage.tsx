import {useEffect, useState} from "react";
import {Check, Eye, EyeOff, Bell, BellOff} from "lucide-react";
import ExcludedDomains from "@/popup/components/Settings/ExcludedDomains/ExcludedDomains.tsx";
import SyncData from "@/popup/components/Settings/Sync/SyncData.tsx";
import SyncStatus from "@/popup/components/Settings/Sync/SyncStatus.tsx";
import HeaderSettings from "@/popup/components/Settings/Header/HeaderSettings.tsx";

export function SettingsPage() {
    const [token, setToken] = useState("");
    const [saved, setSaved] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    useEffect(() => {
        chrome.storage.local.get(["apiToken", "pendingQueue", "notificationsEnabled"], (result) => {
            setToken((result.apiToken as string) ?? "");
            const queue = (result.pendingQueue as unknown[]) ?? [];
            setPendingCount(queue.length);
            setNotificationsEnabled(result.notificationsEnabled !== false);
        });
    }, []);

    function toggleNotifications() {
        const newValue = !notificationsEnabled;
        setNotificationsEnabled(newValue);
        chrome.storage.local.set({notificationsEnabled: newValue});
    }


    async function handleSave() {
        const trimmed = token.trim();
        if (trimmed) {
            await chrome.storage.local.set({apiToken: trimmed});
        } else {
            await chrome.storage.local.remove("apiToken");
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    return (
        <div className="flex flex-col h-full">
            <div className="px-5 pt-5 pb-4">
                <HeaderSettings/>

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
                                {showToken ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
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
                            {saved ? <Check className="w-4 h-4"/> : "Сохранить"}
                        </button>
                    </div>
                    <p className="text-xs text-text-muted mt-2">
                        Получите токен через POST /api-tokens на сервере
                    </p>
                </div>

                <SyncStatus token={token} pendingCount={pendingCount}/>
                <SyncData token={token} setPendingCount={setPendingCount}/>

                {/* Уведомления */}
                <div className="rounded-xl bg-surface-light border border-border p-4 mt-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            {notificationsEnabled
                                ? <Bell className="w-4 h-4 text-accent-light"/>
                                : <BellOff className="w-4 h-4 text-text-muted"/>
                            }
                            <div>
                                <p className="text-sm text-text-secondary font-medium">Уведомления</p>
                                <p className="text-xs text-text-muted">Достижение дневных целей</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleNotifications}
                            className={`relative w-10 h-5.5 rounded-full transition-colors ${
                                notificationsEnabled ? "bg-accent" : "bg-border"
                            }`}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                                    notificationsEnabled ? "translate-x-4.5" : "translate-x-0"
                                }`}
                            />
                        </button>
                    </div>
                </div>

                <ExcludedDomains/>
            </div>
        </div>
    );
}
