import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useStore } from "../../store";
import type { Group, Host } from "../../types";
import HostCard from "./HostCard";

interface Props {
  searchQuery: string;
}

export default function HostTree({ searchQuery }: Props) {
  const { groups, hosts } = useStore();

  const q = searchQuery.toLowerCase();
  const filteredHosts = q
    ? hosts.filter(
        (h) =>
          h.label.toLowerCase().includes(q) ||
          h.host.toLowerCase().includes(q) ||
          h.username.toLowerCase().includes(q)
      )
    : hosts;

  if (searchQuery) {
    return (
      <div className="p-2 space-y-1">
        {filteredHosts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hosts matching "{searchQuery}"
          </p>
        ) : (
          filteredHosts.map((host) => <HostCard key={host.id} host={host} />)
        )}
      </div>
    );
  }

  // Build tree: root-level groups + ungrouped hosts
  const rootGroups = groups.filter((g) => !g.parent_id);
  const ungroupedHosts = filteredHosts.filter((h) => !h.group_id);

  return (
    <div className="p-2 space-y-1">
      {rootGroups.map((group) => (
        <GroupNode
          key={group.id}
          group={group}
          groups={groups}
          hosts={filteredHosts}
          depth={0}
        />
      ))}
      {ungroupedHosts.map((host) => (
        <HostCard key={host.id} host={host} />
      ))}
    </div>
  );
}

interface GroupNodeProps {
  group: Group;
  groups: Group[];
  hosts: Host[];
  depth: number;
}

function GroupNode({ group, groups, hosts, depth }: GroupNodeProps) {
  const [open, setOpen] = useState(true);
  const childGroups = groups.filter((g) => g.parent_id === group.id);
  const groupHosts = hosts.filter((h) => h.group_id === group.id);

  const accentColor = group.color ?? "#00d2ff";

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm font-medium text-foreground transition-colors"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {open ? (
          <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
        )}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <span className="truncate">{group.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {groupHosts.length}
        </span>
      </button>

      {open && (
        <div>
          {childGroups.map((child) => (
            <GroupNode
              key={child.id}
              group={child}
              groups={groups}
              hosts={hosts}
              depth={depth + 1}
            />
          ))}
          {groupHosts.map((host) => (
            <HostCard key={host.id} host={host} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
