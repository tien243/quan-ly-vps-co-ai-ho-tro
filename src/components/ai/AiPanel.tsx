import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, Send, Trash2, X, Loader2, Key, Copy, Check, Settings2, RefreshCw } from "lucide-react";
import * as api from "../../lib/tauri-api";
import { useStore } from "../../store";

// ── Types ──────────────────────────────────────────────────────────────────

type Provider = "gemini" | "openrouter" | "custom_claude" | "custom_openai";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ProviderConfig {
  label: string;
  shortLabel: string;
  models?: { id: string; label: string }[];
  keyPlaceholder: string;
  settingsKey: string;
  baseUrlKey?: string;
  modelKey?: string;
  defaultBaseUrl?: string;
  baseUrl?: string;
  color: string;
  apiFormat: "anthropic" | "openai" | "gemini";
  needsBaseUrl?: boolean;
  needsCustomModel?: boolean;
  canFetchModels?: boolean;
  hint?: string;
}

// ── Provider definitions ───────────────────────────────────────────────────

const PROVIDERS: Record<Provider, ProviderConfig> = {
  gemini: {
    label: "Gemini (Google)",
    shortLabel: "Gemini",
    models: [
      { id: "gemini-2.5-pro-exp-03-25", label: "Gemini 2.5 Pro — Most powerful" },
      { id: "gemini-2.0-flash",         label: "Gemini 2.0 Flash — Fast" },
      { id: "gemini-2.0-flash-lite",    label: "Gemini 2.0 Flash Lite — Cheapest" },
      { id: "gemini-1.5-pro",           label: "Gemini 1.5 Pro — Stable" },
      { id: "gemini-1.5-flash",         label: "Gemini 1.5 Flash — Stable Fast" },
    ],
    keyPlaceholder: "AIzaSy...",
    settingsKey: "gemini_api_key",
    color: "text-blue-400",
    apiFormat: "gemini",
    canFetchModels: true,
    hint: "aistudio.google.com",
  },
  openrouter: {
    label: "OpenRouter",
    shortLabel: "OpenRouter",
    models: [
      { id: "anthropic/claude-haiku-4-5",        label: "Claude Haiku 4.5" },
      { id: "anthropic/claude-sonnet-4",          label: "Claude Sonnet 4" },
      { id: "openai/gpt-4o-mini",                 label: "GPT-4o Mini" },
      { id: "openai/gpt-4o",                      label: "GPT-4o" },
      { id: "google/gemini-flash-1.5",            label: "Gemini 1.5 Flash" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
      { id: "mistralai/mistral-small",            label: "Mistral Small" },
      { id: "deepseek/deepseek-chat",             label: "DeepSeek Chat" },
    ],
    keyPlaceholder: "sk-or-v1-...",
    settingsKey: "openrouter_api_key",
    color: "text-purple-400",
    apiFormat: "openai",
    canFetchModels: true,
    baseUrl: "https://openrouter.ai/api/v1",
    hint: "openrouter.ai/keys",
  },
  custom_claude: {
    label: "Custom (Claude-compatible)",
    shortLabel: "Custom↗",
    keyPlaceholder: "API key or Bearer token",
    settingsKey: "custom_claude_api_key",
    baseUrlKey: "custom_claude_base_url",
    modelKey: "custom_claude_model",
    defaultBaseUrl: "https://api.anthropic.com",
    color: "text-amber-400",
    apiFormat: "anthropic",
    needsBaseUrl: true,
    needsCustomModel: true,
  },
  custom_openai: {
    label: "Custom (OpenAI-compatible)",
    shortLabel: "Custom⊕",
    keyPlaceholder: "API key (or leave empty)",
    settingsKey: "custom_openai_api_key",
    baseUrlKey: "custom_openai_base_url",
    modelKey: "custom_openai_model",
    defaultBaseUrl: "http://localhost:11434/v1",
    color: "text-cyan-400",
    apiFormat: "openai",
    needsBaseUrl: true,
    needsCustomModel: true,
    canFetchModels: true,
  },
};

const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: "gemini-2.5-pro-exp-03-25",
  openrouter: "anthropic/claude-haiku-4-5",
  custom_claude: "",
  custom_openai: "",
};

const SYSTEM_PROMPT = `You are a DevOps/Linux/SSH expert assistant inside an SSH client app.

Response rules:
- Be direct and concise. No preamble, no filler phrases like "Sure!", "Great question", "Of course".
- Answer ONLY what was asked. Skip background context unless the user asks for it.
- Max 3-5 sentences for explanations. If a command solves it, just give the command.
- Commands: write ONLY the raw command, no shell prompt prefix (no $, #, root@host#). Must be copy-paste ready.
- Use code blocks for all commands and config snippets.
- If multiple steps are needed, use a short numbered list. No sub-bullets.
- Never add warnings, caveats, or "note that..." unless critical for safety.`;

