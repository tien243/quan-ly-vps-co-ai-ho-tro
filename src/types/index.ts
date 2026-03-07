export interface Group {
  id: string;
  parent_id: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface Host {
  id: string;
  group_id: string | null;
  label: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  ssh_key_id: string | null;
  /** Present only as a sentinel; actual encrypted value never sent to frontend */
  password_encrypted: string | null;
  tags: string; // JSON array string
  jump_host_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface SshKey {
  id: string;
  name: string;
  private_key_encrypted: string;
  public_key: string | null;
  fingerprint: string | null;
  created_at: string;
}

export interface Snippet {
  id: string;
  name: string;
  command: string;
  description: string | null;
  tags: string; // JSON array string
  sort_order: number;
  created_at: string;
}

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  modified: string;
  kind: "file" | "dir" | "symlink";
  permissions: string;
}

export interface SshSession {
  session_id: string;
  host_label: string;
  host_id: string;
  connected_at: number;
}

export type TabType = "terminal" | "sftp";

export interface Tab {
  id: string;
  type: TabType;
  session_id: string;
  host_label: string;
  host_id: string;
  sftp_path?: string;
}

export type TerminalTheme =
  | "dracula"
  | "nord"
  | "solarized-dark"
  | "monokai"
  | "one-dark"
  | "github-dark";

export type AppTheme = "dark" | "light";

export interface AppSettings {
  theme: AppTheme;
  terminal_theme: TerminalTheme;
  font_size: number;
}
