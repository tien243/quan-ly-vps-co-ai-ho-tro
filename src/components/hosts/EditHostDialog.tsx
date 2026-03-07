import { useState } from "react";
import { useStore } from "../../store";
import type { Host } from "../../types";
import Modal from "../ui/Modal";
import * as api from "../../lib/tauri-api";
import { toast } from "sonner";

interface Props {
  host: Host;
  onClose: () => void;
}

export default function EditHostDialog({ host, onClose }: Props) {
  const { groups, keys, refreshHosts } = useStore();
  const [form, setForm] = useState({
    label: host.label,
    host: host.host,
    port: String(host.port),
    username: host.username,
    auth_type: host.auth_type,
    ssh_key_id: host.ssh_key_id ?? "",
    group_id: host.group_id ?? "",
    password: "",
  });
  const hasStoredPassword = !!host.password_encrypted;
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated: Host = {
        ...host,
        group_id: form.group_id || null,
        label: form.label,
        host: form.host,
        port: parseInt(form.port) || 22,
        username: form.username,
        auth_type: form.auth_type as "password" | "key",
        ssh_key_id: form.auth_type === "key" && form.ssh_key_id ? form.ssh_key_id : null,
      };
      await api.updateHost(updated, form.auth_type === "password" ? form.password : undefined);
      await refreshHosts();
      toast.success("Host updated");
      onClose();
    } catch (e) {
      toast.error(`Update failed: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit Host" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Label</label>
            <input
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Host / IP</label>
            <input
              value={form.host}
              onChange={(e) => set("host", e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Port</label>
            <input
              value={form.port}
              onChange={(e) => set("port", e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Username</label>
            <input
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
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
              Password{hasStoredPassword ? " (currently saved — leave blank to keep)" : " (optional — saved encrypted)"}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={hasStoredPassword ? "Enter new password to change" : "Leave blank to enter when connecting"}
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
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors disabled:opacity-60">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
