import {type FC} from 'react';
import {Cloud, CloudOff} from "lucide-react";

interface SyncStatusProps {
    token: string | null;
    pendingCount: number;
}

const SyncStatus: FC<SyncStatusProps> = ({token, pendingCount}) => {
    return <div className="rounded-xl bg-surface-light border border-border p-4">
        <label className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2 block">
            Синхронизация
        </label>
        <div className="flex items-center gap-2.5">
            {token ? (
                <>
                    <Cloud className="w-4 h-4 text-green"/>
                    <span className="text-sm text-text-secondary">Подключено</span>
                </>
            ) : (
                <>
                    <CloudOff className="w-4 h-4 text-text-muted"/>
                    <span className="text-sm text-text-muted">Токен не задан</span>
                </>
            )}
        </div>
        {pendingCount > 0 && (
            <p className="text-xs text-amber-400 mt-2">
                В очереди: {pendingCount} {pendingCount === 1 ? "запись" : "записей"}
            </p>
        )}
    </div>
}

export default SyncStatus;