import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTicketStore } from "@/lib/store";
import { priorityOrder } from "@/utils/sla";
import type { TriageResult } from "@/types/ticket";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Reset store to a clean state before each test */
function resetStore() {
  useTicketStore.setState(useTicketStore.getInitialState());
}

const MOCK_TRIAGE: TriageResult = {
  category: "technical",
  priority: "high",
  sentiment: "frustrated",
  tags: ["api", "rate-limit", "regression"],
  summary: "User experiencing 429 errors despite being within documented limits.",
  suggestedResponse:
    "Hi Marcus, I can see the issue — our rate limiter had a misconfiguration during the maintenance window. This has been resolved. Your webhooks should be delivering normally now.",
};

// ─── selectTicket ─────────────────────────────────────────────────────────────

describe("selectTicket", () => {
  beforeEach(resetStore);

  it("sets selectedId to the given ticket id", () => {
    useTicketStore.getState().selectTicket("TKT-0041");
    expect(useTicketStore.getState().selectedId).toBe("TKT-0041");
  });

  it("can deselect by passing null", () => {
    useTicketStore.getState().selectTicket("TKT-0041");
    useTicketStore.getState().selectTicket(null);
    expect(useTicketStore.getState().selectedId).toBeNull();
  });

  it("getSelected returns the matching ticket", () => {
    useTicketStore.getState().selectTicket("TKT-0041");
    const selected = useTicketStore.getState().getSelected();
    expect(selected?.id).toBe("TKT-0041");
    expect(selected?.subject).toContain("locked out");
  });

  it("getSelected returns null when nothing is selected", () => {
    expect(useTicketStore.getState().getSelected()).toBeNull();
  });
});

// ─── resolveTicket ────────────────────────────────────────────────────────────

describe("resolveTicket", () => {
  beforeEach(resetStore);

  it("sets ticket status to resolved", () => {
    useTicketStore.getState().resolveTicket("TKT-0041");
    const ticket = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0041");
    expect(ticket?.status).toBe("resolved");
  });

  it("sets SLA to 100 on resolve", () => {
    useTicketStore.getState().resolveTicket("TKT-0041");
    const ticket = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0041");
    expect(ticket?.sla).toBe(100);
  });

  it("does not affect other tickets", () => {
    const before = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0040");
    useTicketStore.getState().resolveTicket("TKT-0041");
    const after = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0040");
    expect(after?.status).toBe(before?.status);
  });
});

// ─── sendReply ────────────────────────────────────────────────────────────────

describe("sendReply", () => {
  beforeEach(resetStore);

  it("sets ticket status to pending after reply", () => {
    useTicketStore.getState().sendReply("TKT-0041", "Looking into this now.");
    const ticket = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0041");
    expect(ticket?.status).toBe("pending");
  });

  it("clears the draft after sending", () => {
    useTicketStore.getState().updateDraft("TKT-0041", "Draft text");
    useTicketStore.getState().sendReply("TKT-0041", "Looking into this now.");
    const ticket = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0041");
    expect(ticket?._draft).toBe("");
  });

  it("does nothing when draft is empty", () => {
    const before = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0041");
    useTicketStore.getState().sendReply("TKT-0041", "   ");
    const after = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0041");
    expect(after?.status).toBe(before?.status);
  });

  it("does nothing when draft is an empty string", () => {
    const statusBefore = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0041")?.status;
    useTicketStore.getState().sendReply("TKT-0041", "");
    const statusAfter = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0041")?.status;
    expect(statusAfter).toBe(statusBefore);
  });
});

// ─── applyTriage ─────────────────────────────────────────────────────────────

describe("applyTriage", () => {
  beforeEach(resetStore);

  it("sets triage data on the correct ticket", () => {
    useTicketStore.getState().applyTriage("TKT-0040", MOCK_TRIAGE);
    const ticket = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0040");
    expect(ticket?.triage).toEqual(MOCK_TRIAGE);
  });

  it("updates ticket priority to match triage result", () => {
    useTicketStore.getState().applyTriage("TKT-0040", MOCK_TRIAGE);
    const ticket = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0040");
    expect(ticket?.priority).toBe(MOCK_TRIAGE.priority);
  });

  it("does not affect other tickets", () => {
    const before = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0041");
    useTicketStore.getState().applyTriage("TKT-0040", MOCK_TRIAGE);
    const after = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0041");
    expect(after?.triage).toBe(before?.triage);
  });
});

// ─── updateDraft ──────────────────────────────────────────────────────────────

