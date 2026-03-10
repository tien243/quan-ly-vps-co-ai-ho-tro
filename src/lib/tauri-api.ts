import { invoke } from "@tauri-apps/api/core";
import type { Group, Host, SshKey, Snippet, FileEntry } from "../types";

// ===== Groups =====
export const getGroups = () => invoke<Group[]>("db_get_groups");
export const createGroup = (group: Omit<Group, "id" | "created_at">) =>
  invoke<Group>("db_create_group", { group });
export const updateGroup = (group: Group) =>
  invoke<Group>("db_update_group", { group });
export const deleteGroup = (id: string) =>
  invoke<void>("db_delete_group", { id });

// ===== Hosts =====
export const getHosts = () => invoke<Host[]>("db_get_hosts");
export const createHost = (host: Omit<Host, "id" | "created_at" | "password_encrypted">, password?: string) =>
  invoke<Host>("db_create_host", { host, password: password ?? null });
export const updateHost = (host: Host, password?: string) =>
  invoke<Host>("db_update_host", { host, password: password ?? null });
export const deleteHost = (id: string) =>
  invoke<void>("db_delete_host", { id });

// ===== SSH Keys =====
export const getKeys = () => invoke<SshKey[]>("db_get_keys");
export const createKey = (name: string, privateKeyPem: string) =>
  invoke<SshKey>("db_create_key", { name, privateKeyPem });
export const deleteKey = (id: string) =>
  invoke<void>("db_delete_key", { id });

// ===== Snippets =====
export const getSnippets = () => invoke<Snippet[]>("db_get_snippets");
export const createSnippet = (snippet: Omit<Snippet, "id" | "created_at">) =>
  invoke<Snippet>("db_create_snippet", { snippet });
export const updateSnippet = (snippet: Snippet) =>
  invoke<Snippet>("db_update_snippet", { snippet });
export const deleteSnippet = (id: string) =>
  invoke<void>("db_delete_snippet", { id });

// ===== Settings =====
export const settingsGet = (key: string) =>
  invoke<string | null>("settings_get", { key });
export const settingsSet = (key: string, value: string) =>
  invoke<void>("settings_set", { key, value });

// ===== SSH =====
export interface ConnectResult {
  session_id: string;
  host_label: string;
}

export const sshConnect = (hostId: string, password?: string) =>
  invoke<ConnectResult>("ssh_connect_cmd", { hostId, password });
export const sshWrite = (sessionId: string, data: string) =>
  invoke<void>("ssh_write_cmd", { sessionId, data });
export const sshResize = (sessionId: string, cols: number, rows: number) =>
  invoke<void>("ssh_resize_cmd", { sessionId, cols, rows });
export const sshDisconnect = (sessionId: string) =>
  invoke<void>("ssh_disconnect_cmd", { sessionId });

// ===== SFTP =====
export const sftpOpen = (sessionId: string) =>
  invoke<void>("sftp_open_cmd", { sessionId });
export const sftpList = (sessionId: string, path: string) =>
  invoke<FileEntry[]>("sftp_list_cmd", { sessionId, path });
export const sftpDownload = (sessionId: string, remotePath: string) =>
  invoke<number[]>("sftp_download_cmd", { sessionId, remotePath });
export const sftpUpload = (sessionId: string, remotePath: string, data: number[]) =>
  invoke<void>("sftp_upload_cmd", { sessionId, remotePath, data });
export const sftpDelete = (sessionId: string, path: string, isDir: boolean) =>
  invoke<void>("sftp_delete_cmd", { sessionId, path, isDir });
export const sftpRename = (sessionId: string, from: string, to: string) =>
  invoke<void>("sftp_rename_cmd", { sessionId, from, to });
export const sftpMkdir = (sessionId: string, path: string) =>
  invoke<void>("sftp_mkdir_cmd", { sessionId, path });

// ===== Sync =====
export interface SyncStats {
  groups: number;
  hosts: number;
  keys: number;
  snippets: number;
}

export const syncExport = (path: string, passphrase: string) =>
  invoke<void>("sync_export_cmd", { path, passphrase });

export const syncImport = (path: string, passphrase: string) =>
  invoke<SyncStats>("sync_import_cmd", { path, passphrase });

// ===== GitHub Gist Sync =====
export const gistConnect = (token: string) =>
  invoke<string>("gist_connect_cmd", { token });

export const gistStatus = () =>
  invoke<string | null>("gist_status_cmd");

export const gistDisconnect = () =>
  invoke<void>("gist_disconnect_cmd");

export const gistUpload = (passphrase: string) =>
  invoke<void>("gist_upload_cmd", { passphrase });

export const gistDownload = (passphrase: string) =>
  invoke<SyncStats>("gist_download_cmd", { passphrase });
