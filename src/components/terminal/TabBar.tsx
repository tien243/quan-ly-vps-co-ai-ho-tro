import { X, Terminal, FolderOpen } from "lucide-react";
import { useStore } from "../../store";
import * as api from "../../lib/tauri-api";

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useStore();

  const handleClose = async (tabId: string, sessionId: string) => {
    try {
      await api.sshDisconnect(sessionId);
    } catch {
      // Ignore disconnect errors
    }
    closeTab(tabId);
  };

  return (
    <div className="flex items-center bg-muted/40 border-b border-border overflow-x-auto flex-shrink-0 h-9">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-1.5 px-3 h-full text-sm cursor-pointer border-r border-border flex-shrink-0 group transition-colors ${
            tab.id === activeTabId
              ? "bg-background text-foreground border-b-2 border-b-primary -mb-px"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {tab.type === "sftp" ? (
            <FolderOpen size={13} className="flex-shrink-0" />
          ) : (
            <Terminal size={13} className="flex-shrink-0" />
          )}
          <span className="max-w-[120px] truncate">
            {tab.type === "sftp" ? `SFTP: ${tab.host_label}` : tab.host_label}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose(tab.id, tab.session_id);
            }}
            className="ml-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity rounded p-0.5"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}
