import {useState} from "react";
import {useNavigate} from "react-router";
import {Timer, Eye, EyeOff, Check, ArrowRight, Key, Loader2} from "lucide-react";
import {api} from "../../api/axiosInstance";

interface GetStartedPageProps {
    onComplete: () => void;
}

export function GetStartedPage({onComplete}: GetStartedPageProps) {
    const navigate = useNavigate();
    const [token, setToken] = useState("");
    const [showToken, setShowToken] = useState(false);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");

    async function handleGenerate() {
        setGenerating(true);
        setError("");

        try {
            const response = await api.post("/api-tokens", {
                name: `TimeWise extention - ${Date.now()}`
            });
            const newToken = response.data?.token;

            if (typeof newToken === "string" && newToken) {
                setToken(newToken);
            } else {
                setError("Не удалось получить токен из ответа");
            }
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Ошибка соединения с сервером");
            }
        }

        setGenerating(false);
    }

    async function handleSave() {
        const trimmed = token.trim();
        if (!trimmed) {
            setError("Введите токен");
            return;
        }

        setSaving(true);
        setError("");

        await chrome.storage.local.set({apiToken: trimmed});
        setSaving(false);
        onComplete();
        navigate("/");
    }

    function handleSkip() {
        chrome.storage.local.set({onboardingDone: true});
        onComplete();
        navigate("/");
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col items-center justify-center px-8 py-10">
                {/* Логотип */}
                <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center mb-5">
                    <Timer className="w-8 h-8 text-accent-light"/>
                </div>

                <h1 className="text-xl font-bold tracking-tight text-text-primary mb-1.5">
                    Добро пожаловать
                </h1>
                <p className="text-sm text-text-muted text-center mb-8">
                    Получите или введите API-токен для синхронизации данных с сервером
                </p>

                {/* Получить токен */}
                <div className="w-full mb-4">
                    <button
                        onClick={handleGenerate}
                        disabled={generating || saving}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent/15 text-accent-light hover:bg-accent/25 transition-all disabled:opacity-50"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin"/>
                                Получение...
                            </>
                        ) : (
                            <>
                                <Key className="w-4 h-4"/>
                                Получить токен
                            </>
                        )}
                    </button>
                </div>

                {/* Разделитель */}
                <div className="w-full flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-border"/>
                    <span className="text-xs text-text-muted">или введите вручную</span>
                    <div className="flex-1 h-px bg-border"/>
                </div>

                {/* Поле ввода токена */}
                <div className="w-full mb-4">
                    <label className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2 block">
                        API Токен
                    </label>
                    <div className="relative">
                        <input
                            type={showToken ? "text" : "password"}
                            value={token}
                            onChange={(e) => {
                                setToken(e.target.value);
                                setError("");
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleSave()}
                            placeholder="Вставьте токен..."
                            className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 pr-9 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-colors"
                        />
                        <button
                            onClick={() => setShowToken(!showToken)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                        >
                            {showToken ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                        </button>
                    </div>
                    {error && (
                        <p className="text-xs text-red-400 mt-1.5">{error}</p>
                    )}
                </div>

                {/* Кнопка сохранения */}
                <button
                    onClick={handleSave}
                    disabled={saving || !token.trim()}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        !token.trim()
                            ? "bg-surface border border-border text-text-muted cursor-not-allowed"
                            : "bg-accent/15 text-accent-light hover:bg-accent/25"
                    } disabled:opacity-50`}
                >
                    {saving ? (
                        <Check className="w-4 h-4"/>
                    ) : (
                        <>
                            Начать
                            <ArrowRight className="w-4 h-4"/>
                        </>
                    )}
                </button>
            </div>

            {/* Пропустить */}
            <div className="px-8 pb-6">
                <button
                    onClick={handleSkip}
                    className="w-full text-center text-xs text-text-muted hover:text-text-secondary transition-colors py-2"
                >
                    Пропустить — настрою позже
                </button>
            </div>
        </div>
    );
}
