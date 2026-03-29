"use client";

import { useTicketStore } from "@/lib/store";

export function BulkTriageButton() {
  // Select only stable primitives — no objects, no arrays, no functions.
  const active    = useTicketStore((s) => s.bulkTriageActive);
  const completed = useTicketStore((s) => s.bulkTriageProgress.completed);
  const total     = useTicketStore((s) => s.bulkTriageProgress.total);

  // Derive a count from primitives to avoid subscribing to a new array.
  const untriagedCount = useTicketStore((s) =>
    s.tickets.filter((t) => t.status === "open" && t.triage === null).length
  );

  // Read the action imperatively at click time — never subscribe to functions.
  const handleRun = () => useTicketStore.getState().runBulkTriage();

  if (untriagedCount === 0 && !active) return null;

  const label = active
    ? `Triaging ${completed} / ${total}...`
    : `✦ Triage all (${untriagedCount})`;

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <button
      className={`btn btn-ai btn-sm${active ? " loading" : ""}`}
      onClick={handleRun}
      disabled={active}
      title={
        active
          ? "Bulk triage in progress"
          : `Run AI triage on ${untriagedCount} untriaged open ticket${untriagedCount === 1 ? "" : "s"}`
      }
      style={{ display: "flex", alignItems: "center", gap: 6 }}
    >
      {active && (
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
            animation: "pulse 1s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
      )}
      {label}
      {active && (
        <span
          style={{
            marginLeft: 4,
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--text3)",
          }}
        >
          ({percent}%)
        </span>
      )}
    </button>
  );
}