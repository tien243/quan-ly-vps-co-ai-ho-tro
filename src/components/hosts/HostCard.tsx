import { useState } from "react";
import { Server, Plug, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useStore } from "../../store";
import type { Host, Tab } from "../../types";
import * as api from "../../lib/tauri-api";
import ConnectModal from "./ConnectModal";
import EditHostDialog from "./EditHostDialog";
import DeleteConfirm from "../ui/DeleteConfirm";

interface Props {
  host: Host;
  depth?: number;
}

export default function HostCard({ host, depth = 0 }: Props) {
  const { addTab, refreshHosts } = useStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const handleConnect = async (password?: string) => {
    setShowConnect(false);
    const toastId = toast.loading(`Connecting to ${host.label}...`);
    try {
      const result = await api.sshConnect(host.id, password);
      const tab: Tab = {
        id: uuidv4(),
        type: "terminal",
        session_id: result.session_id,
        host_label: result.host_label,
        host_id: host.id,
      };
      addTab(tab);
      toast.success(`Connected to ${host.label}`, { id: toastId });
    } catch (e) {
      toast.error(`Connection failed: ${e}`, { id: toastId });
    }
  };

  const handleConnectClick = () => {
    if (host.auth_type === "password" && !host.password_encrypted) {
      // No saved password — prompt user
      setShowConnect(true);
    } else {
      // Key auth or password already saved — connect directly
      handleConnect();
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteHost(host.id);
      await refreshHosts();
      toast.success("Host deleted");
    } catch (e) {
      toast.error(`Delete failed: ${e}`);
    }
    setShowDelete(false);
  };

  return (
    <>
      <div
        className="group flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted transition-colors cursor-default"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onMouseLeave={() => setShowMenu(false)}
      >
        <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          <Server size={14} className="text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate text-foreground">
            {host.label}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {host.username}@{host.host}:{host.port}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
          >
            <MoreHorizontal size={14} />
          </button>
          <button
            onClick={handleConnectClick}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors font-medium"
          >
            <Plug size={11} />
            Connect
          </button>
        </div>

        {/* Context menu */}
        {showMenu && (
          <div className="absolute right-4 mt-16 z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px]">
            <button
              onClick={() => { setShowEdit(true); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              <Pencil size={13} />
              Edit
            </button>
            <button
              onClick={() => { setShowDelete(true); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        )}
      </div>

      {showConnect && (
        <ConnectModal
          host={host}
          onConnect={handleConnect}
          onClose={() => setShowConnect(false)}
        />
      )}
      {showEdit && (
        <EditHostDialog host={host} onClose={() => setShowEdit(false)} />
      )}
      {showDelete && (
        <DeleteConfirm
          title="Delete Host"
          message={`Delete "${host.label}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </>
  );
}
