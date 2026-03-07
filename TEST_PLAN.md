# Test Plan - TermiusClone

## Unit Tests (Rust)

- [x] Test: `crypto::encrypt` / `crypto::decrypt` - roundtrip encryption/decryption of SSH key PEM
- [x] Test: `crypto::fingerprint_from_pem` - returns SHA256 fingerprint string
- [x] Test: `db::init_db` - creates all tables without error
- [x] Test: `db::create_host` / `db::get_host` - CRUD roundtrip for Host
- [x] Test: `db::create_group` / `db::get_groups` - group creation and retrieval
- [x] Test: `db::create_snippet` / `db::get_snippets` - snippet CRUD
- [x] Test: `db::settings_get` / `db::settings_set` - settings persistence
- [x] Test: `db::delete_host` - host deleted, not returned in get_hosts

## Integration Tests (Manual - App Running)

- [ ] Test: App launches without crash on macOS
- [ ] Test: SQLite DB created at `~/.termius-clone/db.sqlite` on first launch
- [ ] Test: Dark mode is default theme
- [ ] Test: Sidebar navigation switches between Hosts, Keys, Snippets, Settings

## Host Management
- [ ] Test: Add new host (password auth) - appears in list
- [ ] Test: Add new host (SSH key auth) - selects key from dropdown
- [ ] Test: Create group - appears in tree
- [ ] Test: Move host to group - displays under correct group
- [ ] Test: Edit host - changes persist after restart
- [ ] Test: Delete host - removed from list, confirmation dialog shown
- [ ] Test: Search hosts - filters by label, hostname, username
- [ ] Test: Nested groups - child group renders under parent

## SSH Key Management
- [ ] Test: Add SSH key (RSA PEM) - stored encrypted, fingerprint shown
- [ ] Test: Private key never exposed in UI (shows [encrypted])
- [ ] Test: Delete key - removed from list with confirmation

## SSH Terminal
- [ ] Test: Connect to real SSH server (password auth) - terminal opens, input works
- [ ] Test: Connect to real SSH server (key auth) - connects without password
- [ ] Test: Terminal output renders correctly (color codes, cursor)
- [ ] Test: Multi-tab - open 2 connections, switch between tabs
- [ ] Test: Terminal resize - fit addon adjusts cols/rows when window resizes
- [ ] Test: Disconnect button - closes tab, sends disconnect command
- [ ] Test: SSH error (wrong password) - shows error toast, tab not opened
- [ ] Test: Split view horizontal - 2 terminals side by side
- [ ] Test: Split view vertical - 2 terminals stacked

## SFTP
- [ ] Test: Open SFTP from terminal toolbar - new SFTP tab created
- [ ] Test: List `/home/user` directory - files and folders shown
- [ ] Test: Navigate into folder (double-click) - path updates
- [ ] Test: Navigate up (arrow button) - goes to parent
- [ ] Test: Upload file - appears in remote directory
- [ ] Test: Download file - save dialog appears, file downloaded
- [ ] Test: Create folder - new folder appears in list
- [ ] Test: Rename file - name updated in list
- [ ] Test: Delete file - removed with confirmation

## Snippets
- [ ] Test: Create snippet (name + command) - appears in list
- [ ] Test: Edit snippet - changes saved
- [ ] Test: Delete snippet - removed with confirmation
- [ ] Test: Send snippet to terminal - command sent (requires active SSH session)
- [ ] Test: Snippets panel search - filters by name and command

## Settings
- [ ] Test: Switch to light mode - UI updates, persists on restart
- [ ] Test: Switch terminal theme (e.g. Nord) - terminal colors change
- [ ] Test: Change font size - terminal font updates

## Edge Cases
- [ ] Test: Connect to unreachable host - error toast shown within timeout
- [ ] Test: Close tab with active connection - disconnect called
- [ ] Test: Open SFTP when SFTP subsystem not supported - error toast shown
- [ ] Test: Upload large file (>10MB) - completes without crash
- [ ] Test: Delete group with hosts inside - hosts become ungrouped

---

## Test Results
| Test | Status | Notes |
| --- | --- | --- |
| Unit Tests (15 tests) | PASSED | crypto (4) + db (11) - all green |
| Integration Tests | PENDING | Requires real SSH server for manual testing |

---

## How to Run Rust Unit Tests
```bash
cd src-tauri
cargo test
```

## How to Run Manual Integration Tests
```bash
npm run tauri dev
# Follow test cases above with a real SSH server
```
