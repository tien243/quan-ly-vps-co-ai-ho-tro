import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import { useStore } from "../../store";
import { TERMINAL_THEMES } from "../../lib/terminal-themes";
import TerminalToolbar from "./TerminalToolbar";
import type { Tab } from "../../types";
import * as api from "../../lib/tauri-api";

interface Props {
  tab: Tab;
}

export default function TerminalPane({ tab }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lastOutputRef = useRef<string>("");
  const { settings, setLastTerminalError } = useStore();

  useEffect(() => {
    if (!containerRef.current) return;

    const theme = TERMINAL_THEMES[settings.terminal_theme];

    const term = new Terminal({
      theme,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: settings.font_size,
      cursorBlink: true,
      allowTransparency: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    // Send user input to Rust
    const dataDispose = term.onData((data) => {
      api.sshWrite(tab.session_id, data).catch(() => {});
    });

    // Listen for SSH output events from Rust
    const unlisten = listen<string>(`ssh://data/${tab.session_id}`, (event) => {
      term.write(event.payload);
      // Keep last ~2000 chars of output for AI context
      lastOutputRef.current = (lastOutputRef.current + event.payload).slice(-2000);
    });

    // Listen for exit
    const unlistenExit = listen(`ssh://exit/${tab.session_id}`, () => {
      term.write("\r\n\x1b[33m[Connection closed]\x1b[0m\r\n");
    });

    // Listen for error
    const unlistenError = listen<string>(`ssh://error/${tab.session_id}`, (event) => {
      term.write(`\r\n\x1b[31m[Error: ${event.payload}]\x1b[0m\r\n`);
      setLastTerminalError(`[${tab.host_label}] ${event.payload}`);
    });

    // Resize observer
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      const { cols, rows } = term;
      api.sshResize(tab.session_id, cols, rows).catch(() => {});
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      dataDispose.dispose();
      unlisten.then((fn) => fn());
      unlistenExit.then((fn) => fn());
      unlistenError.then((fn) => fn());
      observer.disconnect();
      term.dispose();
    };
  }, [tab.session_id, settings.terminal_theme, settings.font_size]);

  return (
    <div className="flex flex-col h-full">
      <TerminalToolbar tab={tab} getOutput={() => lastOutputRef.current} />
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden allow-select"
        style={{ backgroundColor: TERMINAL_THEMES[settings.terminal_theme].background }}
      />
    </div>
  );
}