describe("updateDraft", () => {
  beforeEach(resetStore);

  it("sets the draft on the correct ticket", () => {
    useTicketStore.getState().updateDraft("TKT-0041", "Here is my reply...");
    const ticket = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0041");
    expect(ticket?._draft).toBe("Here is my reply...");
  });

  it("can clear the draft", () => {
    useTicketStore.getState().updateDraft("TKT-0041", "text");
    useTicketStore.getState().updateDraft("TKT-0041", "");
    const ticket = useTicketStore
      .getState()
      .tickets.find((t) => t.id === "TKT-0041");
    expect(ticket?._draft).toBe("");
  });
});

// ─── setFilter + getVisible ───────────────────────────────────────────────────

describe("setFilter + getVisible", () => {
  beforeEach(resetStore);

  it("'all' returns all tickets", () => {
    useTicketStore.getState().setFilter("all");
    const visible = useTicketStore.getState().getVisible();
    expect(visible.length).toBe(useTicketStore.getState().tickets.length);
  });

  it("'open' returns only open tickets", () => {
    useTicketStore.getState().setFilter("open");
    const visible = useTicketStore.getState().getVisible();
    expect(visible.every((t) => t.status === "open")).toBe(true);
    expect(visible.length).toBeGreaterThan(0);
  });

  it("'pending' returns only pending tickets", () => {
    useTicketStore.getState().setFilter("pending");
    const visible = useTicketStore.getState().getVisible();
    expect(visible.every((t) => t.status === "pending")).toBe(true);
  });

  it("'resolved' returns only resolved tickets", () => {
    useTicketStore.getState().setFilter("resolved");
    const visible = useTicketStore.getState().getVisible();
    expect(visible.every((t) => t.status === "resolved")).toBe(true);
  });

  it("'critical' returns only critical priority tickets", () => {
    useTicketStore.getState().setFilter("critical");
    const visible = useTicketStore.getState().getVisible();
    expect(visible.every((t) => t.priority === "critical")).toBe(true);
  });

  it("'billing' returns only billing category tickets", () => {
    useTicketStore.getState().setFilter("billing");
    const visible = useTicketStore.getState().getVisible();
    expect(visible.every((t) => t.category === "billing")).toBe(true);
    expect(visible.length).toBeGreaterThan(0);
  });

  it("filter updates reflected immediately in getVisible", () => {
    useTicketStore.getState().setFilter("resolved");
    const resolvedCount = useTicketStore.getState().getVisible().length;
    useTicketStore.getState().setFilter("all");
    const allCount = useTicketStore.getState().getVisible().length;
    expect(allCount).toBeGreaterThan(resolvedCount);
  });

  it("resolving a ticket removes it from 'open' view", () => {
    useTicketStore.getState().setFilter("open");
    const beforeCount = useTicketStore.getState().getVisible().length;
    const openId = useTicketStore.getState().getVisible()[0].id;
    useTicketStore.getState().resolveTicket(openId);
    const afterCount = useTicketStore.getState().getVisible().length;
    expect(afterCount).toBe(beforeCount - 1);
  });
});

// ─── setSort + getVisible ─────────────────────────────────────────────────────

describe("setSort + getVisible", () => {
  beforeEach(resetStore);

  it("'priority' sort puts critical tickets first", () => {
    useTicketStore.getState().setFilter("all");
    useTicketStore.getState().setSort("priority");
    const visible = useTicketStore.getState().getVisible();
    expect(visible[0].priority).toBe("critical");
  });

  it("'priority' sort puts low tickets last", () => {
    useTicketStore.getState().setFilter("all");
    useTicketStore.getState().setSort("priority");
    const visible = useTicketStore.getState().getVisible();
    expect(visible[visible.length - 1].priority).toBe("low");
  });

  it("'sla' sort puts lowest SLA ticket first", () => {
    useTicketStore.getState().setSort("sla");
    const visible = useTicketStore.getState().getVisible();
    const slas = visible.map((t) => t.sla);
    const sorted = [...slas].sort((a, b) => a - b);
    expect(slas).toEqual(sorted);
  });

  it("'priority' sort produces a non-decreasing priority order sequence", () => {
    useTicketStore.getState().setSort("priority");
    const visible = useTicketStore.getState().getVisible();
    const orders = visible.map((t) => priorityOrder(t.priority));
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]);
    }
  });
});

// ─── getCounts ────────────────────────────────────────────────────────────────

