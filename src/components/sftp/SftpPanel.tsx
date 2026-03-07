import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Upload, FolderPlus, File, Folder,
  Download, Pencil, Trash2, MoreHorizontal, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { save, open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";
import type { Tab, FileEntry } from "../../types";
import * as api from "../../lib/tauri-api";
import DeleteConfirm from "../ui/DeleteConfirm";
import Modal from "../ui/Modal";

interface Props {
  tab: Tab;
}

export default function SftpPanel({ tab }: Props) {
  const [path, setPath] = useState(tab.sftp_path ?? "/");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuEntry, setMenuEntry] = useState<FileEntry | null>(null);
  const [renameEntry, setRenameEntry] = useState<FileEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<FileEntry | null>(null);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const files = await api.sftpList(tab.session_id, p);
      setEntries(files);
      setPath(p);
    } catch (e) {
      toast.error(`List failed: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [tab.session_id]);

  useEffect(() => { load(path); }, []);

  const navigateTo = (entry: FileEntry) => {
    if (entry.kind === "dir") {
      load(entry.path);
    }
  };

  const navigateUp = () => {
    const parent = path.split("/").slice(0, -1).join("/") || "/";
    load(parent);
  };

  const handleUpload = async () => {
    try {
      const selected = await openDialog({ multiple: false });
      if (!selected) return;
      const filePath = typeof selected === "string" ? selected : selected[0];
      const data = await readFile(filePath);
      const fileName = filePath.split("/").pop() ?? "upload";
      const remotePath = `${path}/${fileName}`.replace("//", "/");
      await api.sftpUpload(tab.session_id, remotePath, Array.from(data));
      toast.success(`Uploaded ${fileName}`);
      load(path);
    } catch (e) {
      toast.error(`Upload failed: ${e}`);
    }
  };

  const handleDownload = async (entry: FileEntry) => {
    try {
      const dest = await save({ defaultPath: entry.name });
      if (!dest) return;
      const bytes = await api.sftpDownload(tab.session_id, entry.path);
      await writeFile(dest, new Uint8Array(bytes));
      toast.success(`Downloaded ${entry.name}`);
    } catch (e) {
      toast.error(`Download failed: ${e}`);
    }
    setMenuEntry(null);
  };

  const handleMkdir = async () => {
    const name = window.prompt("Folder name:");
    if (!name) return;
    try {
      await api.sftpMkdir(tab.session_id, `${path}/${name}`.replace("//", "/"));
      toast.success("Folder created");
      load(path);
    } catch (e) {
      toast.error(`Mkdir failed: ${e}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteEntry) return;
    try {
      await api.sftpDelete(tab.session_id, deleteEntry.path, deleteEntry.kind === "dir");
      toast.success(`Deleted ${deleteEntry.name}`);
      load(path);
    } catch (e) {
      toast.error(`Delete failed: ${e}`);
    }
    setDeleteEntry(null);
  };

  const handleRename = async (newName: string) => {
    if (!renameEntry) return;
    const parentPath = renameEntry.path.split("/").slice(0, -1).join("/");
    const newPath = `${parentPath}/${newName}`.replace("//", "/");
    try {
      await api.sftpRename(tab.session_id, renameEntry.path, newPath);
      toast.success("Renamed");
      load(path);
    } catch (e) {
      toast.error(`Rename failed: ${e}`);
    }
    setRenameEntry(null);
  };

  const formatSize = (size: number) => {
    if (size === 0) return "--";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full" onClick={() => setMenuEntry(null)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20 flex-shrink-0">
        <button onClick={navigateUp} disabled={path === "/"} className="p-1.5 rounded hover:bg-muted disabled:opacity-40 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} />
        </button>
        <span className="text-xs text-muted-foreground font-mono flex-1 truncate">{path}</span>
        <button onClick={() => load(path)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
        <button onClick={handleUpload} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Upload size={13} />
        </button>
        <button onClick={handleMkdir} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <FolderPlus size={13} />
        </button>
      </div>

      {/* File list header */}
      <div className="grid grid-cols-[auto_1fr_80px_120px_32px] gap-2 px-3 py-1.5 border-b border-border bg-muted/10 text-xs text-muted-foreground font-medium">
        <span className="w-5" />
        <span>Name</span>
        <span className="text-right">Size</span>
        <span>Modified</span>
        <span />
      </div>

      {/* File entries */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">Empty directory</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.path}
              onDoubleClick={() => navigateTo(entry)}
              className="group relative grid grid-cols-[auto_1fr_80px_120px_32px] gap-2 items-center px-3 py-1.5 hover:bg-muted/60 transition-colors cursor-default text-sm"
            >
              <span className="w-5 flex-shrink-0 text-muted-foreground">
                {entry.kind === "dir" ? <Folder size={14} className="text-primary/70" /> : <File size={14} />}
              </span>
              <span className="truncate font-mono text-xs" title={entry.name}>{entry.name}</span>
              <span className="text-right text-xs text-muted-foreground">{entry.kind === "dir" ? "--" : formatSize(entry.size)}</span>
              <span className="text-xs text-muted-foreground truncate">{entry.modified?.split(" ")?.[0] ?? ""}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuEntry(entry); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity"
              >
                <MoreHorizontal size={13} />
              </button>

              {/* Context menu */}
              {menuEntry?.path === entry.path && (
                <div
                  className="absolute right-8 top-0 z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {entry.kind === "file" && (
                    <button onClick={() => handleDownload(entry)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted">
                      <Download size={12} /> Download
                    </button>
                  )}
                  <button onClick={() => { setRenameEntry(entry); setMenuEntry(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted">
                    <Pencil size={12} /> Rename
                  </button>
                  <button onClick={() => { setDeleteEntry(entry); setMenuEntry(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Rename dialog */}
      {renameEntry && (
        <RenameDialog
          currentName={renameEntry.name}
          onRename={handleRename}
          onClose={() => setRenameEntry(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteEntry && (
        <DeleteConfirm
          title="Delete"
          message={`Delete "${deleteEntry.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteEntry(null)}
        />
      )}
    </div>
  );
}

function RenameDialog({ currentName, onRename, onClose }: { currentName: string; onRename: (n: string) => void; onClose: () => void }) {
  const [name, setName] = useState(currentName);
  return (
    <Modal title="Rename" onClose={onClose} size="sm">
      <form onSubmit={(e) => { e.preventDefault(); onRename(name); }} className="space-y-3">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium">Rename</button>
        </div>
      </form>
    </Modal>
  );
}
