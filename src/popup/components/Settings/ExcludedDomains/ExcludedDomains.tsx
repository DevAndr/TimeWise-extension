import {useEffect, useState} from "react";
import ExcludedDomainList from "@/popup/components/Settings/ExcludedDomainList.tsx";
import {Ban, Plus} from "lucide-react";

const ExcludedDomains = () => {
    const [excludedDomains, setExcludedDomains] = useState<string[]>([]);
    const [newDomain, setNewDomain] = useState("");

    useEffect(() => {
        chrome.storage.local.get(["excludedDomains"], (result) => {
            setExcludedDomains((result.excludedDomains as string[] | undefined) ?? []);
        });
    }, []);

    function addExcludedDomain() {
        const domain = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        if (!domain || excludedDomains.includes(domain)) return;
        const updated = [...excludedDomains, domain];
        setExcludedDomains(updated);
        chrome.storage.local.set({excludedDomains: updated});
        setNewDomain("");
    }

    function removeExcludedDomain(domain: string) {
        const updated = excludedDomains.filter((d) => d !== domain);
        setExcludedDomains(updated);
        chrome.storage.local.set({excludedDomains: updated});
    }


    return  <div className="rounded-xl bg-surface-light border border-border p-4 mt-3">
        <label className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2 block">
            <div className="flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5"/>
                Исключения
            </div>
        </label>
        <p className="text-xs text-text-muted mb-3">
            Домены из этого списка не будут отслеживаться
        </p>

        <div className="flex gap-2 mb-3">
            <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addExcludedDomain()}
                placeholder="example.com"
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-colors"
            />
            <button
                onClick={addExcludedDomain}
                disabled={!newDomain.trim()}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    !newDomain.trim()
                        ? "bg-surface border border-border text-text-muted cursor-not-allowed"
                        : "bg-accent/15 text-accent-light hover:bg-accent/25"
                }`}
            >
                <Plus className="w-4 h-4"/>
            </button>
        </div>

        <ExcludedDomainList excludedDomains={excludedDomains} removeExcludedDomain={removeExcludedDomain}/>
    </div>
}

export default ExcludedDomains;