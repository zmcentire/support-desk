import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { TICKETS } from "@/lib/tickets";
import { priorityOrder } from "@/utils/sla";
import type { Ticket, TriageResult, Priority, Status, Category } from "@/types/ticket";

// --- Filter / Sort Types -----------------------------------------------------

export type StatusFilter = Status | "all";
export type PriorityFilter = Priority | "all";
export type CategoryFilter = Category | "all";
export type FilterView = "all" | Status | Priority | Category;
export type SortKey = "newest" | "priority" | "sla";

// --- Store Shape -------------------------------------------------------------

interface TicketStore {
  // State
  tickets: Ticket[];
  selectedId: string | null;
  filter: FilterView;
  sort: SortKey;
  triagingIds: Set<string>;
  suggestingIds: Set<string>;

  // Bulk triage state
  bulkTriageActive: boolean;
  bulkTriageProgress: { completed: number; total: number };

  // Selectors
  /** Returns the currently selected ticket, or null */
  getSelected: () => Ticket | null;
  /** Returns filtered + sorted tickets for the current view */
  getVisible: () => Ticket[];
  /** Returns counts for sidebar badges */
  getCounts: () => {
    all: number;
    open: number;
    pending: number;
    resolved: number;
    critical: number;
    high: number;
    aiTriaged: number;
    slaAtRisk: number;
  };
  /** Returns aggregate stats for the stats bar */
  getStats: () => {
    openCount: number;
    slaMetPercent: number;
    aiTriagedPercent: number;
  };

  // Ticket actions
  selectTicket: (id: string | null) => void;
  resolveTicket: (id: string) => void;
  sendReply: (id: string, draft: string) => void;
  reopenTicket: (id: string) => void;
  updateDraft: (id: string, draft: string) => void;
  applyTriage: (id: string, triage: TriageResult) => void;
  setTriaging: (id: string, loading: boolean) => void;
  setSuggesting: (id: string, loading: boolean) => void;

  /**
   * Sequentially triages all untriaged open tickets.
   * Calls /api/triage for each, updating the store after every response
   * so the UI reflects progress ticket-by-ticket in real time.
   */
  runBulkTriage: () => Promise<void>;

  // View actions
  setFilter: (filter: FilterView) => void;
  setSort: (sort: SortKey) => void;

  // Queue navigation
  selectNext: () => void;
  selectPrev: () => void;
}

// --- Store Implementation ----------------------------------------------------

