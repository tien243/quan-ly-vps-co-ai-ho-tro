# TermiusClone 🚀

> Ứng dụng quản lý SSH & SFTP desktop hiện đại, nhẹ và hiệu năng cao.

Xây dựng trên **Tauri 2.0**, **Rust** và **React**. TermiusClone mang lại trải nghiệm native cao cấp với dung lượng cài đặt chỉ ~10MB — nhỏ hơn rất nhiều so với các ứng dụng Electron.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange.svg)
![Rust](https://img.shields.io/badge/Rust-Backend-black.svg)
![React](https://img.shields.io/badge/React-Frontend-61dafb.svg)

---

## ✨ Tính năng chính

- 🖥️ **Terminal Native**: Terminal hiệu năng cao dựa trên Xterm.js với hỗ trợ PTY đầy đủ qua Rust.
- 📂 **Đa Tab & Chia đôi màn hình**: Quản lý nhiều phiên SSH cùng lúc, chia màn hình dọc/ngang tùy ý.
- 🗄️ **Quản lý máy chủ**: Tổ chức server theo nhóm, tìm kiếm nhanh chóng với giao diện trực quan.
- 🤖 **AI Hỗ trợ**: Tích hợp AI (Gemini, OpenRouter, Custom API) để phân tích lỗi terminal và giải đáp thắc mắc DevOps trực tiếp trong app.
- 🔐 **Kho khóa bảo mật**: Lưu trữ SSH private key được mã hóa AES-256-GCM.
- 📁 **SFTP Browser**: Quản lý file từ xa — upload, download, xem thư mục dễ dàng.
- 📝 **Snippets lệnh**: Lưu các lệnh hay dùng và chèn trực tiếp vào terminal chỉ một click.
- 🎨 **Giao diện cao cấp**: Hỗ trợ dark/light mode và nhiều theme terminal (Dracula, Nord, Solarized...).
- 🚀 **Hiệu năng vượt trội**: Khởi động nhanh, tiêu thụ RAM thấp nhờ kiến trúc Tauri.

---

## 🛠️ Công nghệ sử dụng

- **Tauri 2.0**: Nền tảng desktop đa nền tảng (macOS, Windows).
- **Rust (Backend)**:
  - `russh`: Thư viện SSH2 thuần Rust.
  - `rusqlite`: SQLite nhúng để lưu dữ liệu cục bộ.
  - `ring`: Mã hóa AES-256.
- **Frontend**:
  - **React 18** + **Vite** + **TypeScript**
  - **Tailwind CSS** + **Shadcn UI**
  - **Zustand** quản lý state
  - **Lucide React** icon

---

## 📥 Tải về & Cài đặt

Tải bản mới nhất tại [GitHub Releases](https://github.com/tien243/quan-ly-vps-co-ai-ho-tro/releases):

| Nền tảng | File |
|---|---|
| macOS Apple Silicon (M1/M2/M3) | `TermiusClone_*_aarch64.dmg` |
| macOS Intel | `TermiusClone_*_x64.dmg` |
| Windows | `TermiusClone_*_x64-setup.exe` |

> **macOS — Không mở được app?**
>
> Nếu bị Gatekeeper chặn → **System Settings → Privacy & Security → Open Anyway**.
>
> Hoặc chạy lệnh sau trong Terminal sau khi kéo app vào thư mục Applications:
> ```bash
> xattr -cr /Applications/TermiusClone.app
> ```

> **Windows — SmartScreen cảnh báo?**
>
> Nhấn **More info** → **Run anyway**.

---

## 🔧 Tự build từ mã nguồn

### Yêu cầu

- [Rust](https://www.rust-lang.org/tools/install) (phiên bản stable mới nhất)
- [Node.js](https://nodejs.org/) (v18 trở lên)
- **macOS**: Xcode Command Line Tools
- **Windows**: [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) và C++ Build Tools

### Các bước

1. **Clone repository**:
   ```bash
   git clone https://github.com/tien243/quan-ly-vps-co-ai-ho-tro.git
   cd quan-ly-vps-co-ai-ho-tro
   ```

2. **Cài đặt dependencies**:
   ```bash
   npm install
   ```

3. **Chạy ở chế độ phát triển**:
   ```bash
   npm run tauri dev
   ```

4. **Build bản production**:
   ```bash
   npm run tauri build
   ```

---

## 📂 Cấu trúc thư mục

```text
.
├── src/                # Frontend React (Vite)
│   ├── components/     # UI Components (Shadcn + Custom)
│   ├── store/          # Zustand State Management
│   ├── pages/          # Các màn hình chính (Hosts, Settings...)
│   └── lib/            # Utilities và Tauri API wrappers
├── src-tauri/          # Backend Rust (Tauri)
│   ├── src/            # Mã nguồn Rust (SSH, DB, Commands)
│   ├── capabilities/   # Phân quyền bảo mật Tauri 2.0
│   └── tauri.conf.json # Cấu hình Tauri
└── public/             # Static assets
```

---

## 🛡️ Bảo mật

- **Lưu trữ cục bộ**: Toàn bộ cấu hình và SSH key chỉ lưu trên máy của bạn, không gửi lên server.
- **Mã hóa mạnh**: Dữ liệu nhạy cảm (private key, mật khẩu) được mã hóa bằng **AES-256-GCM** trước khi lưu vào SQLite.
- **Không theo dõi**: Không có log từ xa, không analytics — kết nối của bạn là hoàn toàn riêng tư.

---

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Hãy tạo Pull Request hoặc mở Issue để thảo luận trước khi thực hiện thay đổi lớn.

1. Fork project
2. Tạo branch mới (`git checkout -b feature/TinhNangMoi`)
3. Commit thay đổi (`git commit -m 'feat: thêm tính năng mới'`)
4. Push lên branch (`git push origin feature/TinhNangMoi`)
5. Mở Pull Request

---

## 📄 Giấy phép

Phân phối theo giấy phép MIT. Xem file `LICENSE` để biết thêm chi tiết.

---

<p align="center">
  Xây dựng với ❤️ bởi <b>Antigravity</b>
</p>
