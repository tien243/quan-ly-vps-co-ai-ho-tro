import { Unplug, FolderOpen, SplitSquareHorizontal, SplitSquareVertical, Code2, Bot } from "lucide-react";
import { useStore } from "../../store";
import type { Tab } from "../../types";
import * as api from "../../lib/tauri-api";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

interface Props {
  tab: Tab;
  getOutput: () => string;
}

export default function TerminalToolbar({ tab, getOutput }: Props) {
  const { addTab, closeTab, toggleSplit, toggleSnippets, tabs, setAiContext, setActiveView, lastTerminalError } = useStore();

  const handleAskAi = () => {
    const output = getOutput();
    const context = lastTerminalError
      ? `${lastTerminalError}\n\nRecent terminal output:\n${output.replace(/\x1b\[[0-9;]*m/g, "").slice(-800)}`
      : output.replace(/\x1b\[[0-9;]*m/g, "").slice(-800);
    setAiContext(context || `Connected to: ${tab.host_label}`);
    setActiveView("ai");
  };

  const handleDisconnect = async () => {
    try {
      await api.sshDisconnect(tab.session_id);
      closeTab(tab.id);
    } catch (e) {
      toast.error(`Disconnect failed: ${e}`);
    }
  };

  const handleOpenSftp = async () => {
    // Check if SFTP tab already exists for this session
    const existing = tabs.find(
      (t) => t.type === "sftp" && t.session_id === tab.session_id
    );
    if (existing) {
      toast.info("SFTP panel already open for this connection");
      return;
    }
    try {
      await api.sftpOpen(tab.session_id);
      const sftpTab: Tab = {
        id: uuidv4(),
        type: "sftp",
        session_id: tab.session_id,
        host_label: tab.host_label,
        host_id: tab.host_id,
        sftp_path: "/",
      };
      addTab(sftpTab);
      toast.success("SFTP connection opened");
    } catch (e) {
      toast.error(`SFTP failed: ${e}`);
    }
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-muted/20 flex-shrink-0">
      <span className="text-xs text-muted-foreground flex-1 truncate">
        {tab.host_label}
      </span>

      <button
        onClick={handleAskAi}
        title="Ask AI about terminal (sends recent output as context)"
        className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
      >
        <Bot size={14} />
      </button>

      <button
        onClick={toggleSnippets}
        title="Toggle snippets panel"
        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Code2 size={14} />
      </button>

      <button
        onClick={handleOpenSftp}
        title="Open SFTP browser"
        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <FolderOpen size={14} />
      </button>

      <button
        onClick={() => toggleSplit("horizontal")}
        title="Split horizontal"
        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <SplitSquareHorizontal size={14} />
      </button>

      <button
        onClick={() => toggleSplit("vertical")}
        title="Split vertical"
        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <SplitSquareVertical size={14} />
      </button>

      <div className="w-px h-4 bg-border mx-1" />

      <button
        onClick={handleDisconnect}
        title="Disconnect"
        className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
      >
        <Unplug size={14} />
      </button>
    </div>
  );
}