export const useTicketStore = create<TicketStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      tickets: JSON.parse(JSON.stringify(TICKETS)) as Ticket[],
      selectedId: null,
      filter: "all",
      sort: "newest",
      triagingIds: new Set(),
      suggestingIds: new Set(),
      bulkTriageActive: false,
      bulkTriageProgress: { completed: 0, total: 0 },

      // Selectors

      getSelected: () => {
        const { tickets, selectedId } = get();
        return tickets.find((t) => t.id === selectedId) ?? null;
      },

      getVisible: () => {
        const { tickets, filter, sort } = get();

        const filtered = tickets.filter((t) => {
          if (filter === "all") return true;
          if (filter === "open" || filter === "pending" || filter === "resolved")
            return t.status === filter;
          if (
            filter === "critical" ||
            filter === "high" ||
            filter === "medium" ||
            filter === "low"
          )
            return t.priority === filter;
          return t.category === filter;
        });

        return [...filtered].sort((a, b) => {
          if (sort === "priority")
            return priorityOrder(a.priority) - priorityOrder(b.priority);
          if (sort === "sla") return a.sla - b.sla;
          return tickets.indexOf(a) - tickets.indexOf(b);
        });
      },

      getCounts: () => {
        const { tickets } = get();
        return {
          all: tickets.length,
          open: tickets.filter((t) => t.status === "open").length,
          pending: tickets.filter((t) => t.status === "pending").length,
          resolved: tickets.filter((t) => t.status === "resolved").length,
          critical: tickets.filter((t) => t.priority === "critical").length,
          high: tickets.filter((t) => t.priority === "high").length,
          aiTriaged: tickets.filter((t) => t.triage !== null).length,
          slaAtRisk: tickets.filter(
            (t) => t.sla < 40 && t.status !== "resolved"
          ).length,
        };
      },

      getStats: () => {
        const { tickets } = get();
        const total = tickets.length;
        if (total === 0)
          return { openCount: 0, slaMetPercent: 0, aiTriagedPercent: 0 };

        const slaMet = tickets.filter((t) => t.sla >= 70).length;
        const aiTriaged = tickets.filter((t) => t.triage !== null).length;

        return {
          openCount: tickets.filter((t) => t.status === "open").length,
          slaMetPercent: Math.round((slaMet / total) * 100),
          aiTriagedPercent: Math.round((aiTriaged / total) * 100),
        };
      },

      // Ticket actions

      selectTicket: (id) => set({ selectedId: id }, false, "selectTicket"),

      resolveTicket: (id) =>
        set(
          (state) => ({
            tickets: state.tickets.map((t) =>
              t.id === id ? { ...t, status: "resolved", sla: 100 } : t
            ),
          }),
          false,
          "resolveTicket"
        ),

      sendReply: (id, draft) => {
        if (!draft.trim()) return;
        set(
          (state) => ({
            tickets: state.tickets.map((t) =>
              t.id === id ? { ...t, status: "pending", _draft: "" } : t
            ),
          }),
          false,
          "sendReply"
        );
      },

      reopenTicket: (id) =>
        set(
          (state) => ({
            tickets: state.tickets.map((t) =>
              t.id === id ? { ...t, status: "open" } : t
            ),
          }),
          false,
          "reopenTicket"
        ),

      updateDraft: (id, draft) =>
        set(
          (state) => ({
            tickets: state.tickets.map((t) =>
              t.id === id ? { ...t, _draft: draft } : t
            ),
          }),
          false,
          "updateDraft"
        ),

      applyTriage: (id, triage) =>
        set(
          (state) => ({
            tickets: state.tickets.map((t) =>
              t.id === id
                ? { ...t, triage, priority: triage.priority ?? t.priority }
                : t
            ),
          }),
          false,
          "applyTriage"
        ),

      setTriaging: (id, loading) =>
        set(
          (state) => {
            const next = new Set(state.triagingIds);
            loading ? next.add(id) : next.delete(id);
            return { triagingIds: next };
          },
          false,
          "setTriaging"
        ),

      setSuggesting: (id, loading) =>
        set(
          (state) => {
            const next = new Set(state.suggestingIds);
            loading ? next.add(id) : next.delete(id);
            return { suggestingIds: next };
          },
          false,
          "setSuggesting"
        ),

      // Bulk triage

      runBulkTriage: async () => {
        const { tickets, bulkTriageActive, applyTriage } = get();

        if (bulkTriageActive) return;

        // Only target open tickets without triage results yet
        const queue = tickets.filter(
          (t) => t.status === "open" && t.triage === null
        );

        if (queue.length === 0) return;

        set(
          {
            bulkTriageActive: true,
            bulkTriageProgress: { completed: 0, total: queue.length },
          },
          false,
          "bulkTriage/start"
        );

        for (const ticket of queue) {
          // Light up the individual ticket's loading indicator too
          get().setTriaging(ticket.id, true);

          try {
            const res = await fetch("/api/triage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ticket }),
            });

            if (res.ok) {
              const triage: TriageResult = await res.json();
              applyTriage(ticket.id, triage);
            }
            // On non-ok response: skip this ticket, continue the queue
          } catch {
            // Network error: skip and continue
          } finally {
            get().setTriaging(ticket.id, false);
            set(
              (state) => ({
                bulkTriageProgress: {
                  ...state.bulkTriageProgress,
                  completed: state.bulkTriageProgress.completed + 1,
                },
              }),
              false,
              "bulkTriage/tick"
            );
          }
        }

        set({ bulkTriageActive: false }, false, "bulkTriage/done");
      },

      // View actions

      setFilter: (filter) => set({ filter }, false, "setFilter"),

      setSort: (sort) => set({ sort }, false, "setSort"),

      // Queue navigation

      selectNext: () => {
        const { selectedId, getVisible, selectTicket } = get();
        const visible = getVisible();
        const idx = visible.findIndex((t) => t.id === selectedId);
        const next = visible[Math.min(idx + 1, visible.length - 1)];
        if (next) selectTicket(next.id);
      },

      selectPrev: () => {
        const { selectedId, getVisible, selectTicket } = get();
        const visible = getVisible();
        const idx = visible.findIndex((t) => t.id === selectedId);
        const prev = visible[Math.max(idx - 1, 0)];
        if (prev) selectTicket(prev.id);
      },
    }),
    { name: "ticket-store" }
  )
);

// --- Convenience Hooks -------------------------------------------------------
// Selectors that return objects or arrays use useShallow so Zustand compares
// by value rather than reference, preventing infinite re-render loops.

import { useShallow } from "zustand/react/shallow";

export const useSelectedTicket = () =>
  useTicketStore((s) => s.getSelected());

export const useVisibleTickets = () =>
  useTicketStore(useShallow((s) => s.getVisible()));

export const useTicketCounts = () =>
  useTicketStore(useShallow((s) => s.getCounts()));

export const useTicketStats = () =>
  useTicketStore(useShallow((s) => s.getStats()));

export const useIsTriaging = (id: string) =>
  useTicketStore((s) => s.triagingIds.has(id));

export const useIsSuggesting = (id: string) =>
  useTicketStore((s) => s.suggestingIds.has(id));

export const useBulkTriage = () =>
  useTicketStore(
    useShallow((s) => ({
      active: s.bulkTriageActive,
      progress: s.bulkTriageProgress,
      run: s.runBulkTriage,
    }))
  );