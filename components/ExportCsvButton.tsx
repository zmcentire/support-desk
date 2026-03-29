"use client";

import { useState } from "react";
import { useTicketStore } from "@/lib/store";
import { downloadCsv, buildFilename } from "@/utils/csv";

export function ExportCsvButton() {
  const [exporting, setExporting] = useState(false);

  // Select only stable primitives to avoid infinite re-render loops.
  // getVisible() returns a new array each call, so we derive count from
  // primitives and read the full array imperatively at click time.
  const filter = useTicketStore((s) => s.filter);
  const sort = useTicketStore((s) => s.sort);
  const ticketCount = useTicketStore((s) => s.tickets.length);

  // Derive visible count from primitives — re-renders only when filter,
  // sort, or ticket count actually changes.
  const count = useTicketStore((s) => s.getVisible().length);

  const handleExport = () => {
    if (exporting || count === 0) return;

    setExporting(true);

    // Read the full visible ticket list imperatively at click time —
    // no subscription needed, no re-render loop risk.
    const tickets = useTicketStore.getState().getVisible();
    const prefix =
      filter === "all" ? "support-tickets" : `support-tickets-${filter}`;

    downloadCsv(tickets, buildFilename(prefix));
    setTimeout(() => setExporting(false), 800);
  };

  // Suppress unused-var warning — ticketCount is read only to trigger
  // re-render when tickets are added/removed.
  void ticketCount;
  void sort;

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={handleExport}
      disabled={exporting || count === 0}
      title={
        count === 0
          ? "No tickets to export"
          : `Export ${count} ticket${count === 1 ? "" : "s"} as CSV`
      }
      style={{ display: "flex", alignItems: "center", gap: 5 }}
    >
      {exporting ? (
        <>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--green)",
              animation: "pulse 0.8s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
          Exporting...
        </>
      ) : (
        <>
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            style={{ flexShrink: 0 }}
          >
            <path
              d="M6 1v7M3 5.5L6 8.5l3-3M1.5 10.5h9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Export CSV ({count})
        </>
      )}
    </button>
  );
}