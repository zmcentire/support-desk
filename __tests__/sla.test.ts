import { describe, it, expect } from "vitest";
import { slaColor, slaStatus, priorityOrder } from "@/utils/sla";
import type { Priority } from "@/types/ticket";

// ─── slaColor ─────────────────────────────────────────────────────────────────

describe("slaColor", () => {
  describe("healthy range (>= 70)", () => {
    it("returns green at exactly 70", () => {
      expect(slaColor(70)).toBe("var(--green)");
    });

    it("returns green at 100 (fully met)", () => {
      expect(slaColor(100)).toBe("var(--green)");
    });

    it("returns green at 85", () => {
      expect(slaColor(85)).toBe("var(--green)");
    });
  });

  describe("at-risk range (40–69)", () => {
    it("returns yellow at exactly 40", () => {
      expect(slaColor(40)).toBe("var(--yellow)");
    });

    it("returns yellow at 69 (just below healthy)", () => {
      expect(slaColor(69)).toBe("var(--yellow)");
    });

    it("returns yellow at 55", () => {
      expect(slaColor(55)).toBe("var(--yellow)");
    });
  });

  describe("breached range (< 40)", () => {
    it("returns red at 39 (just below at-risk)", () => {
      expect(slaColor(39)).toBe("var(--red)");
    });

    it("returns red at 0 (fully breached)", () => {
      expect(slaColor(0)).toBe("var(--red)");
    });

    it("returns red at 20", () => {
      expect(slaColor(20)).toBe("var(--red)");
    });
  });

  describe("edge cases", () => {
    it("handles negative values as breached", () => {
      expect(slaColor(-1)).toBe("var(--red)");
    });

    it("handles values above 100 as healthy", () => {
      expect(slaColor(110)).toBe("var(--green)");
    });
  });
});

// ─── slaStatus ────────────────────────────────────────────────────────────────

describe("slaStatus", () => {
  it("returns healthy for >= 70", () => {
    expect(slaStatus(70)).toBe("healthy");
    expect(slaStatus(100)).toBe("healthy");
  });

  it("returns at-risk for 40–69", () => {
    expect(slaStatus(40)).toBe("at-risk");
    expect(slaStatus(65)).toBe("at-risk");
  });

  it("returns breached for < 40", () => {
    expect(slaStatus(39)).toBe("breached");
    expect(slaStatus(0)).toBe("breached");
  });

  it("is consistent with slaColor thresholds", () => {
    // The two functions must agree on boundaries
    const testValues = [0, 39, 40, 69, 70, 100];
    for (const v of testValues) {
      const color = slaColor(v);
      const status = slaStatus(v);
      if (status === "healthy") expect(color).toBe("var(--green)");
      if (status === "at-risk") expect(color).toBe("var(--yellow)");
      if (status === "breached") expect(color).toBe("var(--red)");
    }
  });
});

// ─── priorityOrder ────────────────────────────────────────────────────────────

describe("priorityOrder", () => {
  it("critical has the lowest order number (highest urgency)", () => {
    expect(priorityOrder("critical")).toBe(0);
  });

  it("low has the highest order number (lowest urgency)", () => {
    expect(priorityOrder("low")).toBe(3);
  });

  it("sorts correctly: critical < high < medium < low", () => {
    const priorities: Priority[] = ["low", "critical", "medium", "high"];
    const sorted = [...priorities].sort(
      (a, b) => priorityOrder(a) - priorityOrder(b)
    );
    expect(sorted).toEqual(["critical", "high", "medium", "low"]);
  });

  it("returns unique values for all priority levels", () => {
    const orders = (["critical", "high", "medium", "low"] as Priority[]).map(
      priorityOrder
    );
    const unique = new Set(orders);
    expect(unique.size).toBe(4);
  });

  it("all values are non-negative integers", () => {
    const priorities: Priority[] = ["critical", "high", "medium", "low"];
    for (const p of priorities) {
      const order = priorityOrder(p);
      expect(order).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(order)).toBe(true);
    }
  });
});