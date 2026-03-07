import { useState } from "react";
import { Plus, Key, Trash2, Fingerprint } from "lucide-react";
import { useStore } from "../store";
import Modal from "../components/ui/Modal";
import DeleteConfirm from "../components/ui/DeleteConfirm";
import * as api from "../lib/tauri-api";
import { toast } from "sonner";

export default function KeysPage() {
  const { keys, refreshKeys } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteKey(deleteId);
      await refreshKeys();
      toast.success("Key deleted");
    } catch (e) {
      toast.error(`Delete failed: ${e}`);
    }
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold">SSH Keys</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
        >
          <Plus size={14} />
          Add Key
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Key size={28} className="text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No SSH keys</p>
              <p className="text-sm text-muted-foreground mt-1">Add a key to use with your hosts</p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
            >
              <Plus size={14} /> Add Key
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors">
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Key size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{key.name}</p>
                  {key.fingerprint && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Fingerprint size={11} />
                      <span className="truncate font-mono">{key.fingerprint.slice(0, 40)}...</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{key.created_at.split("T")[0]}</p>
                </div>
                <button
                  onClick={() => setDeleteId(key.id)}
                  className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddKeyDialog onClose={() => setShowAdd(false)} />}
      {deleteId && (
        <DeleteConfirm
          title="Delete Key"
          message="Delete this SSH key? Hosts using it will need to be updated."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function AddKeyDialog({ onClose }: { onClose: () => void }) {
  const { refreshKeys } = useStore();
  const [name, setName] = useState("");
  const [pem, setPem] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !pem) {
      toast.error("Name and private key are required");
      return;
    }
    setSaving(true);
    try {
      await api.createKey(name, pem.trim());
      await refreshKeys();
      toast.success("SSH key added");
      onClose();
    } catch (e) {
      toast.error(`Failed: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add SSH Key" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Production Key"
            className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Private Key (PEM format)</label>
          <textarea
            value={pem}
            onChange={(e) => setPem(e.target.value)}
            placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
            rows={8}
            className="w-full px-3 py-2 text-xs bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground font-mono allow-select resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors disabled:opacity-60">
            {saving ? "Saving..." : "Add Key"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
