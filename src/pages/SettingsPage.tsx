import { useState, useEffect } from "react";
import { Upload, Download, ShieldCheck, LogIn, LogOut, RefreshCw, Cloud, Bot, Key, Check } from "lucide-react";
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
type GoogleModal = "setup" | "upload" | "download" | null;

export default function SettingsPage() {
  const { settings, setTheme, setTerminalTheme, setFontSize, refreshHosts, refreshGroups, refreshKeys, refreshSnippets } = useStore();

  // ── File-based sync state ──
  const [syncAction, setSyncAction] = useState<SyncAction>(null);
  const [passphrase, setPassphrase] = useState("");
  const [syncing, setSyncing] = useState(false);

  // ── AI Assistant state ──
  type AiProvider = "anthropic" | "openai" | "gemini";
  const AI_PROVIDERS: { id: AiProvider; label: string; placeholder: string; settingsKey: string; hint: string }[] = [
    { id: "anthropic", label: "Claude (Anthropic)", placeholder: "sk-ant-api03-...", settingsKey: "anthropic_api_key", hint: "console.anthropic.com" },
    { id: "openai",    label: "GPT (OpenAI)",       placeholder: "sk-proj-...",       settingsKey: "openai_api_key",    hint: "platform.openai.com/api-keys" },
    { id: "gemini",    label: "Gemini (Google)",    placeholder: "AIzaSy...",         settingsKey: "gemini_api_key",    hint: "aistudio.google.com" },
  ];
  const [aiKeys, setAiKeys] = useState<Record<AiProvider, string>>({ anthropic: "", openai: "", gemini: "" });
  const [aiKeyInputs, setAiKeyInputs] = useState<Record<AiProvider, string>>({ anthropic: "", openai: "", gemini: "" });
  const [aiKeySaved, setAiKeySaved] = useState<AiProvider | null>(null);

  useEffect(() => {
    Promise.all(AI_PROVIDERS.map((p) => api.settingsGet(p.settingsKey).catch(() => null))).then(([ant, oai, gem]) => {
      setAiKeys({ anthropic: ant ?? "", openai: oai ?? "", gemini: gem ?? "" });
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

  const removeAiKey = async (provider: AiProvider) => {
    const settingsKey = AI_PROVIDERS.find((p) => p.id === provider)!.settingsKey;
    await api.settingsSet(settingsKey, "");
    setAiKeys((k) => ({ ...k, [provider]: "" }));
    toast.success("API key removed");
  };

  // ── Google Drive sync state ──
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleModal, setGoogleModal] = useState<GoogleModal>(null);
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googlePassphrase, setGooglePassphrase] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    api.googleStatus().then(setGoogleEmail).catch(() => setGoogleEmail(null));
  }, []);

  const handleGoogleConnect = async () => {
    if (!googleClientId || !googleClientSecret) {
      toast.error("Client ID and Client Secret are required");
      return;
    }
    setGoogleBusy(true);
    try {
      const email = await api.googleAuth(googleClientId, googleClientSecret);
      setGoogleEmail(email);
      setGoogleModal(null);
      setGoogleClientId(""); setGoogleClientSecret("");
      toast.success(`Connected as ${email}`);
    } catch (e) {
      toast.error(`Google auth failed: ${e}`);
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    await api.googleDisconnect().catch(() => {});
    setGoogleEmail(null);
    toast.success("Disconnected from Google");
  };

  const handleGoogleUpload = async () => {
    if (!googlePassphrase) { toast.error("Passphrase is required"); return; }
    setGoogleBusy(true);
    try {
      await api.googleUpload(googlePassphrase);
      toast.success("Synced to Google Drive");
      setGoogleModal(null); setGooglePassphrase("");
    } catch (e) {
      toast.error(`Upload failed: ${e}`);
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleGoogleDownload = async () => {
    if (!googlePassphrase) { toast.error("Passphrase is required"); return; }
    setGoogleBusy(true);
    try {
      const stats = await api.googleDownload(googlePassphrase);
      await Promise.all([refreshHosts(), refreshGroups(), refreshKeys(), refreshSnippets()]);
      toast.success(`Synced from Drive: ${stats.hosts} hosts, ${stats.groups} groups, ${stats.keys} keys`);
      setGoogleModal(null); setGooglePassphrase("");
    } catch (e) {
      toast.error(`Download failed: ${e}`);
    } finally {
      setGoogleBusy(false);
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

          {/* Sync */}
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

          {/* Google Drive Sync */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Google Drive Sync</h3>
            {googleEmail ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Cloud size={15} className="text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">Connected</p>
                    <p className="text-xs text-muted-foreground truncate">{googleEmail}</p>
                  </div>
                  <button onClick={handleGoogleDisconnect} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors" title="Sign out">
                    <LogOut size={13} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setGoogleModal("upload"); setGooglePassphrase(""); }} className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors font-medium">
                    <Upload size={12} /> Sync to Drive
                  </button>
                  <button onClick={() => { setGoogleModal("download"); setGooglePassphrase(""); }} className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors">
                    <Download size={12} /> Sync from Drive
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Sync your data across devices via Google Drive. You need a{" "}
                  <strong>Google Cloud OAuth2 client</strong> (Desktop app type) with the Drive API enabled.
                </p>
                <button onClick={() => setGoogleModal("setup")} className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors font-medium">
                  <LogIn size={14} /> Connect Google Account
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
            <div className="space-y-4">
              {AI_PROVIDERS.map((p) => {
                const currentKey = aiKeys[p.id];
                const inputVal = aiKeyInputs[p.id];
                const isSaved = aiKeySaved === p.id;
                return (
                  <div key={p.id} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Bot size={13} className="text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">{p.label}</span>
                      {currentKey && (
                        <span className="text-xs text-muted-foreground font-mono ml-auto">...{currentKey.slice(-6)}</span>
                      )}
                      {currentKey && (
                        <button onClick={() => removeAiKey(p.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Remove</button>
                      )}
                    </div>
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
                    {!currentKey && (
                      <p className="text-xs text-muted-foreground pl-0.5">Get key at <span className="text-primary">{p.hint}</span></p>
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

    {/* Sync passphrase modal */}

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
    {/* Google Setup Modal */}
    {googleModal === "setup" && (
      <Modal title="Connect Google Account" onClose={() => setGoogleModal(null)} size="md">
        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-md space-y-1">
            <p className="text-xs font-medium text-foreground">How to get credentials:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Go to Google Cloud Console → Create project</li>
              <li>Enable <strong>Google Drive API</strong></li>
              <li>APIs &amp; Services → Credentials → Create <strong>OAuth 2.0 Client ID</strong></li>
              <li>Application type: <strong>Desktop app</strong></li>
              <li>Copy the Client ID and Client Secret below</li>
            </ol>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Client ID</label>
            <input
              value={googleClientId}
              onChange={(e) => setGoogleClientId(e.target.value)}
              placeholder="xxxxxxxxxx.apps.googleusercontent.com"
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Client Secret</label>
            <input
              type="password"
              value={googleClientSecret}
              onChange={(e) => setGoogleClientSecret(e.target.value)}
              placeholder="GOCSPX-..."
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Clicking <em>Sign in</em> will open your browser to authorize the app. A local server on 127.0.0.1 will receive the redirect — no data leaves your machine.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setGoogleModal(null)} className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button onClick={handleGoogleConnect} disabled={googleBusy || !googleClientId || !googleClientSecret} className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-60 transition-colors">
              {googleBusy ? <><RefreshCw size={13} className="animate-spin" /> Waiting...</> : <><LogIn size={13} /> Sign in with Google</>}
            </button>
          </div>
        </div>
      </Modal>
    )}

    {/* Google Upload / Download Modal */}
    {(googleModal === "upload" || googleModal === "download") && (
      <Modal
        title={googleModal === "upload" ? "Sync to Google Drive" : "Sync from Google Drive"}
        onClose={() => { setGoogleModal(null); setGooglePassphrase(""); }}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
            <ShieldCheck size={15} className="text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              {googleModal === "upload"
                ? "Your data will be encrypted with this passphrase before uploading. Keep it safe — you'll need it to restore on another device."
                : "Enter the passphrase used when the data was uploaded from the source device."}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Encryption Passphrase</label>
            <input
              type="password"
              value={googlePassphrase}
              onChange={(e) => setGooglePassphrase(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") googleModal === "upload" ? handleGoogleUpload() : handleGoogleDownload(); }}
              placeholder="Strong passphrase"
              autoFocus
              className="w-full px-3 py-2 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setGoogleModal(null); setGooglePassphrase(""); }} className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button
              onClick={googleModal === "upload" ? handleGoogleUpload : handleGoogleDownload}
              disabled={googleBusy || !googlePassphrase}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-60 transition-colors"
            >
              {googleBusy
                ? <><RefreshCw size={13} className="animate-spin" /> {googleModal === "upload" ? "Uploading..." : "Downloading..."}</>
                : googleModal === "upload"
                  ? <><Upload size={13} /> Sync to Drive</>
                  : <><Download size={13} /> Sync from Drive</>}
            </button>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}
