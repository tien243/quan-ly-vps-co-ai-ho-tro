# Implementation Plan - TermiusClone (Tauri Desktop App)

## Phase 1: Project Setup
- [x] Create Tauri project: `npm create tauri-app@latest` with React + TypeScript + Vite
- [x] Configure TypeScript strict mode (client & src-tauri)
- [x] Setup Tailwind CSS v3 in React frontend
- [x] Install shadcn/ui: init + add components (button, dialog, input, dropdown, tabs, tooltip)
- [x] Install Lucide React icons
- [x] Install xterm.js + @xterm/addon-fit + @xterm/addon-web-links
- [x] Add Rust dependencies to Cargo.toml: russh, rusqlite, tokio, serde, ring, uuid
- [x] Configure Tauri capabilities (permissions): filesystem, shell, window
- [x] Setup ESLint + Prettier for TypeScript
- [x] Verify `npm run tauri dev` starts successfully

## Phase 2: Database Layer (Rust)
- [x] Define SQLite schema in Rust (CREATE TABLE statements for all entities)
- [x] Initialize DB on app start: `~/.termius-clone/db.sqlite`
- [x] Implement DB module with CRUD functions for: groups, hosts, ssh_keys, snippets, port_forwards
- [x] Implement app_settings: get/set key-value pairs
- [x] AES-256-GCM encryption module for SSH private key storage
- [x] Unit test DB functions (Rust)

## Phase 3: Tauri Commands - Data Management
- [x] Host commands: `db_get_hosts`, `db_create_host`, `db_update_host`, `db_delete_host`
- [x] Group commands: `db_get_groups`, `db_create_group`, `db_update_group`, `db_delete_group`
- [x] SSH Key commands: `db_get_keys`, `db_create_key`, `db_delete_key`
- [x] Snippet commands: `db_get_snippets`, `db_create_snippet`, `db_update_snippet`, `db_delete_snippet`
- [x] Settings commands: `settings_get`, `settings_set`
- [x] Register all commands in `tauri::Builder`

## Phase 4: SSH Backend (Rust + russh)
- [x] SSH session manager: `HashMap<String, SshSession>` with Arc<Mutex>
- [x] Implement `ssh_connect(host_id, password?)` command:
  - Fetch host config from DB
  - Connect via russh (password or key auth)
  - Spawn PTY/shell
  - Return session_id
- [x] Stream PTY output -> Tauri event `ssh://data/{session_id}`
- [x] Implement `ssh_write(session_id, data)` command - write to PTY
- [x] Implement `ssh_resize(session_id, cols, rows)` command
- [x] Implement `ssh_disconnect(session_id)` command
- [x] Emit `ssh://exit/{session_id}` on disconnect
- [x] Emit `ssh://error/{session_id}` on connection failure

## Phase 5: SFTP Backend (Rust)
- [x] Implement `sftp_list(session_id, path)` -> Vec<FileEntry> {name, size, modified, kind, permissions}
- [x] Implement `sftp_download(session_id, remote_path)` -> bytes (stream to file dialog)
- [x] Implement `sftp_upload(session_id, local_path, remote_path)`
- [x] Implement `sftp_delete(session_id, path)`
- [x] Implement `sftp_rename(session_id, from, to)`
- [x] Implement `sftp_mkdir(session_id, path)`

## Phase 6: Frontend Foundation
- [x] Setup React Router v6 with routes: `/` (hosts), `/terminal/:sessionId`, `/sftp/:sessionId`
- [x] Create Tauri API client module: typed wrappers for all `invoke` calls
- [x] Create app store (Zustand): hosts, groups, sessions, settings state
- [x] Create AppLayout: sidebar + main content area
- [x] Theme system: CSS variables for dark/light, persist via settings
- [x] Terminal theme definitions: Dracula, Nord, Solarized Dark, Monokai, One Dark

