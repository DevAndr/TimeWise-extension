import {X} from "lucide-react";
import type {FC} from "react";

interface ExcludedDomainListProps {
    excludedDomains: string[]
    removeExcludedDomain: (domain: string) => void
}

const ExcludedDomainList: FC<ExcludedDomainListProps> = ({excludedDomains, removeExcludedDomain}) => {
    return excludedDomains.length > 0 ? (
        <div className="flex flex-col gap-1.5">
            {excludedDomains.map((domain) => (
                <div
                    key={domain}
                    className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 border border-border"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <img
                            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                            alt=""
                            className="w-4 h-4 rounded shrink-0"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                        <span className="text-sm text-text-secondary truncate">{domain}</span>
                    </div>
                    <button
                        onClick={() => removeExcludedDomain(domain)}
                        className="w-6 h-6 rounded-md hover:bg-red-500/15 flex items-center justify-center transition-colors shrink-0"
                    >
                        <X className="w-3.5 h-3.5 text-red-400"/>
                    </button>
                </div>
            ))}
        </div>
    ) : (
        <p className="text-xs text-text-muted text-center py-2">
            Список пуст
        </p>
    )
}

export default ExcludedDomainList;