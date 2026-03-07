# Product Requirements Document - TermiusClone (Desktop App)

## 1. Product Overview

TermiusClone là desktop SSH client hiện đại cho Windows và macOS, được xây dựng bằng **Tauri 2.0** (Rust backend + React frontend). Ứng dụng cho phép lập trình viên và sysadmin quản lý SSH connections, duyệt file từ xa qua SFTP, lưu command snippets, và làm việc với multi-tab terminal - tất cả trong một giao diện desktop đẹp và nhẹ (~10MB).

**Vấn đề giải quyết:** Cần một SSH manager đa nền tảng nhẹ nhàng, bảo mật, không cần internet, chạy native trên cả Windows và macOS.

## 2. Goals & Objectives

- **Primary goal**: Desktop SSH client đầy đủ tính năng, cross-platform Windows + macOS
- **Success metrics**: Connect SSH, browse SFTP, multi-tab terminal, host management với groups
- **Key differentiators**: Bundle size ~10MB (vs Electron 100MB+), native performance, Rust security

## 3. Target Users

- **DevOps/SysAdmin**: Quản lý nhiều server, cần port forwarding, SFTP, snippets
- **Developer**: SSH thỉnh thoảng, cần bookmark host nhanh và terminal sạch
- **Power User**: Muốn app nhẹ, không cần Chromium bundled

## 4. Features & Requirements

### Core Features (MVP)
- [ ] **Host Manager**: Thêm, sửa, xóa SSH hosts (label, IP, port, username, auth method)
- [ ] **Host Groups**: Tổ chức hosts vào folders/groups phân cấp
- [ ] **SSH Terminal**: Kết nối host, full xterm.js terminal với PTY support qua Rust
- [ ] **Multi-Tab**: Mở nhiều SSH connections song song trong tabs
- [ ] **Split View**: Chia terminal pane dọc/ngang (tối đa 2 panel MVP)
- [ ] **SSH Key Management**: Lưu SSH private keys (mã hóa AES-256), gán cho hosts
- [ ] **SFTP File Browser**: Duyệt, upload, download, xóa, đổi tên file từ xa
- [ ] **SSH Snippets**: Lưu commands hay dùng, gửi vào terminal đang active
- [ ] **Themes**: Dark/light mode + terminal color themes (Dracula, Solarized, Nord, v.v.)

### Nice-to-have (Post-MVP)
- [ ] Port forwarding (local/remote/dynamic)
- [ ] System tray icon + minimize to tray
- [ ] Auto-reconnect khi mất kết nối
- [ ] Batch command execution across multiple hosts
- [ ] Connection history / audit log
- [ ] Import/export host config (JSON)
- [ ] Proxy jump host (bastion)
- [ ] Terminal font size & family customization
- [ ] Keyboard shortcut customization

## 5. User Flows

### Main User Flow
```
[App Launch] -> [Dashboard: Host Manager]
                        |
          +-------------+-------------+
          |                           |
     [Add Host]               [Click Host]
          |                           |
     [Fill form]          [SSH Terminal Tab Opens]
          |                           |
       [Save]          [Type / split / open SFTP]
```

### Host Connection Flow
```
[Select Host] -> [Check auth method]
                        |
          +-------------+-------------+
          |                           |
    [Password auth]           [SSH Key auth]
          |                           |
    [Prompt password]        [Decrypt stored key]
          |                           |
          +-------------+-------------+
                        |
          [Tauri invoke ssh_connect]
                        |
          [Rust: russh connects to host]
                        |
          [PTY stream <-> Tauri events <-> xterm.js]
```

### SFTP Flow
```
[Toolbar SFTP button] -> [Open SFTP panel]
      |
[List remote /home/user]
      |
[Click folder] -> [Navigate]
[Click file]   -> [Download / Open]
[Upload btn]   -> [File picker] -> [Tauri: write to remote]
[Right-click]  -> [Rename / Delete / Mkdir]
```

## 6. Wireframes

