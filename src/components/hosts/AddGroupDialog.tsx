import { useState } from "react";
import { useStore } from "../../store";
import Modal from "../ui/Modal";
import * as api from "../../lib/tauri-api";
import { toast } from "sonner";

const COLORS = [
  "#00d2ff", "#ff5555", "#50fa7b", "#f1fa8c", "#bd93f9",
  "#ff79c6", "#ffb86c", "#8be9fd", "#6272a4", "#ffffff",
];

interface Props {
  onClose: () => void;
}

export default function AddGroupDialog({ onClose }: Props) {
  const { groups, refreshGroups } = useStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createGroup({
        parent_id: parentId || null,
        name: name.trim(),
        color,
        icon: null,
        sort_order: 0,
      });
      await refreshGroups();
      toast.success(`Group "${name}" created`);
      onClose();
    } catch (e) {
      toast.error(`Failed to create group: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Group" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Production"
            className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-2">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {groups.length > 0 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Parent Group</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
            >
              <option value="">None (root)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors disabled:opacity-60">
            {saving ? "Creating..." : "Create Group"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
