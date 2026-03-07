import { useState } from "react";
import { useStore } from "../../store";
import Modal from "../ui/Modal";
import * as api from "../../lib/tauri-api";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  defaultGroupId?: string | null;
}

export default function AddHostDialog({ onClose, defaultGroupId }: Props) {
  const { groups, keys, refreshHosts } = useStore();
  const [form, setForm] = useState({
    label: "",
    host: "",
    port: "22",
    username: "root",
    auth_type: "password" as "password" | "key",
    ssh_key_id: "",
    group_id: defaultGroupId ?? "",
    password: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label || !form.host || !form.username) {
      toast.error("Label, host and username are required");
      return;
    }
    setSaving(true);
    try {
      const host = {
        group_id: form.group_id || null,
        label: form.label,
        host: form.host,
        port: parseInt(form.port) || 22,
        username: form.username,
        auth_type: form.auth_type,
        ssh_key_id: form.auth_type === "key" && form.ssh_key_id ? form.ssh_key_id : null,
        tags: "[]",
        jump_host_id: null,
        sort_order: 0,
      };
      await api.createHost(host, form.auth_type === "password" ? form.password : undefined);
      await refreshHosts();
      toast.success(`Host "${form.label}" added`);
      onClose();
    } catch (e) {
      toast.error(`Failed to add host: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add New Host" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Label</label>
            <input
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="e.g. web-server-01"
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Host / IP</label>
            <input
              value={form.host}
              onChange={(e) => set("host", e.target.value)}
              placeholder="192.168.1.10"
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Port</label>
            <input
              value={form.port}
              onChange={(e) => set("port", e.target.value)}
              placeholder="22"
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Username</label>
            <input
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              placeholder="root"
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Group</label>
            <select
              value={form.group_id}
              onChange={(e) => set("group_id", e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
            >
              <option value="">No Group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-2">Authentication</label>
          <div className="flex gap-4">
            {(["password", "key"] as const).map((type) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="auth_type"
                  value={type}
                  checked={form.auth_type === type}
                  onChange={() => set("auth_type", type)}
                  className="accent-primary"
                />
                <span className="text-sm capitalize">{type === "key" ? "SSH Key" : "Password"}</span>
              </label>
            ))}
          </div>
        </div>

        {form.auth_type === "password" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Password <span className="text-muted-foreground/60 font-normal">(optional — saved encrypted)</span>
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="Leave blank to enter when connecting"
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
            />
          </div>
        )}

        {form.auth_type === "key" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">SSH Key</label>
            <select
              value={form.ssh_key_id}
              onChange={(e) => set("ssh_key_id", e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
            >
              <option value="">Select a key...</option>
              {keys.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Host"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
