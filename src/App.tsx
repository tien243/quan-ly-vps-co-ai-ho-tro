import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import AppLayout from "./components/layout/AppLayout";
import { useStore } from "./store";

export default function App() {
  const { loadAll, settings } = useStore();

  useEffect(() => {
    loadAll();
  }, []);

  // Apply theme class to root
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
  }, [settings.theme]);

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
