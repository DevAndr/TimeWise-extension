import {ArrowLeft} from "lucide-react";
import {useNavigate} from "react-router";

const HeaderSettings = () => {
    const navigate = useNavigate();

    return <div className="flex items-center gap-2.5 mb-5">
        <button
            onClick={() => navigate("/")}
            className="w-8 h-8 rounded-lg bg-surface-light border border-border flex items-center justify-center hover:bg-surface-hover transition-colors"
        >
            <ArrowLeft className="w-4 h-4 text-text-secondary"/>
        </button>
        <h1 className="text-base font-semibold tracking-tight">Настройки</h1>
    </div>
}

export default HeaderSettings;