// ── Dynamic model fetch ────────────────────────────────────────────────────

async function fetchGeminiModels(apiKey: string): Promise<{ id: string; label: string }[]> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`
  );
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.models ?? [])
    .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m: any) => ({ id: m.name.replace("models/", ""), label: m.displayName ?? m.name }));
}

async function fetchOpenRouterModels(apiKey: string): Promise<{ id: string; label: string }[]> {
  const resp = await fetch("https://openrouter.ai/api/v1/models", {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.data ?? [])
    .sort((a: any, b: any) => (a.id as string).localeCompare(b.id))
    .map((m: any) => ({ id: m.id, label: m.name || m.id }));
}

async function fetchCustomOpenAIModels(baseUrl: string, apiKey: string): Promise<{ id: string; label: string }[]> {
  const resp = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.data ?? []).map((m: any) => ({ id: m.id, label: m.id }));
}

// ── Streaming helpers ──────────────────────────────────────────────────────

async function streamAnthropic(
  apiKey: string, model: string, messages: Message[],
  onChunk: (t: string) => void,
  baseUrl = "https://api.anthropic.com"
): Promise<void> {
  const resp = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model, max_tokens: 2048, system: SYSTEM_PROMPT, stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as any).error?.message ?? `HTTP ${resp.status}`);
  }
  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value, { stream: true }).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const p = JSON.parse(data);
        if (p.type === "content_block_delta" && p.delta?.type === "text_delta") onChunk(p.delta.text);
      } catch {}
    }
  }
}

async function streamOpenAICompat(
  apiKey: string, model: string, messages: Message[],
  onChunk: (t: string) => void,
  baseUrl = "https://api.openai.com/v1"
): Promise<void> {
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as any).error?.message ?? `HTTP ${resp.status}`);
  }
  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value, { stream: true }).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const p = JSON.parse(data);
        const text = p.choices?.[0]?.delta?.content;
        if (text) onChunk(text);
      } catch {}
    }
  }
}

async function streamGemini(
  apiKey: string, model: string, messages: Message[],
  onChunk: (t: string) => void
): Promise<void> {
  const geminiMessages = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: geminiMessages,
      generationConfig: { maxOutputTokens: 2048 },
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as any).error?.message ?? `HTTP ${resp.status}`);
  }
  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value, { stream: true }).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data) continue;
      try {
        const p = JSON.parse(data);
        const text = p.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onChunk(text);
      } catch {}
    }
  }
}

// ── Markdown rendering ─────────────────────────────────────────────────────

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group mt-1 mb-1">
      <div className="flex items-center justify-between px-2 py-0.5 bg-black/40 rounded-t text-xs text-muted-foreground">
        <span>{lang || "sh"}</span>
        <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-2 py-1.5 bg-black/25 rounded-b text-xs overflow-x-auto allow-select whitespace-pre-wrap break-words">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function InlineText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0; let match: RegExpExecArray | null; let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    const token = match[0];
    if (token.startsWith("`")) {
      parts.push(<code key={key++} className="px-1 py-0.5 bg-black/30 rounded text-xs font-mono">{token.slice(1, -1)}</code>);
    } else {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  return <span className="whitespace-pre-wrap">{parts}</span>;
}

