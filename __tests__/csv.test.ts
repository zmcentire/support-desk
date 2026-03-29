import { describe, it, expect } from "vitest";
import {
  escapeCell,
  ticketsToCsv,
  buildFilename,
  DEFAULT_COLUMNS,
  type CsvColumn,
} from "@/utils/csv";
import type { Ticket, TriageResult } from "@/types/ticket";

// --- Test Fixtures -----------------------------------------------------------

const MOCK_TRIAGE: TriageResult = {
  category: "technical",
  priority: "high",
  sentiment: "frustrated",
  tags: ["api", "rate-limit", "webhook"],
  summary: "User experiencing 429 errors.",
  suggestedResponse: "Hi Marcus, I've investigated the issue.",
};

const BASE_TICKET: Ticket = {
  id: "TKT-0040",
  subject: "API rate limit errors on webhook delivery",
  status: "open",
  priority: "high",
  category: "technical",
  from: "Marcus Webb",
  email: "m.webb@devco.io",
  time: "23m ago",
  sla: 78,
  body: "We're seeing 429 errors on our webhook endpoint.",
  triage: null,
};

const TRIAGED_TICKET: Ticket = {
  ...BASE_TICKET,
  id: "TKT-0038",
  triage: MOCK_TRIAGE,
};

const BILLING_TICKET: Ticket = {
  id: "TKT-0039",
  subject: "Charged twice for Pro subscription",
  status: "open",
  priority: "high",
  category: "billing",
  from: "Priya Nair",
  email: "priya@startupco.com",
  time: "1h ago",
  sla: 65,
  body: 'I was charged $49 twice on Oct 14th.',
  triage: null,
};

// --- escapeCell --------------------------------------------------------------

describe("escapeCell", () => {
  it("wraps plain strings in double-quotes", () => {
    expect(escapeCell("hello")).toBe('"hello"');
  });

  it("wraps numbers in double-quotes", () => {
    expect(escapeCell(42)).toBe('"42"');
    expect(escapeCell(0)).toBe('"0"');
  });

  it("returns empty quoted string for null", () => {
    expect(escapeCell(null)).toBe('""');
  });

  it("returns empty quoted string for undefined", () => {
    expect(escapeCell(undefined)).toBe('""');
  });

  it("doubles internal double-quotes (RFC 4180)", () => {
    expect(escapeCell('say "hello"')).toBe('"say ""hello"""');
  });

  it("handles multiple internal double-quotes", () => {
    expect(escapeCell('"a" and "b"')).toBe('"""a"" and ""b"""');
  });

  it("preserves commas inside the quoted string", () => {
    const result = escapeCell("one, two, three");
    expect(result).toBe('"one, two, three"');
    // The outer quotes protect the commas from being parsed as delimiters
    expect(result.startsWith('"')).toBe(true);
    expect(result.endsWith('"')).toBe(true);
  });

  it("normalises Windows CRLF line endings to spaces", () => {
    expect(escapeCell("line1\r\nline2")).toBe('"line1 line2"');
  });

  it("normalises bare CR to spaces", () => {
    expect(escapeCell("line1\rline2")).toBe('"line1 line2"');
  });

  it("preserves LF inside quotes (valid for RFC 4180 multiline cells)", () => {
    // LF-only newlines inside quotes are allowed by the spec;
    // we only normalise CR and CRLF which cause Excel row-splitting issues
    const result = escapeCell("line1\nline2");
    expect(result).toContain("line1");
    expect(result).toContain("line2");
  });

  it("handles an empty string", () => {
    expect(escapeCell("")).toBe('""');
  });

  it("handles strings with only whitespace", () => {
    expect(escapeCell("   ")).toBe('"   "');
  });

  it("handles strings with special CSV characters: tab", () => {
    const result = escapeCell("col1\tcol2");
    expect(result).toBe('"col1\tcol2"');
  });
});

// --- ticketsToCsv ------------------------------------------------------------

