import { useState, useEffect, useRef } from "react";
import { Bot, Send, Trash2, X, Loader2, Key, Copy, Check, ChevronDown } from "lucide-react";
import * as api from "../lib/tauri-api";
import { useStore } from "../store";

// ── Types ─────────────────────────────────────────────────────────────────

type Provider = "anthropic" | "openai" | "gemini";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ── Provider config ────────────────────────────────────────────────────────

const PROVIDERS: Record<Provider, {
  label: string;
  shortLabel: string;
  models: { id: string; label: string }[];
  keyPlaceholder: string;
  settingsKey: string;
  color: string;
}> = {
  anthropic: {
    label: "Claude (Anthropic)",
    shortLabel: "Claude",
    models: [
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — Fast" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — Balanced" },
      { id: "claude-opus-4-6", label: "Claude Opus 4.6 — Most capable" },
    ],
    keyPlaceholder: "sk-ant-api03-...",
    settingsKey: "anthropic_api_key",
    color: "text-orange-400",
  },
  openai: {
    label: "GPT (OpenAI)",
    shortLabel: "GPT",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini — Fast & cheap" },
      { id: "gpt-4o", label: "GPT-4o — Balanced" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo — Powerful" },
    ],
    keyPlaceholder: "sk-proj-...",
    settingsKey: "openai_api_key",
    color: "text-green-400",
  },
  gemini: {
    label: "Gemini (Google)",
    shortLabel: "Gemini",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash — Fast" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash — Balanced" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro — Powerful" },
    ],
    keyPlaceholder: "AIzaSy...",
    settingsKey: "gemini_api_key",
    color: "text-blue-400",
  },
};

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
};

const SYSTEM_PROMPT = `You are an expert DevOps, Linux, and VPS assistant integrated into TermiusClone — an SSH client. Help users diagnose and fix SSH connection issues, server errors, Linux command problems, service configuration, and other VPS-related topics.

Guidelines:
- Be concise but thorough
- Use markdown code blocks with language tags for commands and config snippets
- When given error output, identify root cause and provide actionable step-by-step fixes
- Prefer simple, safe commands that don't risk data loss
- If unsure, say so and suggest how to gather more diagnostic info`;

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
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
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
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRe.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(<InlineText key={lastIndex} text={content.slice(lastIndex, match.index)} />);
    parts.push(<CodeBlock key={match.index} lang={match[1]} code={match[2].trim()} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) parts.push(<InlineText key={lastIndex} text={content.slice(lastIndex)} />);
  return <div className="space-y-0.5">{parts}</div>;
}

// ── API call helpers ───────────────────────────────────────────────────────

async function streamAnthropic(
  apiKey: string, model: string, messages: Message[],
  onChunk: (text: string) => void
): Promise<void> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
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
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
          onChunk(parsed.delta.text);
        }
      } catch {}
    }
  }
}

async function streamOpenAI(
  apiKey: string, model: string, messages: Message[],
  onChunk: (text: string) => void
): Promise<void> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
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
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) onChunk(text);
      } catch {}
    }
  }
}

async function streamGemini(
  apiKey: string, model: string, messages: Message[],
  onChunk: (text: string) => void
): Promise<void> {
  // Gemini uses "user" / "model" roles
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
    const msg = (err as any).error?.message ?? `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
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
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [model, setModel] = useState(DEFAULT_MODELS.anthropic);

  // API keys per provider
  const [keys, setKeys] = useState<Record<Provider, string>>({ anthropic: "", openai: "", gemini: "" });
  const [keyInput, setKeyInput] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const providerConfig = PROVIDERS[provider];
  const activeKey = keys[provider];

  // Load all keys + saved provider/model on mount
  useEffect(() => {
    const load = async () => {
      const [ant, oai, gem, savedProvider, savedModel] = await Promise.all([
        api.settingsGet("anthropic_api_key").catch(() => null),
        api.settingsGet("openai_api_key").catch(() => null),
        api.settingsGet("gemini_api_key").catch(() => null),
        api.settingsGet("ai_provider").catch(() => null),
        api.settingsGet("ai_model").catch(() => null),
      ]);
      setKeys({ anthropic: ant ?? "", openai: oai ?? "", gemini: gem ?? "" });
      if (savedProvider && savedProvider in PROVIDERS) {
        const p = savedProvider as Provider;
        setProvider(p);
        setModel(savedModel ?? DEFAULT_MODELS[p]);
      }
    };
    load();
  }, []);

  // Sync model default when provider changes
  useEffect(() => {
    setModel(DEFAULT_MODELS[provider]);
    api.settingsSet("ai_provider", provider).catch(() => {});
  }, [provider]);

  useEffect(() => {
    api.settingsSet("ai_model", model).catch(() => {});
  }, [model]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Pre-fill from terminal context
  useEffect(() => {
    if (aiContext) {
      setInput(`I got this error in my SSH session:\n\`\`\`\n${aiContext}\n\`\`\`\nWhat does this mean and how do I fix it?`);
    }
  }, [aiContext]);

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
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || !activeKey) return;

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
      if (provider === "anthropic") {
        await streamAnthropic(activeKey, model, history, onChunk);
      } else if (provider === "openai") {
        await streamOpenAI(activeKey, model, history, onChunk);
      } else {
        await streamGemini(activeKey, model, history, onChunk);
      }
      if (!fullText) setMessages([...history, { role: "assistant", content: "(No response)" }]);
    } catch (e: any) {
      setMessages([...history, { role: "assistant", content: `**Error:** ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Setup screen (no key for current provider) ────────────────────────────

  const hasNoKey = !activeKey && !showKeyInput;

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
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/20 flex-shrink-0">
        <div className="flex gap-0.5 flex-1">
          {(["anthropic", "openai", "gemini"] as Provider[]).map((p) => (
            <ProviderTab key={p} id={p} active={provider === p} onClick={() => setProvider(p)} />
          ))}
        </div>
        <div className="relative">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="appearance-none text-xs bg-muted border border-border rounded px-2 py-1 pr-5 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            {providerConfig.models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Inline key management */}
      {showKeyInput && (
        <div className="px-3 py-2 border-b border-border bg-muted/20 space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{providerConfig.label} API Key</span>
            {activeKey && (
              <span className="text-xs text-muted-foreground font-mono">...{activeKey.slice(-6)}</span>
            )}
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
            <div className={`w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto`}>
              <Bot size={24} className={providerConfig.color} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{providerConfig.label}</h3>
              <p className="text-xs text-muted-foreground">
                Enter your API key to start chatting. Keys are stored locally and never sent elsewhere.
              </p>
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
            <p className="text-xs text-muted-foreground">
              {provider === "anthropic" && "Get key at console.anthropic.com"}
              {provider === "openai" && "Get key at platform.openai.com/api-keys"}
              {provider === "gemini" && "Get key at aistudio.google.com"}
            </p>
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
                  <div className={`w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 mr-2`}>
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
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
