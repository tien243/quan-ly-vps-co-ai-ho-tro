import { useState, useEffect } from "react";
import { Upload, Download, ShieldCheck, LogOut, RefreshCw, Github, Bot, Key, Check, Link } from "lucide-react";
import { save, open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useStore } from "../store";
import type { TerminalTheme } from "../types";
import Modal from "../components/ui/Modal";
import * as api from "../lib/tauri-api";

const TERMINAL_THEMES: { value: TerminalTheme; label: string }[] = [
  { value: "dracula", label: "Dracula" },
  { value: "nord", label: "Nord" },
  { value: "solarized-dark", label: "Solarized Dark" },
  { value: "monokai", label: "Monokai" },
  { value: "one-dark", label: "One Dark" },
  { value: "github-dark", label: "GitHub Dark" },
];

type SyncAction = "export" | "import" | null;
type GistModal = "connect" | "upload" | "download" | null;

export default function SettingsPage() {
  const { settings, setTheme, setTerminalTheme, setFontSize, refreshHosts, refreshGroups, refreshKeys, refreshSnippets } = useStore();

  // ── File-based sync state ──
  const [syncAction, setSyncAction] = useState<SyncAction>(null);
  const [passphrase, setPassphrase] = useState("");
  const [syncing, setSyncing] = useState(false);

  // ── AI Assistant state ──
  type AiProvider = "gemini" | "openrouter" | "custom_claude" | "custom_openai";
  const AI_PROVIDERS: { id: AiProvider; label: string; placeholder: string; settingsKey: string; hint?: string; baseUrlKey?: string; modelKey?: string; defaultBaseUrl?: string }[] = [
    { id: "gemini",       label: "Gemini (Google)",             placeholder: "AIzaSy...",          settingsKey: "gemini_api_key",      hint: "aistudio.google.com" },
    { id: "openrouter",   label: "OpenRouter",                  placeholder: "sk-or-v1-...",       settingsKey: "openrouter_api_key",  hint: "openrouter.ai/keys" },
    { id: "custom_claude", label: "Custom (Claude-compatible)", placeholder: "API key / Bearer",   settingsKey: "custom_claude_api_key", baseUrlKey: "custom_claude_base_url", modelKey: "custom_claude_model", defaultBaseUrl: "https://api.anthropic.com" },
    { id: "custom_openai", label: "Custom (OpenAI-compatible)", placeholder: "API key (optional)", settingsKey: "custom_openai_api_key", baseUrlKey: "custom_openai_base_url", modelKey: "custom_openai_model", defaultBaseUrl: "http://localhost:11434/v1" },
  ];
  const emptyKeys = { gemini: "", openrouter: "", custom_claude: "", custom_openai: "" } as Record<AiProvider, string>;
  const [aiKeys, setAiKeys] = useState<Record<AiProvider, string>>(emptyKeys);
  const [aiKeyInputs, setAiKeyInputs] = useState<Record<AiProvider, string>>(emptyKeys);
  const [aiKeySaved, setAiKeySaved] = useState<AiProvider | null>(null);
  // Extra config for custom providers
  const [customBaseUrls, setCustomBaseUrls] = useState({ custom_claude: "", custom_openai: "" });
  const [customModels, setCustomModels] = useState({ custom_claude: "", custom_openai: "" });
  const [customConfigSaved, setCustomConfigSaved] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      ...AI_PROVIDERS.map((p) => api.settingsGet(p.settingsKey).catch(() => null)),
      api.settingsGet("custom_claude_base_url").catch(() => null),
      api.settingsGet("custom_openai_base_url").catch(() => null),
      api.settingsGet("custom_claude_model").catch(() => null),
      api.settingsGet("custom_openai_model").catch(() => null),
    ]).then((results) => {
      const [gem, ort, ccKey, coKey, ccUrl, coUrl, ccModel, coModel] = results;
      setAiKeys({ gemini: gem ?? "", openrouter: ort ?? "", custom_claude: ccKey ?? "", custom_openai: coKey ?? "" });
      setCustomBaseUrls({ custom_claude: ccUrl ?? "https://api.anthropic.com", custom_openai: coUrl ?? "http://localhost:11434/v1" });
      setCustomModels({ custom_claude: ccModel ?? "", custom_openai: coModel ?? "" });
    });
  }, []);

  const saveAiKey = async (provider: AiProvider) => {
    const val = aiKeyInputs[provider].trim();
    if (!val) return;
    const settingsKey = AI_PROVIDERS.find((p) => p.id === provider)!.settingsKey;
    await api.settingsSet(settingsKey, val);
    setAiKeys((k) => ({ ...k, [provider]: val }));
    setAiKeyInputs((k) => ({ ...k, [provider]: "" }));
    setAiKeySaved(provider);
    setTimeout(() => setAiKeySaved(null), 2000);
  };

  const saveCustomConfig = async (provider: "custom_claude" | "custom_openai") => {
    const p = AI_PROVIDERS.find((x) => x.id === provider)!;
    if (p.baseUrlKey) await api.settingsSet(p.baseUrlKey, customBaseUrls[provider]);
    if (p.modelKey) await api.settingsSet(p.modelKey, customModels[provider]);
    setCustomConfigSaved(provider);
    setTimeout(() => setCustomConfigSaved(null), 2000);
  };

  const removeAiKey = async (provider: AiProvider) => {
    const settingsKey = AI_PROVIDERS.find((p) => p.id === provider)!.settingsKey;
    await api.settingsSet(settingsKey, "");
    setAiKeys((k) => ({ ...k, [provider]: "" }));
    toast.success("API key removed");
  };

  // ── GitHub Gist sync state ──
  const [gistUsername, setGistUsername] = useState<string | null>(null);
  const [gistModal, setGistModal] = useState<GistModal>(null);
  const [gistToken, setGistToken] = useState("");
  const [gistPassphrase, setGistPassphrase] = useState("");
  const [gistBusy, setGistBusy] = useState(false);

  useEffect(() => {
    api.gistStatus().then(setGistUsername).catch(() => setGistUsername(null));
  }, []);

  const handleGistConnect = async () => {
    if (!gistToken.trim()) { toast.error("Vui lòng nhập Personal Access Token"); return; }
    setGistBusy(true);
    try {
      const username = await api.gistConnect(gistToken.trim());
      setGistUsername(username);
      setGistToken("");
      setGistModal(null);
      toast.success(`Đã kết nối: @${username}`);
    } catch (e) {
      toast.error(`Kết nối thất bại: ${e}`);
    } finally {
      setGistBusy(false);
    }
  };

  const handleGistDisconnect = async () => {
    await api.gistDisconnect().catch(() => {});
    setGistUsername(null);
    toast.success("Đã ngắt kết nối GitHub");
  };

  const handleGistUpload = async () => {
    if (!gistPassphrase) { toast.error("Passphrase is required"); return; }
    setGistBusy(true);
    try {
      await api.gistUpload(gistPassphrase);
      toast.success("Đã sync lên GitHub Gist");
      setGistModal(null); setGistPassphrase("");
    } catch (e) {
      toast.error(`Upload thất bại: ${e}`);
    } finally {
      setGistBusy(false);
    }
  };

  const handleGistDownload = async () => {
    if (!gistPassphrase) { toast.error("Passphrase is required"); return; }
    setGistBusy(true);
    try {
      const stats = await api.gistDownload(gistPassphrase);
      await Promise.all([refreshHosts(), refreshGroups(), refreshKeys(), refreshSnippets()]);
      toast.success(`Đã sync từ Gist: ${stats.hosts} hosts, ${stats.groups} groups, ${stats.keys} keys`);
      setGistModal(null); setGistPassphrase("");
    } catch (e) {
      toast.error(`Download thất bại: ${e}`);
    } finally {
      setGistBusy(false);
    }
  };

  const handleExport = async () => {
    if (!passphrase) { toast.error("Passphrase is required"); return; }
    const dest = await save({ defaultPath: "termius-clone-sync.tcsync", filters: [{ name: "Sync File", extensions: ["tcsync"] }] });
    if (!dest) return;
    setSyncing(true);
    try {
      await api.syncExport(dest, passphrase);
      toast.success("Sync file exported successfully");
      setSyncAction(null);
      setPassphrase("");
    } catch (e) {
      toast.error(`Export failed: ${e}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async () => {
    if (!passphrase) { toast.error("Passphrase is required"); return; }
    const selected = await openDialog({ multiple: false, filters: [{ name: "Sync File", extensions: ["tcsync", "*"] }] });
    if (!selected) return;
    const filePath = typeof selected === "string" ? selected : selected[0];
    setSyncing(true);
    try {
      const stats = await api.syncImport(filePath, passphrase);
      await Promise.all([refreshHosts(), refreshGroups(), refreshKeys(), refreshSnippets()]);
      toast.success(`Imported: ${stats.hosts} hosts, ${stats.groups} groups, ${stats.keys} keys, ${stats.snippets} snippets`);
      setSyncAction(null);
      setPassphrase("");
    } catch (e) {
      toast.error(`Import failed: ${e}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4 py-3 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
        <div className="space-y-6">
          {/* Appearance */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Appearance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-muted-foreground">App color scheme</p>
                </div>
                <div className="flex gap-2">
                  {(["dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
                        settings.theme === t
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="h-px bg-border" />

          {/* Terminal */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Terminal</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Color Theme</p>
                  <p className="text-xs text-muted-foreground">Terminal color scheme</p>
                </div>
                <select
                  value={settings.terminal_theme}
                  onChange={(e) => setTerminalTheme(e.target.value as TerminalTheme)}
                  className="px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                >
                  {TERMINAL_THEMES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Font Size</p>
                  <p className="text-xs text-muted-foreground">Terminal font size: {settings.font_size}px</p>
                </div>
                <input
                  type="range"
                  min={10}
                  max={24}
                  value={settings.font_size}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-32 accent-primary"
                />
              </div>
            </div>
          </section>

          <div className="h-px bg-border" />

          {/* File Sync */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Device Sync</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Export your hosts, SSH keys, snippets, and settings to an encrypted <code className="bg-muted px-1 rounded">.tcsync</code> file.
              Transfer it to another device and import to sync your data. Protected with a passphrase you choose.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setSyncAction("export"); setPassphrase(""); }}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors font-medium"
              >
                <Upload size={14} /> Export
              </button>
              <button
                onClick={() => { setSyncAction("import"); setPassphrase(""); }}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Download size={14} /> Import
              </button>
            </div>
          </section>

          <div className="h-px bg-border" />

          {/* GitHub Gist Sync */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">GitHub Gist Sync</h3>
            {gistUsername ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Github size={15} className="text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">Connected</p>
                    <p className="text-xs text-muted-foreground truncate">@{gistUsername}</p>
                  </div>
                  <button
                    onClick={handleGistDisconnect}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                    title="Disconnect"
                  >
                    <LogOut size={13} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setGistModal("upload"); setGistPassphrase(""); }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors font-medium"
                  >
                    <Upload size={12} /> Sync lên Gist
                  </button>
                  <button
                    onClick={() => { setGistModal("download"); setGistPassphrase(""); }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Download size={12} /> Sync từ Gist
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Đồng bộ dữ liệu VPS giữa các thiết bị qua GitHub Gist (private, miễn phí).
                  Cần GitHub <span className="text-foreground font-medium">Personal Access Token</span> với quyền <code className="bg-muted px-1 rounded">gist</code>.
                </p>
                <a
                  href="https://github.com/settings/tokens/new?scopes=gist&description=TermiusClone+Sync"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Link size={11} /> Tạo token tại github.com/settings/tokens
                </a>
                <button
                  onClick={() => { setGistModal("connect"); setGistToken(""); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors font-medium"
                >
                  <Github size={14} /> Kết nối GitHub
                </button>
              </div>
            )}
          </section>

          <div className="h-px bg-border" />

          {/* AI Assistant */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">AI Assistant</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Configure API keys for the built-in AI chat. Keys are stored locally — never sent to any server other than the respective AI provider.
            </p>
            <div className="space-y-5">
              {AI_PROVIDERS.map((p) => {
                const currentKey = aiKeys[p.id];
                const inputVal = aiKeyInputs[p.id];
                const isSaved = aiKeySaved === p.id;
                const isCustom = p.id === "custom_claude" || p.id === "custom_openai";
                return (
                  <div key={p.id} className="space-y-2 pb-4 border-b border-border last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <Bot size={13} className="text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">{p.label}</span>
                      {currentKey && (
                        <>
                          <span className="text-xs text-muted-foreground font-mono ml-auto">...{currentKey.slice(-6)}</span>
                          <button onClick={() => removeAiKey(p.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Remove</button>
                        </>
                      )}
                    </div>

                    {/* Extra config for custom providers */}
                    {isCustom && (
                      <div className="space-y-2 pl-0">
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Base URL</label>
                          <input
                            type="text"
                            value={customBaseUrls[p.id as "custom_claude" | "custom_openai"]}
                            onChange={(e) => setCustomBaseUrls((u) => ({ ...u, [p.id]: e.target.value }))}
                            placeholder={p.defaultBaseUrl}
                            className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Model name</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={customModels[p.id as "custom_claude" | "custom_openai"]}
                              onChange={(e) => setCustomModels((m) => ({ ...m, [p.id]: e.target.value }))}
                              placeholder={p.id === "custom_claude" ? "claude-3-5-sonnet-20241022" : "llama3.2"}
                              className="flex-1 px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select font-mono"
                            />
                            <button
                              onClick={() => saveCustomConfig(p.id as "custom_claude" | "custom_openai")}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {customConfigSaved === p.id ? <><Check size={13} className="text-green-400" /> Saved!</> : "Save config"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* API key */}
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={inputVal}
                        onChange={(e) => setAiKeyInputs((k) => ({ ...k, [p.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && saveAiKey(p.id)}
                        placeholder={currentKey ? "Replace with new key..." : p.placeholder}
                        className="flex-1 px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select font-mono"
                      />
                      <button
                        onClick={() => saveAiKey(p.id)}
                        disabled={!inputVal.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 transition-colors font-medium"
                      >
                        {isSaved ? <Check size={13} /> : <Key size={13} />}
                        {isSaved ? "Saved!" : currentKey ? "Update" : "Save"}
                      </button>
                    </div>
                    {!currentKey && p.hint && (
                      <p className="text-xs text-muted-foreground pl-0.5">Get key at <span className="text-primary">{p.hint}</span></p>
                    )}
                    {!currentKey && isCustom && p.id === "custom_openai" && (
                      <p className="text-xs text-muted-foreground pl-0.5">API key optional for local models (Ollama, LM Studio)</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="h-px bg-border" />

          {/* About */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">About</h3>
            <div className="space-y-1">
              <p className="text-sm"><span className="text-muted-foreground">App:</span> TermiusClone</p>
              <p className="text-sm"><span className="text-muted-foreground">Version:</span> 0.1.0</p>
              <p className="text-sm"><span className="text-muted-foreground">Built with:</span> Tauri 2.0 + React + Rust</p>
            </div>
          </section>
        </div>
      </div>
    </div>

    {/* File Sync passphrase modal */}
    {syncAction && (
      <Modal
        title={syncAction === "export" ? "Export Sync File" : "Import Sync File"}
        onClose={() => { setSyncAction(null); setPassphrase(""); }}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
            <ShieldCheck size={15} className="text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              {syncAction === "export"
                ? "Your SSH keys and passwords will be encrypted with this passphrase. Keep it safe — you'll need it to import."
                : "Enter the passphrase that was used when the sync file was exported."}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Passphrase</label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") syncAction === "export" ? handleExport() : handleImport(); }}
              placeholder="Enter a strong passphrase"
              autoFocus
              className="w-full px-3 py-2 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setSyncAction(null); setPassphrase(""); }}
              className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={syncAction === "export" ? handleExport : handleImport}
              disabled={syncing || !passphrase}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors disabled:opacity-60"
            >
              {syncing
                ? (syncAction === "export" ? "Exporting..." : "Importing...")
                : (syncAction === "export" ? <><Upload size={13} /> Export</> : <><Download size={13} /> Choose File</>)}
            </button>
          </div>
        </div>
      </Modal>
    )}

    {/* GitHub Gist connect modal */}
    {gistModal === "connect" && (
      <Modal
        title="Kết nối GitHub Gist"
        onClose={() => { setGistModal(null); setGistToken(""); }}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
            <Github size={15} className="text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Nhập GitHub Personal Access Token với quyền <code className="bg-muted px-1 rounded">gist</code>.
              Token được lưu cục bộ, không gửi đi đâu ngoài GitHub API.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Personal Access Token</label>
            <input
              type="password"
              value={gistToken}
              onChange={(e) => setGistToken(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGistConnect(); }}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              autoFocus
              className="w-full px-3 py-2 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setGistModal(null); setGistToken(""); }}
              className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              Huỷ
            </button>
            <button
              onClick={handleGistConnect}
              disabled={gistBusy || !gistToken.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-60 transition-colors"
            >
              {gistBusy ? <RefreshCw size={13} className="animate-spin" /> : <Github size={13} />}
              {gistBusy ? "Đang xác thực..." : "Kết nối"}
            </button>
          </div>
        </div>
      </Modal>
    )}

    {/* Gist upload / download modal */}
    {(gistModal === "upload" || gistModal === "download") && (
      <Modal
        title={gistModal === "upload" ? "Sync lên GitHub Gist" : "Sync từ GitHub Gist"}
        onClose={() => { setGistModal(null); setGistPassphrase(""); }}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
            <ShieldCheck size={15} className="text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              {gistModal === "upload"
                ? "Dữ liệu sẽ được mã hóa AES-256 với passphrase này trước khi upload. Nhớ passphrase để restore trên thiết bị khác."
                : "Nhập passphrase đã dùng khi upload từ thiết bị nguồn."}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Encryption Passphrase</label>
            <input
              type="password"
              value={gistPassphrase}
              onChange={(e) => setGistPassphrase(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") gistModal === "upload" ? handleGistUpload() : handleGistDownload(); }}
              placeholder="Strong passphrase"
              autoFocus
              className="w-full px-3 py-2 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setGistModal(null); setGistPassphrase(""); }}
              className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              Huỷ
            </button>
            <button
              onClick={gistModal === "upload" ? handleGistUpload : handleGistDownload}
              disabled={gistBusy || !gistPassphrase}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-60 transition-colors"
            >
              {gistBusy
                ? <><RefreshCw size={13} className="animate-spin" /> {gistModal === "upload" ? "Uploading..." : "Downloading..."}</>
                : gistModal === "upload"
                  ? <><Upload size={13} /> Sync lên Gist</>
                  : <><Download size={13} /> Sync từ Gist</>}
            </button>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}
