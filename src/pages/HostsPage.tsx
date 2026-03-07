import { useState } from "react";
import { Plus, Search, Server } from "lucide-react";
import { useStore } from "../store";
import HostTree from "../components/hosts/HostTree";
import AddHostDialog from "../components/hosts/AddHostDialog";
import AddGroupDialog from "../components/hosts/AddGroupDialog";

export default function HostsPage() {
  const { hosts, groups } = useStore();
  const [search, setSearch] = useState("");
  const [showAddHost, setShowAddHost] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);

  const isEmpty = hosts.length === 0 && groups.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search hosts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground allow-select"
          />
        </div>
        <button
          onClick={() => setShowAddGroup(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus size={14} />
          Group
        </button>
        <button
          onClick={() => setShowAddHost(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus size={14} />
          New Host
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Server size={28} className="text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No hosts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first SSH host to get started
              </p>
            </div>
            <button
              onClick={() => setShowAddHost(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
            >
              <Plus size={14} />
              Add Host
            </button>
          </div>
        ) : (
          <HostTree searchQuery={search} />
        )}
      </div>

      {showAddHost && (
        <AddHostDialog onClose={() => setShowAddHost(false)} />
      )}
      {showAddGroup && (
        <AddGroupDialog onClose={() => setShowAddGroup(false)} />
      )}
    </div>
  );
}
