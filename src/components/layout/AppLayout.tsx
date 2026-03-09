import { useStore } from "../../store";
import Sidebar from "./Sidebar";
import TabBar from "../terminal/TabBar";
import TerminalPane from "../terminal/TerminalPane";
import SftpPanel from "../sftp/SftpPanel";
import HostsPage from "../../pages/HostsPage";
import KeysPage from "../../pages/KeysPage";
import SnippetsPage from "../../pages/SnippetsPage";
import SettingsPage from "../../pages/SettingsPage";
import AiChatPage from "../../pages/AiChatPage";
import SnippetsPanel from "../snippets/SnippetsPanel";
import AiPanel from "../ai/AiPanel";

export default function AppLayout() {
  const { tabs, activeTabId, splitTabId, isSplit, splitDirection, showSnippets, showAiPanel, activeView } =
    useStore();

  const hasTerminalTabs = tabs.length > 0;

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const splitTab = isSplit && splitTabId ? tabs.find((t) => t.id === splitTabId) : null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Tab bar - shown when there are terminal/sftp tabs */}
        {hasTerminalTabs && (
          <TabBar />
        )}

        {/* Content area */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left/main content pane */}
          <div className={`flex flex-col flex-1 min-w-0 ${isSplit ? (splitDirection === "horizontal" ? "w-1/2" : "h-1/2") : ""}`}>
            {hasTerminalTabs && activeTab && activeView !== "ai" ? (
              activeTab.type === "sftp" ? (
                <SftpPanel tab={activeTab} />
              ) : (
                <TerminalPane tab={activeTab} />
              )
            ) : (
              // Host manager / other views
              <div className="flex-1 overflow-auto">
                {activeView === "hosts" && <HostsPage />}
                {activeView === "keys" && <KeysPage />}
                {activeView === "snippets" && <SnippetsPage />}
                {activeView === "settings" && <SettingsPage />}
                {activeView === "ai" && <AiChatPage />}
              </div>
            )}
          </div>

          {/* Split divider */}
          {isSplit && splitTab && (
            <div className="w-px bg-border flex-shrink-0" />
          )}

          {/* Split pane */}
          {isSplit && splitTab && (
            <div className={`flex flex-col min-w-0 ${splitDirection === "horizontal" ? "w-1/2" : "w-full h-1/2"}`}>
              {splitTab.type === "sftp" ? (
                <SftpPanel tab={splitTab} />
              ) : (
                <TerminalPane tab={splitTab} />
              )}
            </div>
          )}

          {/* Snippets panel */}
          {showSnippets && activeTab?.type === "terminal" && (
            <>
              <div className="w-px bg-border flex-shrink-0" />
              <SnippetsPanel sessionId={activeTab.session_id} />
            </>
          )}

          {/* AI Panel - sidebar next to terminal */}
          {showAiPanel && activeTab && activeView !== "ai" && (
            <AiPanel />
          )}
        </div>
      </div>
    </div>
  );
}
