"use client";

import { useTicketStore, type SortKey } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { slaColor } from "@/utils/sla";
import { StatsBar } from "@/components/StatsBar";

export function TicketQueue() {
  const selectedId   = useTicketStore((s) => s.selectedId);
  const filter       = useTicketStore((s) => s.filter);
  const sort         = useTicketStore((s) => s.sort);
  const selectTicket = useTicketStore((s) => s.selectTicket);
  const setSort      = useTicketStore((s) => s.setSort);

  // useShallow does a shallow key-by-key comparison so the array reference
  // changing doesn't cause a re-render if the contents are identical.
  const tickets = useTicketStore(useShallow((s) => s.getVisible()));

  const filterLabel =
    filter === "all"
      ? "All"
      : filter.charAt(0).toUpperCase() + filter.slice(1);

  const sortChip = (s: SortKey, label: string) => (
    <button
      key={s}
      className={`filter-chip${sort === s ? " active" : ""}`}
      onClick={() => setSort(s)}
    >
      {label}
    </button>
  );

  return (
    <div className="queue">
      <StatsBar />

      <div className="queue-header">
        <div className="queue-title">{filterLabel} Tickets</div>
        <div className="queue-sub">{tickets.length} results</div>
      </div>

      <div className="filter-row">
        {sortChip("newest",   "Newest")}
        {sortChip("priority", "Priority")}
        {sortChip("sla",      "SLA risk")}
      </div>

      <div className="ticket-list">
        {tickets.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">◫</div>
            <div>No tickets in this view</div>
          </div>
        )}

        {tickets.map((tk) => (
          <div
            key={tk.id}
            className={`ticket-item${tk.id === selectedId ? " selected" : ""}`}
            onClick={() => selectTicket(tk.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") selectTicket(tk.id);
            }}
            aria-selected={tk.id === selectedId}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  marginBottom: 3,
                }}
              >
                <span className="ticket-id">{tk.id}</span>
                {tk.triage && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "var(--accent)",
                      fontFamily: "var(--mono)",
                    }}
                  >
                    AI ✓
                  </span>
                )}
              </div>

              <div className="ticket-subject">{tk.subject}</div>
              <div className="ticket-meta">
                {tk.from} · {tk.email}
              </div>

              <div style={{ marginTop: 6 }}>
                <div className="sla-bar">
                  <div
                    className="sla-fill"
                    style={{
                      width: `${tk.sla}%`,
                      background: slaColor(tk.sla),
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="ticket-right">
              <div className="ticket-time">{tk.time}</div>
              <span className={`badge badge-${tk.priority}`}>
                {tk.priority.toUpperCase()}
              </span>
              <span className={`badge badge-${tk.category}`}>
                {tk.category}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}