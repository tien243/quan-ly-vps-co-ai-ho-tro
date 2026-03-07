import {
  Server,
  Key,
  Terminal,
  Settings,
  Code2,
  ChevronLeft,
  ChevronRight,
  Bot,
} from "lucide-react";
import { useState } from "react";
import { useStore } from "../../store";
import ThemeToggle from "../ui/ThemeToggle";

const NAV_ITEMS = [
  { id: "hosts" as const, icon: Server, label: "Hosts" },
  { id: "keys" as const, icon: Key, label: "SSH Keys" },
  { id: "snippets" as const, icon: Code2, label: "Snippets" },
  { id: "ai" as const, icon: Bot, label: "AI Assistant" },
];

export default function Sidebar() {
  const { activeView, setActiveView } = useStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`flex flex-col h-full border-r border-sidebar-border bg-sidebar transition-all duration-200 ${
        collapsed ? "w-14" : "w-52"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-4 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Terminal size={16} className="text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm text-sidebar-foreground truncate">
            TermiusClone
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2 space-y-0.5 px-1.5">
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            title={collapsed ? label : undefined}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
              activeView === id
                ? "bg-accent/15 text-primary font-medium"
                : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon size={16} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="py-2 px-1.5 border-t border-sidebar-border space-y-0.5">
        <ThemeToggle collapsed={collapsed} />
        <button
          onClick={() => setActiveView("settings")}
          title={collapsed ? "Settings" : undefined}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
            activeView === "settings"
              ? "bg-accent/15 text-primary font-medium"
              : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Settings size={16} className="flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
