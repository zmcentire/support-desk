"use client";

import { useTicketStore, type FilterView } from "@/lib/store";

interface NavItemProps {
  label: string;
  dotColor?: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

function NavItem({ label, dotColor, count, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`nav-item${active ? " active" : ""}`}
    >
      <span
        className="nav-dot"
        style={dotColor ? { background: dotColor } : {}}
      />
      {label}
      {count !== undefined && (
        <span className="nav-count">{count}</span>
      )}
    </button>
  );
}

export function Sidebar() {
  const filter   = useTicketStore((s) => s.filter);
  const setFilter = useTicketStore((s) => s.setFilter);

  // Select each count as a stable primitive — no object, no useShallow needed.
  const all      = useTicketStore((s) => s.tickets.length);
  const open     = useTicketStore((s) => s.tickets.filter((t) => t.status === "open").length);
  const pending  = useTicketStore((s) => s.tickets.filter((t) => t.status === "pending").length);
  const resolved = useTicketStore((s) => s.tickets.filter((t) => t.status === "resolved").length);
  const critical = useTicketStore((s) => s.tickets.filter((t) => t.priority === "critical").length);
  const high     = useTicketStore((s) => s.tickets.filter((t) => t.priority === "high").length);
  const slaAtRisk = useTicketStore((s) =>
    s.tickets.filter((t) => t.sla < 40 && t.status !== "resolved").length
  );

  const item = (
    f: FilterView,
    label: string,
    dotColor?: string,
    count?: number
  ) => (
    <NavItem
      key={f}
      label={label}
      dotColor={dotColor}
      count={count}
      active={filter === f}
      onClick={() => setFilter(f)}
    />
  );

  return (
    <aside className="sidebar">
      <div className="nav-section">Queue</div>
      {item("all",      "All Tickets", undefined,        all)}
      {item("open",     "Open",        "var(--green)",   open)}
      {item("pending",  "Pending",     "var(--yellow)",  pending)}
      {item("resolved", "Resolved",    "var(--text3)",   resolved)}

      <div className="nav-section" style={{ marginTop: 8 }}>Priority</div>
      {item("critical", "Critical", "var(--red)",    critical)}
      {item("high",     "High",     "var(--orange)", high)}

      <div className="nav-section" style={{ marginTop: 8 }}>Category</div>
      {item("billing",   "Billing",      "var(--purple)")}
      {item("technical", "Technical",    "var(--accent)")}
      {item("account",   "Account",      "var(--green)")}
      {item("feature",   "Feature Req.", "var(--yellow)")}

      {slaAtRisk > 0 && (
        <>
          <div className="nav-section" style={{ marginTop: 8 }}>Alerts</div>
          <div
            className="nav-item"
            style={{
              color: "var(--red)",
              fontSize: 11,
              cursor: "default",
              pointerEvents: "none",
            }}
          >
            <span
              className="nav-dot"
              style={{ background: "var(--red)", opacity: 1 }}
            />
            {slaAtRisk} SLA breach{slaAtRisk === 1 ? "" : "es"}
          </div>
        </>
      )}
    </aside>
  );
}