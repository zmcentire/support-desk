import type { Ticket } from "@/types/ticket";

// --- Column Definitions ------------------------------------------------------

/**
 * Each column knows how to extract its value from a ticket.
 * Keeping this as a declarative array makes it easy to reorder,
 * add, or remove columns without touching the serialisation logic.
 */
export interface CsvColumn {
  /** Header label that appears in row 1 of the CSV */
  header: string;
  /** Extracts the raw value for this column from a ticket */
  getValue: (ticket: Ticket) => string | number | null | undefined;
}

export const DEFAULT_COLUMNS: CsvColumn[] = [
  { header: "Ticket ID",       getValue: (t) => t.id },
  { header: "Subject",         getValue: (t) => t.subject },
  { header: "Status",          getValue: (t) => t.status },
  { header: "Priority",        getValue: (t) => t.priority },
  { header: "Category",        getValue: (t) => t.category },
  { header: "Customer Name",   getValue: (t) => t.from },
  { header: "Customer Email",  getValue: (t) => t.email },
  { header: "SLA %",           getValue: (t) => t.sla },
  { header: "Created",         getValue: (t) => t.time },
  { header: "AI Triaged",      getValue: (t) => (t.triage ? "yes" : "no") },
  { header: "AI Priority",     getValue: (t) => t.triage?.priority ?? "" },
  { header: "AI Category",     getValue: (t) => t.triage?.category ?? "" },
  { header: "AI Sentiment",    getValue: (t) => t.triage?.sentiment ?? "" },
  { header: "AI Tags",         getValue: (t) => t.triage?.tags.join("; ") ?? "" },
  { header: "AI Summary",      getValue: (t) => t.triage?.summary ?? "" },
  { header: "Message",         getValue: (t) => t.body },
];

// --- Core Serialisation ------------------------------------------------------

/**
 * Escapes a single cell value for CSV.
 *
 * Rules (RFC 4180):
 *  - Always wrap in double-quotes so commas/newlines in ticket bodies are safe
 *  - Escape existing double-quotes by doubling them ("he said ""hi""")
 *  - Null / undefined become an empty string
 */
export function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value)
    // Normalise Windows-style line endings so Excel doesn't create extra rows
    .replace(/\r\n/g, " ")
    .replace(/\r/g, " ")
    // Double any existing double-quotes
    .replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Converts an array of tickets to a CSV string.
 *
 * @param tickets  The tickets to serialise (already filtered / sorted by caller)
 * @param columns  Column definitions — defaults to DEFAULT_COLUMNS
 * @returns        A UTF-8 CSV string with a header row followed by one row per ticket
 */
export function ticketsToCsv(
  tickets: Ticket[],
  columns: CsvColumn[] = DEFAULT_COLUMNS
): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");

  const rows = tickets.map((ticket) =>
    columns.map((c) => escapeCell(c.getValue(ticket))).join(",")
  );

  return [header, ...rows].join("\r\n");
}

// --- Browser Download Trigger ------------------------------------------------

/**
 * Generates a filename with the current date baked in.
 * Example: "support-tickets-2025-10-14.csv"
 */
export function buildFilename(prefix = "support-tickets"): string {
  const date = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return `${prefix}-${date}.csv`;
}

/**
 * Triggers a CSV file download in the browser.
 *
 * Creates a temporary <a> element, attaches a Blob URL, clicks it, and
 * immediately revokes the URL — no server round-trip needed.
 *
 * @param tickets   Tickets to export
 * @param filename  Optional filename override
 * @param columns   Optional column override
 */
export function downloadCsv(
  tickets: Ticket[],
  filename = buildFilename(),
  columns: CsvColumn[] = DEFAULT_COLUMNS
): void {
  if (tickets.length === 0) return;

  const csv = ticketsToCsv(tickets, columns);

  // BOM prefix ensures Excel on Windows opens the file in UTF-8 correctly
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke after a short delay to ensure the download has started
  setTimeout(() => URL.revokeObjectURL(url), 100);
}