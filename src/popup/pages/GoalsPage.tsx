import {useEffect, useState} from "react";
import {useNavigate} from "react-router";
import {ArrowLeft, Target, Plus, Loader2, Trash2, Pencil, X, Check} from "lucide-react";
import {api, getAuthHeaders} from "../../api/axiosInstance";

interface Goal {
    id: string;
    domain: string;
    dailyGoal: number; // секунды
    currentProgress: number; // секунды
}

function formatGoalTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0 && m > 0) return `${h}ч ${m}м`;
    if (h > 0) return `${h}ч`;
    return `${m}м`;
}

function getProgressPercent(current: number, goal: number): number {
    if (goal <= 0) return 0;
    return Math.min(100, Math.round((current / goal) * 100));
}

export function GoalsPage() {
    const navigate = useNavigate();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Форма добавления
    const [showForm, setShowForm] = useState(false);
    const [formDomain, setFormDomain] = useState("");
    const [formHours, setFormHours] = useState("");
    const [formMinutes, setFormMinutes] = useState("");
    const [saving, setSaving] = useState(false);

    // Редактирование
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editHours, setEditHours] = useState("");
    const [editMinutes, setEditMinutes] = useState("");

    async function loadGoals() {
        setLoading(true);
        setError("");
        try {
            const headers = await getAuthHeaders();
            const res = await api.get("/goals", {headers});
            setGoals(res.data);
        } catch {
            setError("Не удалось загрузить цели");
        }
        setLoading(false);
    }

    useEffect(() => {
        loadGoals();
    }, []);

    async function handleAdd() {
        const domain = formDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        const totalSeconds = (parseInt(formHours || "0") * 3600) + (parseInt(formMinutes || "0") * 60);

        if (!domain) return;
        if (totalSeconds < 60) return;

        setSaving(true);
        try {
            const headers = await getAuthHeaders();
            await api.put("/goals", {domain, dailyGoal: totalSeconds}, {headers});
            setFormDomain("");
            setFormHours("");
            setFormMinutes("");
            setShowForm(false);
            await loadGoals();
        } catch {
            setError("Не удалось сохранить цель");
        }
        setSaving(false);
    }

    async function handleEdit(goal: Goal) {
        const totalSeconds = (parseInt(editHours || "0") * 3600) + (parseInt(editMinutes || "0") * 60);
        if (totalSeconds < 60) return;

        setSaving(true);
        try {
            const headers = await getAuthHeaders();
            await api.put("/goals", {domain: goal.domain, dailyGoal: totalSeconds}, {headers});
            setEditingId(null);
            await loadGoals();
        } catch {
            setError("Не удалось обновить цель");
        }
        setSaving(false);
    }

    async function handleDelete(domain: string) {
        try {
            const headers = await getAuthHeaders();
            await api.put("/goals", {domain, dailyGoal: 0}, {headers});
            await loadGoals();
        } catch {
            setError("Не удалось удалить цель");
        }
    }

    function startEdit(goal: Goal) {
        setEditingId(goal.id);
        setEditHours(String(Math.floor(goal.dailyGoal / 3600)));
        setEditMinutes(String(Math.floor((goal.dailyGoal % 3600) / 60)));
    }

    return (
        <div className="flex flex-col h-full">
            <div className="px-5 pt-5 pb-4">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={() => navigate("/")}
                            className="w-8 h-8 rounded-lg bg-surface-light border border-border flex items-center justify-center hover:bg-surface-hover transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 text-text-secondary"/>
                        </button>
                        <h1 className="text-base font-semibold tracking-tight">Цели</h1>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center hover:bg-accent/25 transition-colors"
                    >
                        {showForm
                            ? <X className="w-4 h-4 text-accent-light"/>
                            : <Plus className="w-4 h-4 text-accent-light"/>
                        }
                    </button>
                </div>

                {/* Форма добавления */}
                {showForm && (
                    <div className="rounded-xl bg-surface-light border border-border p-4 mb-3">
                        <label className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2 block">
                            Новая цель
                        </label>
                        <input
                            type="text"
                            value={formDomain}
                            onChange={(e) => setFormDomain(e.target.value)}
                            placeholder="Домен (например youtube.com)"
                            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-colors mb-2"
                        />
                        <div className="flex gap-2 mb-3">
                            <div className="flex-1">
                                <input
                                    type="number"
                                    min="0"
                                    max="23"
                                    value={formHours}
                                    onChange={(e) => setFormHours(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-colors"
                                />
                                <span className="text-xs text-text-muted mt-1 block text-center">часы</span>
                            </div>
                            <div className="flex-1">
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={formMinutes}
                                    onChange={(e) => setFormMinutes(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-colors"
                                />
                                <span className="text-xs text-text-muted mt-1 block text-center">минуты</span>
                            </div>
                        </div>
                        <button
                            onClick={handleAdd}
                            disabled={saving || !formDomain.trim()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent/15 text-accent-light hover:bg-accent/25 transition-all disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : "Добавить"}
                        </button>
                    </div>
                )}

                {error && (
                    <p className="text-xs text-red-400 mb-3">{error}</p>
                )}
            </div>

            {/* Список целей */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-5 pb-5">
                {loading ? (
                    <div className="flex justify-center pt-12">
                        <Loader2 className="w-6 h-6 text-text-muted animate-spin"/>
                    </div>
                ) : goals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-12 gap-3">
                        <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center">
                            <Target className="w-6 h-6 text-text-muted"/>
                        </div>
                        <p className="text-text-muted text-sm text-center">
                            Целей пока нет.<br/>Добавьте лимит для домена.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {goals.map((goal) => {
                            const percent = getProgressPercent(goal.currentProgress, goal.dailyGoal);
                            const isOver = goal.currentProgress >= goal.dailyGoal;
                            const isEditing = editingId === goal.id;

                            return (
                                <div
                                    key={goal.id}
                                    className={`rounded-xl px-3.5 py-3 border transition-all ${
                                        isOver
                                            ? "bg-red-500/5 border-red-500/20"
                                            : "bg-surface-light/60 border-transparent"
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <img
                                                src={`https://www.google.com/s2/favicons?domain=${goal.domain}&sz=32`}
                                                alt=""
                                                className="w-4 h-4 rounded shrink-0"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = "none";
                                                }}
                                            />
                                            <span className="text-sm text-text-secondary truncate">
                                                {goal.domain}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                            {!isEditing && (
                                                <>
                                                    <button
                                                        onClick={() => startEdit(goal)}
                                                        className="w-6 h-6 rounded-md hover:bg-surface-hover flex items-center justify-center transition-colors"
                                                    >
                                                        <Pencil className="w-3 h-3 text-text-muted"/>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(goal.domain)}
                                                        className="w-6 h-6 rounded-md hover:bg-red-500/15 flex items-center justify-center transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3 text-red-400"/>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {isEditing ? (
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="23"
                                                value={editHours}
                                                onChange={(e) => setEditHours(e.target.value)}
                                                className="w-16 bg-surface border border-border rounded-lg px-2 py-1 text-sm text-text-primary outline-none focus:border-accent/50"
                                            />
                                            <span className="text-xs text-text-muted">ч</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max="59"
                                                value={editMinutes}
                                                onChange={(e) => setEditMinutes(e.target.value)}
                                                className="w-16 bg-surface border border-border rounded-lg px-2 py-1 text-sm text-text-primary outline-none focus:border-accent/50"
                                            />
                                            <span className="text-xs text-text-muted">м</span>
                                            <button
                                                onClick={() => handleEdit(goal)}
                                                disabled={saving}
                                                className="w-6 h-6 rounded-md bg-accent/15 hover:bg-accent/25 flex items-center justify-center transition-colors"
                                            >
                                                <Check className="w-3.5 h-3.5 text-accent-light"/>
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="w-6 h-6 rounded-md hover:bg-surface-hover flex items-center justify-center transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5 text-text-muted"/>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-text-muted">
                                                {formatGoalTime(goal.currentProgress)} / {formatGoalTime(goal.dailyGoal)}
                                            </span>
                                            <span className={`text-xs font-medium ${
                                                isOver ? "text-red-400" : "text-accent-light"
                                            }`}>
                                                {percent}%
                                            </span>
                                        </div>
                                    )}

                                    {/* Progress bar */}
                                    <div className="h-1.5 rounded-full bg-border/60 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                isOver ? "bg-red-400" : "bg-accent"
                                            }`}
                                            style={{width: `${Math.min(percent, 100)}%`}}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