## Phase 8: Host Manager UI
- [x] HostSidebar: tree view of groups + hosts
- [x] GroupItem: collapsible with color indicator + child hosts
- [x] HostItem: icon, label, hostname, connect button + context menu (edit/delete)
- [x] HostSearch: filter hosts/groups by name
- [x] AddHostDialog: form with all fields (label, host, port, username, auth type, key selector, group, tags)
- [x] AddGroupDialog: form (name, color, parent group, icon)
- [x] EditHostDialog: reuse AddHostDialog with pre-filled data
- [x] DeleteConfirmDialog: generic confirmation modal
- [x] Drag-and-drop host reordering (optional for MVP)

## Phase 9: SSH Key Management UI
- [x] KeysPage: list of stored SSH keys with name + fingerprint
- [x] AddKeyDialog: paste private key + name (auto-detect public key)
- [x] DeleteKeyDialog: confirm before delete
- [x] Key fingerprint display (MD5 or SHA256)

## Phase 10: Terminal UI
- [x] XtermTerminal component: init xterm.js, fit addon, web-links addon
- [x] Connect terminal to Tauri events: listen `ssh://data/{sessionId}` -> xterm.write()
- [x] Send input: xterm.onData -> invoke `ssh_write`
- [x] Handle resize: ResizeObserver + fit addon -> invoke `ssh_resize`
- [x] TerminalTab component: tab bar with session name, close button
- [x] TabBar: multi-tab navigation, open new tab (+), close tab (x)
- [x] SplitPane component: horizontal/vertical split with resizable divider
- [x] ConnectModal: password prompt dialog when auth_type=password
- [x] TerminalToolbar: disconnect, SFTP, split-H, split-V, snippets toggle buttons
- [x] Handle `ssh://exit` and `ssh://error` events with user notification

## Phase 11: SFTP UI
- [x] SftpPanel component: collapsible file browser panel
- [x] SftpToolbar: current path breadcrumb, up button, refresh, upload, new folder
- [x] FileList: table with columns (icon, name, size, modified, permissions)
- [x] FileIcon: different icons for file, directory, symlink, executable
- [x] FileContextMenu: right-click menu (download, rename, delete, new folder)
- [x] UploadButton: file picker -> invoke sftp_upload with progress
- [x] DownloadFile: invoke sftp_download -> save dialog
- [x] RenameDialog: inline rename or modal

## Phase 12: Snippets UI
- [x] SnippetsPanel: slide-in panel from sidebar
- [x] SnippetList: searchable list (name + command preview)
- [x] AddSnippetDialog: name, command, description, tags
- [x] SendSnippet: click -> invoke ssh_write to active terminal session
- [x] EditSnippetDialog: update snippet

## Phase 13: Settings & Themes UI
- [x] SettingsPage: app-wide settings
- [x] ThemeSwitcher: dark / light mode toggle
- [x] TerminalThemeSelector: dropdown with preview (Dracula, Nord, Solarized, Monokai, One Dark)
- [x] FontSizeSlider: terminal font size 10-24px
- [x] About page: version info, Tauri version

## Phase 14: Polish & UX
- [x] Toast notifications (sonner library): success/error/info
- [x] Loading skeletons for host list, file list
- [x] Empty states: no hosts (illustration + add button), no snippets
- [x] Keyboard shortcuts: Ctrl+T (new tab), Ctrl+W (close tab), Ctrl+D (disconnect), Ctrl+/ (snippets)
- [x] Window title: "TermiusClone - {hostname}" when connected
- [x] App icon (512x512 PNG for both platforms)
- [x] Tauri updater config (auto-update foundation)
- [x] Build and test on macOS (apple silicon + intel)
- [x] Build and test on Windows 10/11

---

## WORKFLOW CHECKPOINT REMINDER
**When ALL tasks above are marked [x]:**
1. Report "Phase 3 Complete - All implementation tasks done"
2. Create TEST_PLAN.md
3. STOP and wait for Human to review TEST_PLAN.md
4. Only proceed to run tests AFTER Human approves

**Context Overflow?** Re-read: `.claude/skills/vibe-builder/SKILL.md`

---

## Progress Log
| Date | Phase | Status | Notes |
| --- | --- | --- | --- |
| 2026-03-07 | Planning | In Progress | Switched from web app to Tauri desktop app |
