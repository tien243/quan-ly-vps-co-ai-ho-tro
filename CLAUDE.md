## Vibe Builder Project Reference

### CONTEXT OVERFLOW RECOVERY
**When context gets full or you feel lost in a long session:**
1. Re-read the vibe-builder skill: `.claude/skills/vibe-builder/SKILL.md`
2. Re-read `IMPLEMENTATION_PLAN.md` to check current progress
3. Re-read `TEST_PLAN.md` (if exists) to check test status
4. Follow the workflow strictly - especially the checkpoints below!

### WORKFLOW CHECKPOINTS (MANDATORY - DO NOT SKIP!)
| After Phase | Action |
| --- | --- |
| Phase 3 (Coding) complete | -> Create TEST_PLAN.md -> STOP for Human review |
| Phase 4 (Test Plan) approved | -> Execute tests autonomously |
| Phase 5 (Testing) complete | -> Report results -> Enter Phase 6 loop |

**CRITICAL:** After finishing ALL coding tasks, you MUST:
1. Create TEST_PLAN.md
2. STOP and wait for Human approval
3. DO NOT run any tests until Human reviews TEST_PLAN.md!

### Project Summary
- **App Type**: Desktop App (Windows + macOS) - SSH Client Manager
- **Framework**: Tauri 2.0 (Rust backend + React/WebView frontend)
- **Frontend Stack**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Terminal**: xterm.js + @xterm/addon-fit + @xterm/addon-web-links
- **Backend (Rust)**: russh (SSH), rusqlite (SQLite DB), tokio (async), ring (AES-256 encryption)
- **IPC**: Tauri invoke commands + Tauri events (streaming PTY output)
- **DB Location**: ~/.termius-clone/db.sqlite (local, no Docker needed)
- **Core Features**: SSH terminal, Host manager + groups, SFTP browser, Snippets, Port forwarding, Multi-tab/split view, Dark/light themes + terminal themes

### Current Phase
- **Status**: Phase 2 approved, ready for coding
- **Next**: Phase 3 (Autonomous Coding)

### Primary Documentation
- `PRD.md` - Full product requirements (wireframes, ER diagram, IPC design)
- `IMPLEMENTATION_PLAN.md` - 15 phases, ~90 tasks with checkboxes
- `TEST_PLAN.md` - Test cases and results (created in Phase 4)

### Coding Guidelines
- TypeScript strict mode throughout frontend
- Rust: safe code, use Arc<Mutex> for shared state, proper error handling with thiserror
- Mark completed tasks with `[x]` immediately
- Tauri commands: prefix `db_` for DB ops, `ssh_` for SSH ops, `sftp_` for SFTP ops
- Frontend state: Zustand store
- No authentication needed (single-user desktop app)
