import { create } from "zustand";
import type {
  Group,
  Host,
  SshKey,
  Snippet,
  Tab,
  AppSettings,
  AppTheme,
  TerminalTheme,
} from "../types";
import * as api from "../lib/tauri-api";
import type { UserSession } from "../lib/tauri-api";

interface AppStore {
  // Data
  groups: Group[];
  hosts: Host[];
  keys: SshKey[];
  snippets: Snippet[];

  // UI state
  tabs: Tab[];
  activeTabId: string | null;
  splitTabId: string | null; // second pane tab
  isSplit: boolean;
  splitDirection: "horizontal" | "vertical";
  showSnippets: boolean;
  showAiPanel: boolean;
  activeView: "hosts" | "keys" | "snippets" | "settings" | "ai";
  aiContext: string | null;
  lastTerminalError: string | null;

  // Auth
  userSession: UserSession | null;
  isCheckingSession: boolean;

  // Settings
  settings: AppSettings;

  // Actions - data
  loadAll: () => Promise<void>;
  refreshHosts: () => Promise<void>;
  refreshGroups: () => Promise<void>;
  refreshKeys: () => Promise<void>;
  refreshSnippets: () => Promise<void>;

  // Actions - tabs
  addTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setSplitTab: (tabId: string | null) => void;
  toggleSplit: (direction?: "horizontal" | "vertical") => void;

  // Actions - UI
  setActiveView: (view: AppStore["activeView"]) => void;
  toggleSnippets: () => void;
  toggleAiPanel: () => void;
  setShowAiPanel: (show: boolean) => void;
  setAiContext: (ctx: string | null) => void;
  setLastTerminalError: (err: string | null) => void;

  // Actions - auth
  checkSession: () => Promise<void>;
  setUserSession: (session: UserSession | null) => void;
  logout: () => Promise<void>;

  // Actions - settings
  setTheme: (theme: AppTheme) => void;
  setTerminalTheme: (theme: TerminalTheme) => void;
  setFontSize: (size: number) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  terminal_theme: "dracula",
  font_size: 14,
};

export const useStore = create<AppStore>((set, get) => ({
  groups: [],
  hosts: [],
  keys: [],
  snippets: [],
  tabs: [],
  activeTabId: null,
  splitTabId: null,
  isSplit: false,
  splitDirection: "horizontal",
  showSnippets: false,
  showAiPanel: false,
  activeView: "hosts",
  aiContext: null,
  lastTerminalError: null,
  settings: DEFAULT_SETTINGS,
  userSession: null,
  isCheckingSession: true,

  loadAll: async () => {
    await Promise.all([
      get().refreshGroups(),
      get().refreshHosts(),
      get().refreshKeys(),
      get().refreshSnippets(),
      get().loadSettings(),
    ]);
  },

  refreshHosts: async () => {
    const hosts = await api.getHosts();
    set({ hosts });
  },

  refreshGroups: async () => {
    const groups = await api.getGroups();
    set({ groups });
  },

  refreshKeys: async () => {
    const keys = await api.getKeys();
    set({ keys });
  },

  refreshSnippets: async () => {
    const snippets = await api.getSnippets();
    set({ snippets });
  },

  addTab: (tab) => {
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }));
  },

  closeTab: (tabId) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== tabId);
      let activeTabId = s.activeTabId;
      let splitTabId = s.splitTabId;

      if (activeTabId === tabId) {
        activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
      }
      if (splitTabId === tabId) {
        splitTabId = null;
      }
      const isSplit = s.isSplit && splitTabId !== null;
      return { tabs, activeTabId, splitTabId, isSplit };
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  setSplitTab: (tabId) =>
    set((s) => ({
      splitTabId: tabId,
      isSplit: tabId !== null && s.isSplit,
    })),

  toggleSplit: (direction) => {
    set((s) => {
      if (!s.isSplit) {
        const otherTab = s.tabs.find((t) => t.id !== s.activeTabId);
        return {
          isSplit: true,
          splitDirection: direction ?? s.splitDirection,
          splitTabId: otherTab?.id ?? s.splitTabId,
        };
      }
      return { isSplit: false, splitTabId: null };
    });
  },

  checkSession: async () => {
    set({ isCheckingSession: true });
    try {
      const session = await api.authCheckSession();
      set({ userSession: session, isCheckingSession: false });
    } catch {
      set({ userSession: null, isCheckingSession: false });
    }
  },

  setUserSession: (session) => set({ userSession: session }),

  logout: async () => {
    await api.authLogout();
    set({ userSession: null });
  },

  setActiveView: (view) => set({ activeView: view }),
  toggleSnippets: () => set((s) => ({ showSnippets: !s.showSnippets })),
  toggleAiPanel: () => set((s) => ({ showAiPanel: !s.showAiPanel })),
  setShowAiPanel: (show) => set({ showAiPanel: show }),
  setAiContext: (ctx) => set({ aiContext: ctx }),
  setLastTerminalError: (err) => set({ lastTerminalError: err }),

  setTheme: (theme) => {
    set((s) => ({ settings: { ...s.settings, theme } }));
    get().saveSettings();
  },

  setTerminalTheme: (terminal_theme) => {
    set((s) => ({ settings: { ...s.settings, terminal_theme } }));
    get().saveSettings();
  },

  setFontSize: (font_size) => {
    set((s) => ({ settings: { ...s.settings, font_size } }));
    get().saveSettings();
  },

  loadSettings: async () => {
    try {
      const raw = await api.settingsGet("app_settings");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        set({ settings: { ...DEFAULT_SETTINGS, ...parsed } });
      }
    } catch {
      // Use defaults
    }
  },

  saveSettings: async () => {
    const { settings } = get();
    await api.settingsSet("app_settings", JSON.stringify(settings));
  },
}));