describe("ticketsToCsv", () => {
  it("returns a string", () => {
    expect(typeof ticketsToCsv([BASE_TICKET])).toBe("string");
  });

  it("includes a header row as the first line", () => {
    const csv = ticketsToCsv([BASE_TICKET]);
    const firstLine = csv.split("\r\n")[0];
    // Header should include known column names
    expect(firstLine).toContain("Ticket ID");
    expect(firstLine).toContain("Subject");
    expect(firstLine).toContain("Status");
    expect(firstLine).toContain("Priority");
  });

  it("produces one data row per ticket", () => {
    const csv = ticketsToCsv([BASE_TICKET, BILLING_TICKET]);
    const lines = csv.split("\r\n");
    // 1 header + 2 data rows
    expect(lines).toHaveLength(3);
  });

  it("uses CRLF as the row delimiter (RFC 4180)", () => {
    const csv = ticketsToCsv([BASE_TICKET]);
    expect(csv).toContain("\r\n");
    // Should not have bare LF-only line endings
    const crlfCount = (csv.match(/\r\n/g) ?? []).length;
    const lfOnlyCount = (csv.replace(/\r\n/g, "").match(/\n/g) ?? []).length;
    expect(lfOnlyCount).toBe(0);
    expect(crlfCount).toBeGreaterThan(0);
  });

  it("includes the ticket ID in the data row", () => {
    const csv = ticketsToCsv([BASE_TICKET]);
    expect(csv).toContain("TKT-0040");
  });

  it("includes the subject in the data row", () => {
    const csv = ticketsToCsv([BASE_TICKET]);
    expect(csv).toContain("API rate limit errors on webhook delivery");
  });

  it("includes the customer email", () => {
    const csv = ticketsToCsv([BASE_TICKET]);
    expect(csv).toContain("m.webb@devco.io");
  });

  it("shows 'no' for AI Triaged when triage is null", () => {
    const csv = ticketsToCsv([BASE_TICKET]);
    expect(csv).toContain('"no"');
  });

  it("shows 'yes' for AI Triaged when triage is present", () => {
    const csv = ticketsToCsv([TRIAGED_TICKET]);
    expect(csv).toContain('"yes"');
  });

  it("includes triage tags joined by semicolons", () => {
    const csv = ticketsToCsv([TRIAGED_TICKET]);
    expect(csv).toContain("api; rate-limit; webhook");
  });

  it("includes triage summary", () => {
    const csv = ticketsToCsv([TRIAGED_TICKET]);
    expect(csv).toContain("User experiencing 429 errors.");
  });

  it("outputs empty strings for triage fields when triage is null", () => {
    const csv = ticketsToCsv([BASE_TICKET]);
    // AI Priority, AI Category, AI Sentiment, AI Tags, AI Summary should all be ""
    const dataRow = csv.split("\r\n")[1];
    // Count consecutive empty quoted fields
    const emptyFields = (dataRow.match(/"",/g) ?? []).length;
    expect(emptyFields).toBeGreaterThanOrEqual(4);
  });

  it("produces correct column count in every row", () => {
    const csv = ticketsToCsv([BASE_TICKET, TRIAGED_TICKET]);
    const lines = csv.split("\r\n");
    const expectedCols = DEFAULT_COLUMNS.length;

    for (const line of lines) {
      // Count top-level commas (not inside quotes)
      let inQuotes = false;
      let commas = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        else if (line[i] === "," && !inQuotes) commas++;
      }
      expect(commas).toBe(expectedCols - 1);
    }
  });

  it("returns just a header row for an empty ticket array", () => {
    const csv = ticketsToCsv([]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Ticket ID");
  });

  it("accepts custom column definitions", () => {
    const customColumns: CsvColumn[] = [
      { header: "ID", getValue: (t) => t.id },
      { header: "Email", getValue: (t) => t.email },
    ];
    const csv = ticketsToCsv([BASE_TICKET], customColumns);
    const [header, dataRow] = csv.split("\r\n");
    expect(header).toBe('"ID","Email"');
    expect(dataRow).toBe('"TKT-0040","m.webb@devco.io"');
  });

  it("handles ticket body with commas and quotes safely", () => {
    const ticket: Ticket = {
      ...BASE_TICKET,
      body: 'He said, "the API is broken" and it\'s urgent.',
    };
    const csv = ticketsToCsv([ticket]);
    // Should not throw and the output should be parseable
    expect(csv).toContain('He said,');
    // The double-quote should be doubled inside the cell
    expect(csv).toContain('""the API is broken""');
  });

  it("handles a ticket with no triage data without throwing", () => {
    expect(() => ticketsToCsv([BASE_TICKET])).not.toThrow();
  });

  it("handles multiple tickets with mixed triage states", () => {
    expect(() =>
      ticketsToCsv([BASE_TICKET, TRIAGED_TICKET, BILLING_TICKET])
    ).not.toThrow();
    const csv = ticketsToCsv([BASE_TICKET, TRIAGED_TICKET, BILLING_TICKET]);
    expect(csv.split("\r\n")).toHaveLength(4); // 1 header + 3 rows
  });
});

// --- buildFilename -----------------------------------------------------------

describe("buildFilename", () => {
  it("returns a string ending in .csv", () => {
    expect(buildFilename()).toMatch(/\.csv$/);
  });

  it("includes today's date in YYYY-MM-DD format", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(buildFilename()).toContain(today);
  });

  it("uses the default prefix when none is provided", () => {
    expect(buildFilename()).toMatch(/^support-tickets-/);
  });

  it("uses a custom prefix when provided", () => {
    expect(buildFilename("support-tickets-open")).toMatch(
      /^support-tickets-open-/
    );
  });

  it("produces a valid filename with no spaces", () => {
    const filename = buildFilename();
    expect(filename).not.toContain(" ");
  });

  it("produces a different filename for different prefixes", () => {
    expect(buildFilename("open")).not.toBe(buildFilename("resolved"));
  });
});