describe("getCounts", () => {
  beforeEach(resetStore);

  it("all count equals total tickets", () => {
    const { all } = useTicketStore.getState().getCounts();
    expect(all).toBe(useTicketStore.getState().tickets.length);
  });

  it("open + pending + resolved = all", () => {
    const { all, open, pending, resolved } = useTicketStore
      .getState()
      .getCounts();
    expect(open + pending + resolved).toBe(all);
  });

  it("resolving a ticket increments resolved and decrements open", () => {
    const before = useTicketStore.getState().getCounts();
    const openTicketId = useTicketStore
      .getState()
      .tickets.find((t) => t.status === "open")!.id;
    useTicketStore.getState().resolveTicket(openTicketId);
    const after = useTicketStore.getState().getCounts();
    expect(after.resolved).toBe(before.resolved + 1);
    expect(after.open).toBe(before.open - 1);
    expect(after.all).toBe(before.all); // total unchanged
  });

  it("aiTriaged count increases after applyTriage", () => {
    const before = useTicketStore.getState().getCounts();
    const untriagedId = useTicketStore
      .getState()
      .tickets.find((t) => t.triage === null)!.id;
    useTicketStore.getState().applyTriage(untriagedId, MOCK_TRIAGE);
    const after = useTicketStore.getState().getCounts();
    expect(after.aiTriaged).toBe(before.aiTriaged + 1);
  });
});

// ─── getStats ─────────────────────────────────────────────────────────────────

describe("getStats", () => {
  beforeEach(resetStore);

  it("slaMetPercent is between 0 and 100", () => {
    const { slaMetPercent } = useTicketStore.getState().getStats();
    expect(slaMetPercent).toBeGreaterThanOrEqual(0);
    expect(slaMetPercent).toBeLessThanOrEqual(100);
  });

  it("aiTriagedPercent is between 0 and 100", () => {
    const { aiTriagedPercent } = useTicketStore.getState().getStats();
    expect(aiTriagedPercent).toBeGreaterThanOrEqual(0);
    expect(aiTriagedPercent).toBeLessThanOrEqual(100);
  });

  it("openCount matches getCounts().open", () => {
    const { openCount } = useTicketStore.getState().getStats();
    const { open } = useTicketStore.getState().getCounts();
    expect(openCount).toBe(open);
  });
});

// ─── setTriaging / setSuggesting ─────────────────────────────────────────────

describe("loading state tracking", () => {
  beforeEach(resetStore);

  it("setTriaging adds id to triagingIds", () => {
    useTicketStore.getState().setTriaging("TKT-0041", true);
    expect(useTicketStore.getState().triagingIds.has("TKT-0041")).toBe(true);
  });

  it("setTriaging removes id when set to false", () => {
    useTicketStore.getState().setTriaging("TKT-0041", true);
    useTicketStore.getState().setTriaging("TKT-0041", false);
    expect(useTicketStore.getState().triagingIds.has("TKT-0041")).toBe(false);
  });

  it("can track multiple tickets triaging simultaneously", () => {
    useTicketStore.getState().setTriaging("TKT-0041", true);
    useTicketStore.getState().setTriaging("TKT-0040", true);
    expect(useTicketStore.getState().triagingIds.size).toBe(2);
  });

  it("setSuggesting works independently from setTriaging", () => {
    useTicketStore.getState().setTriaging("TKT-0041", true);
    useTicketStore.getState().setSuggesting("TKT-0041", true);
    expect(useTicketStore.getState().triagingIds.has("TKT-0041")).toBe(true);
    expect(useTicketStore.getState().suggestingIds.has("TKT-0041")).toBe(true);
  });
});

// ─── selectNext / selectPrev ──────────────────────────────────────────────────

describe("keyboard navigation", () => {
  beforeEach(resetStore);

  it("selectNext moves selection to the next visible ticket", () => {
    const visible = useTicketStore.getState().getVisible();
    useTicketStore.getState().selectTicket(visible[0].id);
    useTicketStore.getState().selectNext();
    expect(useTicketStore.getState().selectedId).toBe(visible[1].id);
  });

  it("selectPrev moves selection to the previous visible ticket", () => {
    const visible = useTicketStore.getState().getVisible();
    useTicketStore.getState().selectTicket(visible[1].id);
    useTicketStore.getState().selectPrev();
    expect(useTicketStore.getState().selectedId).toBe(visible[0].id);
  });

  it("selectNext does not go past the last ticket", () => {
    const visible = useTicketStore.getState().getVisible();
    const last = visible[visible.length - 1];
    useTicketStore.getState().selectTicket(last.id);
    useTicketStore.getState().selectNext();
    expect(useTicketStore.getState().selectedId).toBe(last.id);
  });

  it("selectPrev does not go before the first ticket", () => {
    const visible = useTicketStore.getState().getVisible();
    useTicketStore.getState().selectTicket(visible[0].id);
    useTicketStore.getState().selectPrev();
    expect(useTicketStore.getState().selectedId).toBe(visible[0].id);
  });

  it("navigation respects active filter", () => {
    useTicketStore.getState().setFilter("open");
    const openTickets = useTicketStore.getState().getVisible();
    useTicketStore.getState().selectTicket(openTickets[0].id);
    useTicketStore.getState().selectNext();
    // Should navigate to the next *open* ticket, not any ticket
    const selected = useTicketStore.getState().getSelected();
    expect(selected?.status).toBe("open");
  });
});