### Screen 1: Main Dashboard (Host Manager)
```
+--------+------------------------------------+
| SIDEBAR|  CONTENT AREA                      |
|        |                                    |
| [Logo] |  [Search hosts...]    [+New Host]  |
|        |                                    |
| Hosts  |  v Production                      |
| Keys   |    [icon] web-server-01  [>Connect]|
| Snips  |    [icon] db-primary-01  [>Connect]|
| Ports  |    [icon] redis-01       [>Connect]|
|        |                                    |
| ------  |  v Staging                        |
| Theme  |    [icon] app-server-01  [>Connect]|
| Settings|   [icon] test-db-01    [>Connect] |
+--------+------------------------------------+
```

### Screen 2: Terminal View (Multi-tab + Split)
```
+--------+--[x web-01]--[x db-01]--[+]-------+
| SIDEBAR|  web-server-01 @ 192.168.1.10       |
|        | [Disconnect][SFTP][Split H][Split V] |
| Hosts  |--------------------------------------|
| Files  |  user@web-01:~$ ls -la              |
| Snips  |  total 48                           |
|        |  drwxr-xr-x 5 user user 4096 Jan.. |
|        |  -rw-r--r-- 1 user user  512 Jan.. |
|        |                                     |
|        |  user@web-01:~$ _                   |
+--------+-------------------------------------+
```

### Screen 3: Split View
```
+--------+--[x web-01]--[x db-01]--[+]--------+
| SIDEBAR|  [LEFT PANE]   |   [RIGHT PANE]      |
|        |  web-01        |   db-01             |
| Hosts  |  user@web-01:~ |  root@db-01:~$      |
| Files  |  $ top         |  $ mysql -u root    |
| Snips  |                |                     |
|        |  ...output...  |  ...output...       |
+--------+---------------------------------------------+
```

### Screen 4: SFTP File Browser
```
+--------+--[x web-01]--[SFTP web-01]----------+
| SIDEBAR|  /home/ubuntu/                        |
|        |  [^ Up] [Refresh] [Upload] [+ Folder] |
|        |----------------------------------------|
| Hosts  |  Name            Size     Modified     |
| Files  |  [..] ..         --       --            |
| Snips  |  [D] .config     --       Jan 15       |
|        |  [D] projects    --       Jan 20       |
|        |  [F] .bashrc     3.2 KB   Jan 10      |
|        |  [F] notes.txt   1.1 KB   Jan 18      |
+--------+--------------------------------------------+
```

### Screen 5: Add Host Dialog
```
+------------------------------------------+
|  Add New Host                        [X] |
|------------------------------------------|
|  Label:     [web-server-01             ] |
|  Host/IP:   [192.168.1.10             ] |
|  Port:      [22       ]                  |
|  Username:  [ubuntu                    ] |
|                                          |
|  Auth:  ( ) Password   (*) SSH Key      |
|                                          |
|  SSH Key:  [My Production Key      v  ] |
|                                          |
|  Group:    [Production             v  ] |
|                                          |
|  Tags:     [web] [prod] [+ add tag]     |
|                                          |
|          [Cancel]     [Save Host]        |
+------------------------------------------+
```

## 7. Data Models

### Entity Relationship Diagram
```
+----------+      +----------+
|  Group   | 1--N |   Host   |
+----------+      +----------+
| id       |      | id       |
| parent_id|      | group_id |
| name     |      | label    |
| color    |      | host     |
| icon     |      | port     |
| order    |      | username |
+----------+      | auth_type|
                  | key_id   |
                  | tags     |
                  | order    |
                  +----------+
                       |
+----------+           | N
| SshKey   | 1---------+
+----------+
| id       |
| name     |
| private  | (AES-256-GCM encrypted)
| public   |
| finger   |
+----------+

+----------+
| Snippet  |
+----------+
| id       |
| name     |
| command  |
| tags     |
| order    |
+----------+
```

### Schema Details (SQLite via rusqlite)
- **groups**: id, parent_id, name, color, icon, sort_order, created_at
- **hosts**: id, group_id, label, host, port, username, auth_type (password|key), ssh_key_id, tags (JSON), jump_host_id, sort_order, created_at
- **ssh_keys**: id, name, private_key_encrypted, public_key, fingerprint, created_at
- **snippets**: id, name, command, description, tags (JSON), sort_order, created_at
- **app_settings**: key, value (JSON) -- theme, terminal_theme, font_size, etc.

## 8. Technical Architecture

