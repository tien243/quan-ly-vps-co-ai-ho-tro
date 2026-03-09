# TermiusClone 🚀

> A modern, lightweight, and high-performance SSH & SFTP client for Desktop. 

Built with **Tauri 2.0**, **Rust**, and **React**. TermiusClone offers a premium native experience with a tiny bundle size (~10MB) compared to Electron-based alternatives.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange.svg)
![Rust](https://img.shields.io/badge/Rust-Backend-black.svg)
![React](https://img.shields.io/badge/React-Frontend-61dafb.svg)

---

## ✨ Features

- 🖥️ **Native Terminal**: High-performance Xterm.js terminal with full PTY support via Rust.
- 📂 **Multi-Tab & Split View**: Manage multiple SSH sessions simultaneously with vertical/horizontal splitting.
- 🗄️ **Host Management**: Organize your servers into groups and tags with a clean, searchable interface.
- 🔐 **Secure Key Vault**: AES-256-GCM encrypted storage for your SSH private keys.
- 📁 **SFTP Browser**: Dual-pane style file management—upload, download, and manage remote files with ease.
- 📝 **SSH Snippets**: Save frequently used commands and inject them into active terminals instantly.
- 🎨 **Premium UI**: Modern dark/light modes with built-in terminal themes (Dracula, Nord, Solarized, and more).
- 🚀 **Performance**: Extremely low memory footprint and fast startup thanks to the Tauri architecture.

---

## 🛠️ Tech Stack

- **Tauri 2.0**: The backbone for cross-platform desktop integration.
- **Rust**:
  - `russh`: Pure Rust SSH2 implementation.
  - `rusqlite`: Embedded SQLite for local data storage.
  - `ring`: AES-256 encryption.
- **Frontend**:
  - **React 18** + **Vite** + **TypeScript**.
  - **Tailwind CSS** + **Shadcn UI** for a polished design.
  - **Lucide React** for consistent iconography.
  - **Zustand** for lightweight state management.

---

## 🚀 Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Node.js](https://nodejs.org/) (v18 or newer)
- **macOS**: Xcode Command Line Tools
- **Windows**: [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) and C++ Build Tools

### Download (Pre-built)

Download the latest release from [GitHub Releases](https://github.com/tien243/quan-ly-vps-co-ai-ho-tro/releases):

| Platform | File |
|---|---|
| macOS Apple Silicon (M1/M2/M3) | `TermiusClone_*_aarch64.dmg` |
| macOS Intel | `TermiusClone_*_x64.dmg` |
| Windows | `TermiusClone_*_x64-setup.exe` |

> **macOS — Không mở được app?**
>
> Nếu bị Gatekeeper chặn → System Settings → Privacy & Security → Open Anyway.
>
> Hoặc chạy lệnh sau trong Terminal sau khi kéo app vào Applications:
> ```bash
> xattr -cr /Applications/TermiusClone.app
> ```

> **Windows — SmartScreen cảnh báo?**
>
> Nhấn **More info** → **Run anyway**.

---

### Build from Source

1. **Clone the repository**:
   ```bash
   git clone https://github.com/tien243/quan-ly-vps-co-ai-ho-tro.git
   cd quan-ly-vps-co-ai-ho-tro
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm run tauri dev
   ```

4. **Build for production**:
   ```bash
   npm run tauri build
   ```

---

## 📂 Project Structure

```text
.
├── src/                # React Frontend (Vite)
│   ├── components/     # UI Components (Shadcn + Custom)
│   ├── store/          # Zustand State Management
│   ├── pages/          # Main App Views (Hosts, Settings, etc.)
│   └── lib/            # Utilities and Tauri API wrappers
├── src-tauri/          # Rust Backend (Tauri)
│   ├── src/            # Rust source code (SSH logic, DB, Commands)
│   ├── capabilities/   # Tauri 2.0 security permissions
│   └── tauri.conf.json # Tauri configuration
└── public/             # Static assets
```

---

## 🛡️ Security

Your data security is our priority.
- **Local Only**: All host configurations and keys are stored locally on your machine.
- **Encryption**: Sensitive data (private keys/passwords) is encrypted using **AES-256-GCM** before being saved to the SQLite database.
- **Environment**: No remote logging or tracking—your connections are yours alone.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ by <b>Antigravity</b>
</p>
