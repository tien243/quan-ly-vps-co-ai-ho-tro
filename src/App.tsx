import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import { useStore } from "./store";

export default function App() {
  const { loadAll, settings, checkSession, userSession, isCheckingSession } = useStore();

  // Check auth session first
  useEffect(() => {
    checkSession();
  }, []);

  // Load app data after login
  useEffect(() => {
    if (userSession) {
      loadAll();
    }
  }, [userSession]);

  // Apply theme class to root
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
  }, [settings.theme]);

  // Still checking session — show splash
  if (isCheckingSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not logged in — show login page
  if (!userSession) {
    return (
      <>
        <LoginPage />
        <Toaster position="bottom-right" theme={settings.theme} richColors closeButton />
      </>
    );
  }

  // Logged in — show main app
  return (
    <>
      <Routes>
        <Route path="/*" element={<AppLayout />} />
        <Route path="/" element={<Navigate to="/hosts" replace />} />
      </Routes>
      <Toaster
        position="bottom-right"
        theme={settings.theme}
        richColors
        closeButton
      />
    </>
  );
}