### System Diagram (Tauri Desktop App)
```
+------------------------------------------+
|          Tauri Desktop App               |
|                                          |
|  +------------------+  +--------------+ |
|  |  WebView (React) |  | Rust Backend | |
|  |                  |  |              | |
|  |  xterm.js        |<-|-> russh      | |
|  |  React UI        |  |-> rusqlite   | |
|  |  Tailwind CSS    |  |-> keytar     | |
|  |                  |  |-> tokio      | |
|  +------------------+  +--------------+ |
|           |                  |          |
|    Tauri IPC (invoke/events)            |
|           |                  |          |
|    +-------v------------------v------+  |
|    |          SQLite DB              |  |
|    |    (~/.termius-clone/db.sqlite) |  |
|    +--------------------------------+   |
+------------------------------------------+
          |
    SSH Connection
          |
    Remote Server (port 22)
```

### Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| Desktop Framework | **Tauri 2.0** | ~10MB bundle, native WebView, Rust security |
| Frontend | **React 18 + Vite + TypeScript** | Fast dev, type-safe, modern |
| UI Components | **Tailwind CSS + shadcn/ui** | Beautiful, accessible, dark mode built-in |
| Terminal Emulator | **xterm.js** + @xterm/addon-fit | Industry standard (VS Code uses it) |
| SSH (Rust) | **russh** crate | Pure Rust SSH2 implementation |
| Database | **rusqlite** (SQLite) | Single file, no install, cross-platform |
| Encryption | **AES-256-GCM** (Rust ring crate) | Encrypt SSH private keys at rest |
| Async Runtime | **Tokio** | Async I/O for SSH streams |
| IPC | **Tauri commands + events** | Frontend <-> Rust communication |

### Tauri IPC Design

**Commands (invoke - request/response):**
```
ssh_connect(host_id, password?) -> session_id
ssh_disconnect(session_id)
sftp_list(session_id, path) -> Vec<FileEntry>
sftp_download(session_id, remote_path, local_path)
sftp_upload(session_id, local_path, remote_path)
sftp_delete(session_id, path)
sftp_rename(session_id, from, to)
sftp_mkdir(session_id, path)
db_get_hosts() -> Vec<Host>
db_create_host(host) -> Host
db_update_host(id, host) -> Host
db_delete_host(id)
db_get_groups() -> Vec<Group>
...
```

**Events (emit - streaming):**
```
ssh://data/{session_id}  - PTY output stream -> xterm.js
ssh://exit/{session_id}  - Connection closed
ssh://error/{session_id} - Connection error
```

**Frontend -> Rust (invoke):**
```
ssh_write(session_id, data)  - Terminal input -> PTY
ssh_resize(session_id, cols, rows) - Terminal resize
```

## 9. UI/UX Guidelines

- **Default theme**: Dark mode (#0f0f0f bg, #1a1a1a sidebar, #111 terminal bg)
- **Light theme**: (#f5f5f5 bg, #ffffff panel, #333 text)
- **Accent color**: #00d2ff (cyan - similar to Termius)
- **Font (UI)**: Inter (system fallback: -apple-system, Segoe UI)
- **Font (Terminal)**: JetBrains Mono 14px default
- **Terminal themes**: Dracula (default), Nord, Solarized Dark, Monokai, One Dark, GitHub Dark
- **Icons**: Lucide React
- **Transitions**: Minimal - tab switches ~150ms, panel slides ~200ms
- **Window**: Min 900x600, default 1280x800, resizable

## 10. Platform Notes

### macOS
- App bundle: `.app` via Tauri
- Distribute: DMG installer
- Keychain: Optional (store master encryption key)
- Notarization: Required for distribution

### Windows
- App bundle: `.exe` + NSIS installer
- Distribute: `.msi` or `.exe` installer
- Credential Manager: Optional integration

### Common
- SQLite DB stored at: `$APP_DATA/termius-clone/db.sqlite`
- SSH keys encrypted with AES-256-GCM, master key from user password
- No cloud sync (local only for MVP)

## 11. Research Sources
- Termius features: termius.com
- Tauri vs Electron: peerlist.io/jagss, raftlabs.medium.com
- russh crate: docs.rs/russh
- xterm.js: xtermjs.org
- WebSSH patterns: github.com/billchurch/webssh2
- Tauri IPC: tauri.app/v2/concepts/inter-process-communication
