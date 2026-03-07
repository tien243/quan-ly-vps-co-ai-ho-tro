import { useState } from "react";
import { Plus, Code2, Pencil, Trash2 } from "lucide-react";
import { useStore } from "../store";
import type { Snippet } from "../types";
import Modal from "../components/ui/Modal";
import DeleteConfirm from "../components/ui/DeleteConfirm";
import * as api from "../lib/tauri-api";
import { toast } from "sonner";

export default function SnippetsPage() {
  const { snippets, refreshSnippets } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editSnippet, setEditSnippet] = useState<Snippet | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteSnippet(deleteId);
      await refreshSnippets();
      toast.success("Snippet deleted");
    } catch (e) {
      toast.error(`Delete failed: ${e}`);
    }
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold">Snippets</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
        >
          <Plus size={14} />
          New Snippet
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {snippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Code2 size={28} className="text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No snippets yet</p>
              <p className="text-sm text-muted-foreground mt-1">Save frequently used commands as snippets</p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
            >
              <Plus size={14} /> New Snippet
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {snippets.map((snippet) => (
              <div key={snippet.id} className="group p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{snippet.name}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-1 truncate">{snippet.command}</p>
                    {snippet.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{snippet.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => setEditSnippet(snippet)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteId(snippet.id)}
                      className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <SnippetDialog onClose={() => setShowAdd(false)} />}
      {editSnippet && <SnippetDialog snippet={editSnippet} onClose={() => setEditSnippet(null)} />}
      {deleteId && (
        <DeleteConfirm
          title="Delete Snippet"
          message="Delete this snippet? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function SnippetDialog({ snippet, onClose }: { snippet?: Snippet; onClose: () => void }) {
  const { refreshSnippets } = useStore();
  const [name, setName] = useState(snippet?.name ?? "");
  const [command, setCommand] = useState(snippet?.command ?? "");
  const [description, setDescription] = useState(snippet?.description ?? "");
  const [saving, setSaving] = useState(false);
  const isEdit = !!snippet;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !command) { toast.error("Name and command are required"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateSnippet({ ...snippet!, name, command, description: description || null });
      } else {
        await api.createSnippet({ name, command, description: description || null, tags: "[]", sort_order: 0 });
      }
      await refreshSnippets();
      toast.success(isEdit ? "Snippet updated" : "Snippet created");
      onClose();
    } catch (e) {
      toast.error(`Failed: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Snippet" : "New Snippet"} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Check disk usage" className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Command</label>
          <textarea value={command} onChange={(e) => setCommand(e.target.value)} placeholder="df -h" rows={3} className="w-full px-3 py-2 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground font-mono allow-select resize-none" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Description (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Show disk space usage" className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors disabled:opacity-60">
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Snippet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
