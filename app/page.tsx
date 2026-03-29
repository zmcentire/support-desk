"use client";

import { useEffect } from "react";
import { useTicketStore } from "@/lib/store";
import { Sidebar } from "@/components/Sidebar";
import { TicketQueue } from "@/components/TicketQueue";
import { TicketDetail } from "@/components/TicketDetail";
import { BulkTriageButton } from "@/components/BulkTriageButton";
import { ExportCsvButton } from "@/components/ExportCsvButton";

// --- Keyboard navigation hook ------------------------------------------------
// Extracted here so it only runs once at the top level, not inside a component
// that re-renders on every ticket selection.

function useKeyboardNav() {
  const selectNext   = useTicketStore((s) => s.selectNext);
  const selectPrev   = useTicketStore((s) => s.selectPrev);
  const selectTicket = useTicketStore((s) => s.selectTicket);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't steal keys when the agent is typing a reply
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      )
        return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        selectNext();
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        selectPrev();
      }
      if (e.key === "Escape") {
        selectTicket(null);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectNext, selectPrev, selectTicket]);
}

// --- Topbar ------------------------------------------------------------------

function Topbar() {
  const openCount = useTicketStore((s) =>
    s.tickets.filter((t) => t.status === "open").length
  );

  return (
    <header className="topbar">
      <div className="topbar-logo">
        support<span>/</span>desk
      </div>
      <div className="topbar-spacer" />
      <BulkTriageButton />
      <ExportCsvButton />
      <div className="topbar-badge">Claude claude-sonnet-4-20250514</div>
      <div className="topbar-badge">{openCount} open</div>
      <div
        className="topbar-badge"
        style={{ fontSize: 10, color: "var(--text3)" }}
      >
        J / K navigate · Esc deselect
      </div>
    </header>
  );
}

// --- Page --------------------------------------------------------------------

export default function Dashboard() {
  useKeyboardNav();

  return (
    <div className="shell">
      <Topbar />
      <Sidebar />
      <main className="main">
        <TicketQueue />
        <TicketDetail />
      </main>
    </div>
  );
}