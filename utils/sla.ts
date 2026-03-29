import type { Priority } from "@/types/ticket";

/**
 * Returns a CSS color variable string based on SLA percentage remaining.
 * >= 70  → green (healthy)
 * >= 40  → yellow (at risk)
 * < 40   → red (breached or imminent)
 */
export function slaColor(value: number): string {
  if (value >= 70) return "var(--green)";
  if (value >= 40) return "var(--yellow)";
  return "var(--red)";
}

/**
 * Returns a sort weight for priority — lower = higher urgency.
 * Used for priority-based ticket queue sorting.
 */
export function priorityOrder(priority: Priority): number {
  const order: Record<Priority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return order[priority] ?? 99;
}

/**
 * Returns a human-readable SLA status label.
 */
export function slaStatus(value: number): "healthy" | "at-risk" | "breached" {
  if (value >= 70) return "healthy";
  if (value >= 40) return "at-risk";
  return "breached";
}