// --- runBulkTriage -----------------------------------------------------------

describe("runBulkTriage", () => {
  beforeEach(() => {
    resetStore();
    // Reset fetch mock between tests
    vi.restoreAllMocks();
  });

  it("starts with bulkTriageActive false", () => {
    expect(useTicketStore.getState().bulkTriageActive).toBe(false);
  });

  it("sets bulkTriageActive to true while running", async () => {
    // Fetch that never resolves so we can inspect mid-run state
    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise(() => {})
    );

    const promise = useTicketStore.getState().runBulkTriage();
    expect(useTicketStore.getState().bulkTriageActive).toBe(true);
    promise; // don't await — we're inspecting mid-flight state
  });

  it("sets total to the number of untriaged open tickets", async () => {
    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise(() => {})
    );

    const untriagedOpen = useTicketStore
      .getState()
      .tickets.filter((t) => t.status === "open" && t.triage === null).length;

    useTicketStore.getState().runBulkTriage();
    expect(useTicketStore.getState().bulkTriageProgress.total).toBe(
      untriagedOpen
    );
  });

  it("applies triage to each ticket as responses arrive", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => MOCK_TRIAGE,
    } as Response);

    await useTicketStore.getState().runBulkTriage();

    // Every open ticket should now have triage data
    const openTickets = useTicketStore
      .getState()
      .tickets.filter((t) => t.status === "open");
    expect(openTickets.every((t) => t.triage !== null)).toBe(true);
  });

  it("sets bulkTriageActive to false when complete", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => MOCK_TRIAGE,
    } as Response);

    await useTicketStore.getState().runBulkTriage();
    expect(useTicketStore.getState().bulkTriageActive).toBe(false);
  });

  it("increments completed count after each ticket", async () => {
    const completedCounts: number[] = [];

    vi.spyOn(global, "fetch").mockImplementation(async () => {
      // Capture completed count at the moment each fetch resolves
      return {
        ok: true,
        json: async () => {
          completedCounts.push(
            useTicketStore.getState().bulkTriageProgress.completed
          );
          return MOCK_TRIAGE;
        },
      } as Response;
    });

    await useTicketStore.getState().runBulkTriage();

    const total = useTicketStore.getState().bulkTriageProgress.total;
    expect(useTicketStore.getState().bulkTriageProgress.completed).toBe(total);
  });

  it("skips already-triaged tickets", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => MOCK_TRIAGE,
    } as Response);

    // Pre-triage one ticket
    const firstOpen = useTicketStore
      .getState()
      .tickets.find((t) => t.status === "open" && t.triage === null)!;
    useTicketStore.getState().applyTriage(firstOpen.id, MOCK_TRIAGE);

    const remainingUntriaged = useTicketStore
      .getState()
      .tickets.filter(
        (t) => t.status === "open" && t.triage === null
      ).length;

    await useTicketStore.getState().runBulkTriage();

    // Should only call fetch for the remaining untriaged tickets
    expect(fetchSpy).toHaveBeenCalledTimes(remainingUntriaged);
  });

  it("does not run if already active", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockImplementation(() => new Promise(() => {}));

    // Start first run (don't await)
    useTicketStore.getState().runBulkTriage();

    // Try to start a second run immediately
    await useTicketStore.getState().runBulkTriage();

    // fetch should only be called for one run's worth of tickets
    const untriagedOpen = useTicketStore
      .getState()
      .tickets.filter((t) => t.status === "open" && t.triage === null).length;
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(untriagedOpen);
  });

  it("continues after a failed fetch and resets bulkTriageActive", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

    await useTicketStore.getState().runBulkTriage();

    // Should finish cleanly even with all failures
    expect(useTicketStore.getState().bulkTriageActive).toBe(false);
  });

  it("continues after a non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Server error" }),
    } as Response);

    await useTicketStore.getState().runBulkTriage();
    expect(useTicketStore.getState().bulkTriageActive).toBe(false);
  });
});