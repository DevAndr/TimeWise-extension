import {useEffect, useState, useCallback} from "react";
import {Routes, Route, Navigate} from "react-router";
import {MainPage} from "./pages/MainPage";
import {SettingsPage} from "./pages/SettingsPage";
import {GetStartedPage} from "./pages/GetStartedPage";

function App() {
    const [ready, setReady] = useState(false);
    const [needsOnboarding, setNeedsOnboarding] = useState(false);

    useEffect(() => {
        chrome.storage.local.get(["apiToken", "onboardingDone"], (result) => {
            setNeedsOnboarding(!result.apiToken && !result.onboardingDone);
            setReady(true);
        });
    }, []);

    const completeOnboarding = useCallback(() => {
        setNeedsOnboarding(false);
    }, []);

    if (!ready) return null;

    return (
        <Routes>
            <Route path="/get-started" element={<GetStartedPage onComplete={completeOnboarding}/>}/>
            <Route path="/" element={needsOnboarding ? <Navigate to="/get-started" replace/> : <MainPage/>}/>
            <Route path="/settings" element={<SettingsPage/>}/>
        </Routes>
    );
}

export default App;
