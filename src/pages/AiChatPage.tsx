import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, Send, Trash2, X, Loader2, Key, Copy, Check, RefreshCw } from "lucide-react";
import * as api from "../lib/tauri-api";
import { useStore } from "../store";

// ── Types ─────────────────────────────────────────────────────────────────

type Provider = "gemini" | "openrouter" | "custom_claude" | "custom_openai";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ProviderDef {
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
  needsCustomModel?: boolean;
  canFetchModels?: boolean;
  hint?: string;
}

// ── Provider config ────────────────────────────────────────────────────────

const PROVIDERS: Record<Provider, ProviderDef> = {
  gemini: {
    label: "Gemini (Google)", shortLabel: "Gemini",
    models: [
      { id: "gemini-2.5-pro-exp-03-25", label: "Gemini 2.5 Pro — Most powerful" },
      { id: "gemini-2.0-flash",         label: "Gemini 2.0 Flash — Fast" },
      { id: "gemini-2.0-flash-lite",    label: "Gemini 2.0 Flash Lite — Cheapest" },
      { id: "gemini-1.5-pro",           label: "Gemini 1.5 Pro — Stable" },
      { id: "gemini-1.5-flash",         label: "Gemini 1.5 Flash — Stable Fast" },
    ],
    keyPlaceholder: "AIzaSy...", settingsKey: "gemini_api_key",
    color: "text-blue-400", apiFormat: "gemini", canFetchModels: true,
    hint: "aistudio.google.com",
  },
  openrouter: {
    label: "OpenRouter", shortLabel: "OpenRouter",
    models: [
      { id: "anthropic/claude-haiku-4-5",          label: "Claude Haiku 4.5" },
      { id: "anthropic/claude-sonnet-4",            label: "Claude Sonnet 4" },
      { id: "openai/gpt-4o-mini",                   label: "GPT-4o Mini" },
      { id: "openai/gpt-4o",                        label: "GPT-4o" },
      { id: "google/gemini-flash-1.5",              label: "Gemini 1.5 Flash" },
      { id: "meta-llama/llama-3.3-70b-instruct",   label: "Llama 3.3 70B" },
      { id: "mistralai/mistral-small",              label: "Mistral Small" },
      { id: "deepseek/deepseek-chat",               label: "DeepSeek Chat" },
    ],
    keyPlaceholder: "sk-or-v1-...", settingsKey: "openrouter_api_key",
    color: "text-purple-400", apiFormat: "openai", canFetchModels: true,
    baseUrl: "https://openrouter.ai/api/v1",
    hint: "openrouter.ai/keys",
  },
  custom_claude: {
    label: "Custom (Claude)", shortLabel: "Custom↗",
    keyPlaceholder: "API key or Bearer token", settingsKey: "custom_claude_api_key",
    baseUrlKey: "custom_claude_base_url", modelKey: "custom_claude_model",
    defaultBaseUrl: "https://api.anthropic.com",
    color: "text-amber-400", apiFormat: "anthropic", needsCustomModel: true,
  },
  custom_openai: {
    label: "Custom (OpenAI)", shortLabel: "Custom⊕",
    keyPlaceholder: "API key (optional)", settingsKey: "custom_openai_api_key",
    baseUrlKey: "custom_openai_base_url", modelKey: "custom_openai_model",
    defaultBaseUrl: "http://localhost:11434/v1",
    color: "text-cyan-400", apiFormat: "openai", needsCustomModel: true, canFetchModels: true,
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

// ── Markdown rendering ─────────────────────────────────────────────────────

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group mt-1.5 mb-1.5">
      <div className="flex items-center justify-between px-3 py-1 bg-black/40 rounded-t text-xs text-muted-foreground">
        <span>{lang || "sh"}</span>
        <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-3 py-2 bg-black/25 rounded-b text-xs overflow-x-auto allow-select whitespace-pre-wrap break-words">
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

// ── API streaming helpers ──────────────────────────────────────────────────

async function streamAnthropic(
  apiKey: string, model: string, messages: Message[],
  onChunk: (text: string) => void,
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

async function streamOpenAI(
  apiKey: string, model: string, messages: Message[],
  onChunk: (text: string) => void,
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
  onChunk: (text: string) => void
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

// ── Sub-components ─────────────────────────────────────────────────────────

function ProviderTab({ id, active, onClick }: { id: Provider; active: boolean; onClick: () => void }) {
  const { shortLabel, color } = PROVIDERS[id];
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      }`}
    >
      <span className={active ? color : ""}>{shortLabel}</span>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AiChatPage() {
  const { aiContext, setAiContext } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Provider & model
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState(DEFAULT_MODELS.gemini);

  // API keys per provider
  const emptyKeys: Record<Provider, string> = { gemini: "", openrouter: "", custom_claude: "", custom_openai: "" };
  const [keys, setKeys] = useState<Record<Provider, string>>(emptyKeys);
  const [keyInput, setKeyInput] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customModel, setCustomModel] = useState("");

  // Dynamic model list
  const [liveModels, setLiveModels] = useState<{ id: string; label: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userChangedProviderRef = useRef(false);
  const providerConfig = PROVIDERS[provider];
  const activeKey = keys[provider];

  // Load all settings on mount
  useEffect(() => {
    const load = async () => {
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
        if (p === "custom_claude") { setCustomBaseUrl(ccUrl ?? ""); setCustomModel(ccModel ?? ""); }
        if (p === "custom_openai") { setCustomBaseUrl(coUrl ?? ""); setCustomModel(coModel ?? ""); }
      }
    };
    load();
  }, []);

  // Reset model only when user explicitly changes provider
  useEffect(() => {
    if (userChangedProviderRef.current) {
      userChangedProviderRef.current = false;
      if (!providerConfig.needsCustomModel) setModel(DEFAULT_MODELS[provider]);
    }
    api.settingsSet("ai_provider", provider).catch(() => {});
  }, [provider]);

  useEffect(() => {
    api.settingsSet("ai_model", model).catch(() => {});
  }, [model]);

  useEffect(() => {
    if (providerConfig.needsCustomModel && providerConfig.modelKey) {
      api.settingsSet(providerConfig.modelKey, customModel).catch(() => {});
    }
  }, [customModel, provider]);

  useEffect(() => {
    if (providerConfig.needsCustomModel && providerConfig.baseUrlKey) {
      api.settingsSet(providerConfig.baseUrlKey, customBaseUrl).catch(() => {});
    }
  }, [customBaseUrl, provider]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (aiContext) {
      setInput(`I got this error in my SSH session:\n\`\`\`\n${aiContext}\n\`\`\`\nWhat does this mean and how do I fix it?`);
    }
  }, [aiContext]);

  // Fetch live models
  const doFetchModels = useCallback(async () => {
    if (!providerConfig.canFetchModels) return;
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
        const url = customBaseUrl || providerConfig.defaultBaseUrl!;
        models = await fetchCustomOpenAIModels(url, key);
      }
      setLiveModels(models);
    } catch {
      setLiveModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [provider, keys, customBaseUrl]);

  useEffect(() => {
    setLiveModels([]);
    doFetchModels();
  }, [provider, activeKey]);

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    const newKey = keyInput.trim();
    await api.settingsSet(providerConfig.settingsKey, newKey);
    setKeys((k) => ({ ...k, [provider]: newKey }));
    setKeyInput("");
    setShowKeyInput(false);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 1500);
  };

  const removeKey = async () => {
    await api.settingsSet(providerConfig.settingsKey, "");
    setKeys((k) => ({ ...k, [provider]: "" }));
    setLiveModels([]);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!activeKey && provider !== "custom_openai") return;

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
      const effectiveModel = providerConfig.needsCustomModel ? customModel : model;
      if (providerConfig.apiFormat === "anthropic") {
        await streamAnthropic(activeKey, effectiveModel, history, onChunk,
          providerConfig.needsCustomModel ? (customBaseUrl || providerConfig.defaultBaseUrl) : undefined);
      } else if (providerConfig.apiFormat === "openai") {
        await streamOpenAI(activeKey, effectiveModel, history, onChunk,
          providerConfig.needsCustomModel ? (customBaseUrl || providerConfig.defaultBaseUrl) : providerConfig.baseUrl);
      } else {
        await streamGemini(activeKey, effectiveModel, history, onChunk);
      }
      if (!fullText) setMessages([...history, { role: "assistant", content: "(No response)" }]);
    } catch (e: any) {
      setMessages([...history, { role: "assistant", content: `**Error:** ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const hasNoKey = !activeKey && !showKeyInput && provider !== "custom_openai";
  const displayModels = liveModels.length > 0 ? liveModels : (providerConfig.models ?? []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-border flex-shrink-0 gap-2">
        <Bot size={15} className={`flex-shrink-0 ${providerConfig.color}`} />
        <h2 className="text-sm font-semibold flex-1">AI Assistant</h2>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} title="Clear conversation" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Trash2 size={13} />
          </button>
        )}
        <button onClick={() => setShowKeyInput((v) => !v)} title="Manage API key" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Key size={13} />
        </button>
      </div>

      {/* Provider tabs + Model selector */}
      <div className="flex flex-col border-b border-border bg-muted/20 flex-shrink-0">
        <div className="flex items-center gap-0.5 px-3 pt-1.5 pb-1 overflow-x-auto">
          {(["gemini", "openrouter", "custom_claude", "custom_openai"] as Provider[]).map((p) => (
            <ProviderTab key={p} id={p} active={provider === p} onClick={() => { userChangedProviderRef.current = true; setProvider(p); }} />
          ))}
        </div>
        <div className="flex items-center gap-1.5 px-3 pb-1.5">
          {providerConfig.needsCustomModel ? (
            <>
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder={provider === "custom_claude" ? "Model: claude-3-5-sonnet-20241022" : "Model: llama3.2"}
                className="flex-1 text-xs bg-muted border border-border rounded px-2 py-1 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              <input
                type="text"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                placeholder={providerConfig.defaultBaseUrl}
                className="flex-1 text-xs bg-muted border border-border rounded px-2 py-1 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              {provider === "custom_openai" && providerConfig.canFetchModels && (
                <button
                  onClick={doFetchModels}
                  disabled={loadingModels}
                  title="Fetch models from endpoint"
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                >
                  {loadingModels ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                </button>
              )}
              {liveModels.length > 0 && (
                <>
                  <datalist id="custom-model-list">
                    {liveModels.map((m) => <option key={m.id} value={m.id} />)}
                  </datalist>
                </>
              )}
            </>
          ) : (
            <>
              <input
                type="text"
                list={`model-list-${provider}`}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Type or pick a model..."
                className="flex-1 text-xs bg-muted border border-border rounded px-2 py-1 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              <datalist id={`model-list-${provider}`}>
                {displayModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </datalist>
              {providerConfig.canFetchModels && (
                <button
                  onClick={doFetchModels}
                  disabled={loadingModels || (!activeKey && provider !== "custom_openai")}
                  title={liveModels.length > 0 ? `${liveModels.length} models loaded — click to refresh` : "Fetch model list"}
                  className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0 relative"
                >
                  {loadingModels
                    ? <Loader2 size={11} className="animate-spin text-muted-foreground" />
                    : <RefreshCw size={11} className={liveModels.length > 0 ? "text-green-400" : "text-muted-foreground"} />
                  }
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Inline key management */}
      {showKeyInput && (
        <div className="px-3 py-2 border-b border-border bg-muted/20 space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{providerConfig.label} API Key</span>
            {activeKey && <span className="text-xs text-muted-foreground font-mono">...{activeKey.slice(-6)}</span>}
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveKey(); if (e.key === "Escape") setShowKeyInput(false); }}
              placeholder={providerConfig.keyPlaceholder}
              autoFocus
              className="flex-1 px-2 py-1 text-xs bg-muted rounded border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select font-mono"
            />
            <button onClick={saveKey} disabled={!keyInput.trim()} className="px-2.5 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1">
              {keySaved ? <Check size={11} /> : <Key size={11} />} {keySaved ? "Saved!" : "Save"}
            </button>
            {activeKey && (
              <button onClick={removeKey} className="px-2 py-1 text-xs rounded border border-border text-destructive hover:bg-destructive/10 transition-colors">Remove</button>
            )}
            <button onClick={() => setShowKeyInput(false)} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"><X size={12} /></button>
          </div>
          {providerConfig.hint && (
            <p className="text-xs text-muted-foreground">Get key at <span className={providerConfig.color}>{providerConfig.hint}</span></p>
          )}
        </div>
      )}

      {/* Terminal context banner */}
      {aiContext && !showKeyInput && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 flex-shrink-0">
          <span className="text-xs text-amber-500 flex-1">Terminal error captured — input pre-filled below</span>
          <button onClick={() => { setAiContext(null); setInput(""); }} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={12} />
          </button>
        </div>
      )}

      {/* No key setup screen */}
      {hasNoKey ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-xs w-full space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Bot size={24} className={providerConfig.color} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{providerConfig.label}</h3>
              <p className="text-xs text-muted-foreground">Enter your API key to start. Keys are stored locally.</p>
            </div>
            <div className="space-y-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveKey()}
                placeholder={providerConfig.keyPlaceholder}
                autoFocus
                className="w-full px-3 py-2 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select font-mono"
              />
              <button
                onClick={saveKey}
                disabled={!keyInput.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-60 transition-colors"
              >
                <Key size={13} /> Save API Key
              </button>
            </div>
            {providerConfig.hint && (
              <p className="text-xs text-muted-foreground">Get key at <span className={providerConfig.color}>{providerConfig.hint}</span></p>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                <Bot size={36} className={`opacity-30 ${providerConfig.color}`} />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Ask about your VPS</p>
                  <p className="text-xs text-muted-foreground/60">SSH errors, Linux commands, server config...</p>
                </div>
                <div className="grid gap-1.5 w-full max-w-xs mt-1">
                  {[
                    "Why did my SSH connection drop?",
                    "Fix: permission denied (publickey)",
                    "How do I check disk usage on Linux?",
                  ].map((s) => (
                    <button key={s} onClick={() => setInput(s)} className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                    <Bot size={12} className={providerConfig.color} />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {msg.role === "assistant" && msg.content === "" ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" />
                      <span className="text-xs">Thinking...</span>
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
          <div className="border-t border-border p-3 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Ask about an SSH error or Linux issue..."
                rows={2}
                disabled={loading}
                className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground resize-none allow-select disabled:opacity-60"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Enter to send · Shift+Enter for newline</p>
          </div>
        </>
      )}
    </div>
  );
}