function MessageContent({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0; let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(<InlineText key={lastIndex} text={content.slice(lastIndex, match.index)} />);
    parts.push(<CodeBlock key={match.index} lang={match[1]} code={match[2].trim()} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) parts.push(<InlineText key={lastIndex} text={content.slice(lastIndex)} />);
  return <div className="space-y-0.5">{parts}</div>;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AiPanel() {
  const { aiContext, setAiContext, setShowAiPanel } = useStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState(DEFAULT_MODELS.gemini);

  const [keys, setKeys] = useState<Record<Provider, string>>({
    gemini: "", openrouter: "", custom_claude: "", custom_openai: "",
  });
  const [keyInput, setKeyInput] = useState("");
  const [keySaved, setKeySaved] = useState(false);

  const [baseUrl, setBaseUrl] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [configSaved, setConfigSaved] = useState(false);

  // Dynamic model list
  const [liveModels, setLiveModels] = useState<{ id: string; label: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userChangedProviderRef = useRef(false);
  const cfg = PROVIDERS[provider];
  const activeKey = keys[provider];

  // Shared key-loading function
  const loadKeys = async () => {
    const [gem, ort, ccKey, coKey, ccUrl, coUrl, ccModel, coModel, savedProvider, savedModel] = await Promise.all([
      api.settingsGet("gemini_api_key").catch(() => null),
      api.settingsGet("openrouter_api_key").catch(() => null),
      api.settingsGet("custom_claude_api_key").catch(() => null),
      api.settingsGet("custom_openai_api_key").catch(() => null),
      api.settingsGet("custom_claude_base_url").catch(() => null),
      api.settingsGet("custom_openai_base_url").catch(() => null),
      api.settingsGet("custom_claude_model").catch(() => null),
      api.settingsGet("custom_openai_model").catch(() => null),
      api.settingsGet("ai_provider").catch(() => null),
      api.settingsGet("ai_model").catch(() => null),
    ]);
    setKeys({ gemini: gem ?? "", openrouter: ort ?? "", custom_claude: ccKey ?? "", custom_openai: coKey ?? "" });
    if (savedProvider && savedProvider in PROVIDERS) {
      const p = savedProvider as Provider;
      setProvider(p);
      setModel(savedModel ?? DEFAULT_MODELS[p]);
      if (p === "custom_claude") {
        setBaseUrl(ccUrl ?? PROVIDERS.custom_claude.defaultBaseUrl!);
        setCustomModel(ccModel ?? "");
      } else if (p === "custom_openai") {
        setBaseUrl(coUrl ?? PROVIDERS.custom_openai.defaultBaseUrl!);
        setCustomModel(coModel ?? "");
      }
    } else {
      if (provider === "custom_claude") {
        setBaseUrl(ccUrl ?? PROVIDERS.custom_claude.defaultBaseUrl ?? "");
        setCustomModel(ccModel ?? "");
      } else if (provider === "custom_openai") {
        setBaseUrl(coUrl ?? PROVIDERS.custom_openai.defaultBaseUrl ?? "");
        setCustomModel(coModel ?? "");
      }
    }
  };

  useEffect(() => { loadKeys(); }, []);
  useEffect(() => { if (showConfig) loadKeys(); }, [showConfig]);

  useEffect(() => {
    if (cfg.needsCustomModel) {
      const loadCustom = async () => {
        const [url, mdl] = await Promise.all([
          cfg.baseUrlKey ? api.settingsGet(cfg.baseUrlKey).catch(() => null) : Promise.resolve(null),
          cfg.modelKey ? api.settingsGet(cfg.modelKey).catch(() => null) : Promise.resolve(null),
        ]);
        setBaseUrl(url ?? cfg.defaultBaseUrl ?? "");
        setCustomModel(mdl ?? "");
      };
      loadCustom();
    } else if (userChangedProviderRef.current) {
      setModel(DEFAULT_MODELS[provider]);
    }
    userChangedProviderRef.current = false;
    api.settingsSet("ai_provider", provider).catch(() => {});
  }, [provider]);

  useEffect(() => {
    if (!cfg.needsCustomModel) api.settingsSet("ai_model", model).catch(() => {});
  }, [model]);

  useEffect(() => {
    if (cfg.modelKey) api.settingsSet(cfg.modelKey, customModel).catch(() => {});
  }, [customModel, provider]);

  useEffect(() => {
    if (cfg.baseUrlKey && baseUrl) api.settingsSet(cfg.baseUrlKey, baseUrl).catch(() => {});
  }, [baseUrl, provider]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (aiContext) {
      setInput(`I got this error in my SSH session:\n\`\`\`\n${aiContext}\n\`\`\`\nWhat does this mean and how do I fix it?`);
      setShowConfig(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [aiContext]);

  // Fetch live models
  const doFetchModels = useCallback(async () => {
    if (!cfg.canFetchModels) return;
    const key = keys[provider];
    if (!key && provider !== "custom_openai") return;
    setLoadingModels(true);
    try {
      let models: { id: string; label: string }[] = [];
      if (provider === "gemini") {
        models = await fetchGeminiModels(key);
      } else if (provider === "openrouter") {
        models = await fetchOpenRouterModels(key);
      } else if (provider === "custom_openai") {
        const url = baseUrl || cfg.defaultBaseUrl!;
        models = await fetchCustomOpenAIModels(url, key);
      }
      setLiveModels(models);
    } catch {
      setLiveModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [provider, keys, baseUrl]);

  useEffect(() => {
    setLiveModels([]);
    doFetchModels();
  }, [provider, activeKey]);

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    const newKey = keyInput.trim();
    await api.settingsSet(cfg.settingsKey, newKey);
    setKeys((k) => ({ ...k, [provider]: newKey }));
    setKeyInput("");
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 1500);
  };

  const saveConfig = async () => {
    if (cfg.baseUrlKey && baseUrl.trim()) await api.settingsSet(cfg.baseUrlKey, baseUrl.trim());
    if (cfg.modelKey && customModel.trim()) await api.settingsSet(cfg.modelKey, customModel.trim());
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 1500);
  };

  const removeKey = async () => {
    await api.settingsSet(cfg.settingsKey, "");
    setKeys((k) => ({ ...k, [provider]: "" }));
    setLiveModels([]);
  };

  const getEffectiveModel = () => cfg.needsCustomModel ? customModel : model;

  const sendMessage = async () => {
    const text = input.trim();
    const effectiveKey = activeKey;
    const effectiveModel = getEffectiveModel();
    if (!text || loading || !canSend) return;

    const userMsg: Message = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setAiContext(null);
    setLoading(true);

    let fullText = "";
    const onChunk = (chunk: string) => {
      fullText += chunk;
      setMessages([...history, { role: "assistant", content: fullText }]);
    };

    try {
      switch (cfg.apiFormat) {
        case "anthropic":
          await streamAnthropic(effectiveKey, effectiveModel, history, onChunk,
            cfg.needsBaseUrl ? (baseUrl || cfg.defaultBaseUrl) : undefined);
          break;
        case "openai":
          await streamOpenAICompat(effectiveKey, effectiveModel, history, onChunk,
            cfg.needsBaseUrl ? (baseUrl || cfg.defaultBaseUrl) : cfg.baseUrl);
          break;
        case "gemini":
          await streamGemini(effectiveKey, effectiveModel, history, onChunk);
          break;
      }
      if (!fullText) setMessages([...history, { role: "assistant", content: "(No response)" }]);
    } catch (e: any) {
      setMessages([...history, { role: "assistant", content: `**Error:** ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const hasKey = !!(activeKey || provider === "custom_openai");
  const canSend = hasKey && (!cfg.needsCustomModel || !!customModel);
  const displayModels = liveModels.length > 0 ? liveModels : (cfg.models ?? []);

  return (
    <div className="flex flex-col h-full w-[360px] flex-shrink-0 border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-border flex-shrink-0 gap-2">
        <Bot size={14} className={`flex-shrink-0 ${cfg.color}`} />
        <span className="text-xs font-semibold flex-1">AI Assistant</span>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} title="Clear chat" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Trash2 size={12} />
          </button>
        )}
        <button onClick={() => setShowConfig((v) => !v)} title="Configure provider" className={`p-1 rounded transition-colors ${showConfig ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>
          <Settings2 size={12} />
        </button>
        <button onClick={() => setShowAiPanel(false)} title="Close AI panel" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <X size={12} />
        </button>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div className="border-b border-border bg-muted/20 p-3 space-y-3 flex-shrink-0">
          {/* Provider selector */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Provider</label>
            <select
              value={provider}
              onChange={(e) => { userChangedProviderRef.current = true; setProvider(e.target.value as Provider); }}
              className="w-full px-2 py-1.5 text-xs bg-muted rounded border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
            >
              <optgroup label="Direct API">
                <option value="gemini">Gemini (Google)</option>
              </optgroup>
              <optgroup label="Aggregator">
                <option value="openrouter">OpenRouter</option>
              </optgroup>
              <optgroup label="Custom Endpoint">
                <option value="custom_claude">Custom (Claude-compatible)</option>
                <option value="custom_openai">Custom (OpenAI-compatible)</option>
              </optgroup>
            </select>
          </div>

          {/* Model selector */}
          {!cfg.needsCustomModel && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Model</label>
                {cfg.canFetchModels && (
                  <button
                    onClick={doFetchModels}
                    disabled={loadingModels || (!activeKey && provider !== "custom_openai")}
                    title={liveModels.length > 0 ? `${liveModels.length} models — refresh` : "Fetch model list"}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    {loadingModels
                      ? <Loader2 size={10} className="animate-spin" />
                      : <RefreshCw size={10} className={liveModels.length > 0 ? "text-green-400" : ""} />
                    }
                    {liveModels.length > 0 ? `${liveModels.length} models` : "Fetch"}
                  </button>
                )}
              </div>
              <input
                type="text"
                list={`panel-model-list-${provider}`}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Type or pick a model ID..."
                className="w-full px-2 py-1.5 text-xs bg-muted rounded border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select font-mono"
              />
              <datalist id={`panel-model-list-${provider}`}>
                {displayModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </datalist>
            </div>
          )}

          {/* Custom provider config */}
          {cfg.needsCustomModel && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={cfg.defaultBaseUrl}
                  className="w-full px-2 py-1.5 text-xs bg-muted rounded border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select font-mono"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Model name</label>
                  {cfg.canFetchModels && (
                    <button
                      onClick={doFetchModels}
                      disabled={loadingModels}
                      title="Fetch models from endpoint"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      {loadingModels
                        ? <Loader2 size={10} className="animate-spin" />
                        : <RefreshCw size={10} className={liveModels.length > 0 ? "text-green-400" : ""} />
                      }
                      {liveModels.length > 0 ? `${liveModels.length} models` : "Fetch"}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  list="panel-custom-model-list"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder={provider === "custom_claude" ? "claude-3-5-sonnet-20241022" : "llama3.2"}
                  className="w-full px-2 py-1.5 text-xs bg-muted rounded border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select font-mono"
                />
                {liveModels.length > 0 && (
                  <datalist id="panel-custom-model-list">
                    {liveModels.map((m) => <option key={m.id} value={m.id} />)}
                  </datalist>
                )}
              </div>
              <button
                onClick={saveConfig}
                className="w-full py-1 text-xs rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-colors flex items-center justify-center gap-1"
              >
                {configSaved ? <><Check size={10} className="text-green-400" /> Saved!</> : "Save endpoint config"}
              </button>
            </>
          )}

          {/* API Key */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">
                API Key {provider === "custom_openai" && <span className="text-muted-foreground/60">(optional)</span>}
              </label>
              {activeKey && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">...{activeKey.slice(-6)}</span>
                  <button onClick={removeKey} className="text-xs text-destructive hover:text-destructive/80 transition-colors">Remove</button>
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveKey(); }}
                placeholder={activeKey ? "Replace key..." : cfg.keyPlaceholder}
                className="flex-1 px-2 py-1.5 text-xs bg-muted rounded border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select font-mono"
              />
              <button
                onClick={saveKey}
                disabled={!keyInput.trim()}
                className="px-2.5 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {keySaved ? <Check size={10} /> : <Key size={10} />}
                {keySaved ? "Saved!" : "Save"}
              </button>
            </div>
            {cfg.hint && !activeKey && (
              <p className="text-xs text-muted-foreground">Get key at <span className={cfg.color}>{cfg.hint}</span></p>
            )}
          </div>
        </div>
      )}

      {/* Terminal context banner */}
      {aiContext && !showConfig && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 flex-shrink-0">
          <span className="text-xs text-amber-500 flex-1">Terminal error captured — press Enter to ask AI</span>
          <button onClick={() => { setAiContext(null); setInput(""); }} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <X size={11} />
          </button>
        </div>
      )}

      {/* Not configured banner */}
      {!hasKey && !showConfig && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border flex-shrink-0">
          <span className="text-xs text-muted-foreground flex-1">No API key configured</span>
          <button onClick={() => setShowConfig(true)} className="text-xs text-primary hover:text-primary/80 transition-colors">Configure</button>
        </div>
      )}

      {/* Custom provider: model missing */}
      {hasKey && !canSend && cfg.needsCustomModel && !showConfig && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 flex-shrink-0">
          <span className="text-xs text-amber-500 flex-1">Enter a model name in config to start chatting</span>
          <button onClick={() => setShowConfig(true)} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">Config</button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2 py-4">
            <Bot size={28} className={`opacity-25 ${cfg.color}`} />
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Ask about your VPS</p>
              <p className="text-xs text-muted-foreground/60">SSH errors, Linux commands, server config</p>
            </div>
            <div className="grid gap-1 w-full mt-1">
              {[
                "Why did my SSH connection drop?",
                "Fix: permission denied (publickey)",
                "Check disk usage on Linux",
              ].map((s) => (
                <button key={s} onClick={() => setInput(s)} className="text-xs px-2 py-1.5 rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 mr-1.5">
                <Bot size={11} className={cfg.color} />
              </div>
            )}
            <div className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
              {msg.role === "assistant" && msg.content === "" ? (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 size={11} className="animate-spin" />
                  <span>Thinking...</span>
                </div>
              ) : msg.role === "assistant" ? (
                <MessageContent content={msg.content} />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-2 flex-shrink-0">
        <div className="flex gap-1.5 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={canSend ? "Ask about an SSH error... (Enter to send)" : hasKey ? "Enter model name in config first" : "Configure a provider first"}
            rows={2}
            disabled={loading || !canSend}
            className="flex-1 px-2.5 py-1.5 text-xs bg-muted rounded border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground resize-none allow-select disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading || !canSend}
            className="px-2.5 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Enter → send · Shift+Enter → newline</p>
      </div>
    </div>
  );
}
