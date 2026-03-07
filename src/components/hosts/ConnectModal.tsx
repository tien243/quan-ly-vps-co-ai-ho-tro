import { useState } from "react";
import type { Host } from "../../types";
import Modal from "../ui/Modal";

interface Props {
  host: Host;
  onConnect: (password?: string) => void;
  onClose: () => void;
}

export default function ConnectModal({ host, onConnect, onClose }: Props) {
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(password);
  };

  return (
    <Modal title={`Connect to ${host.label}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            {host.username}@{host.host}:{host.port}
          </p>
          <label className="text-sm font-medium text-foreground block mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter SSH password"
            autoFocus
            className="w-full px-3 py-2 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground allow-select"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
          >
            Connect
          </button>
        </div>
      </form>
    </Modal>
  );
}
