import { useState } from "react";
import { Search, Play, X } from "lucide-react";
import { useStore } from "../../store";
import * as api from "../../lib/tauri-api";
import { toast } from "sonner";

interface Props {
  sessionId: string;
}

export default function SnippetsPanel({ sessionId }: Props) {
  const { snippets, toggleSnippets } = useStore();
  const [search, setSearch] = useState("");

  const filtered = search
    ? snippets.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.command.toLowerCase().includes(search.toLowerCase())
      )
    : snippets;

  const sendSnippet = async (command: string, name: string) => {
    try {
      await api.sshWrite(sessionId, command + "\n");
      toast.success(`Sent: ${name}`);
    } catch (e) {
      toast.error(`Failed to send snippet: ${e}`);
    }
  };

  return (
    <div className="w-64 flex flex-col border-l border-border bg-sidebar flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Snippets</span>
        <button onClick={toggleSnippets} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <X size={13} />
        </button>
      </div>

      <div className="px-2 py-2 border-b border-border">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-7 pr-2 py-1 text-xs bg-muted rounded border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {search ? "No matches" : "No snippets yet"}
          </p>
        ) : (
          filtered.map((snippet) => (
            <div key={snippet.id} className="group flex items-start gap-2 px-2 py-2 hover:bg-muted/60 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{snippet.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{snippet.command}</p>
              </div>
              <button
                onClick={() => sendSnippet(snippet.command, snippet.name)}
                title="Send to terminal"
                className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
              >
                <Play size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
