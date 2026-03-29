import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the Anthropic SDK ───────────────────────────────────────────────────
// vi.hoisted ensures mockCreate is defined before vi.mock hoisting kicks in.
// The mock factory must return a class (function with prototype) not a plain
// object, otherwise `new Anthropic(...)` throws "not a constructor".

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => {
  // APIError needs to be a real subclass of Error for instanceof checks in routes
  class APIError extends Error {
    status: number;
    headers: Record<string, string>;
    constructor(
      message: string,
      status = 500,
      headers: Record<string, string> = {}
    ) {
      super(message);
      this.name = "APIError";
      this.status = status;
      this.headers = headers;
    }
  }

  // The default export must be a class (constructable function), not a plain object.
  class Anthropic {
    messages = { create: mockCreate };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts?: unknown) {}
  }

  return {
    default: Anthropic,
    APIError,
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_TICKET = {
  id: "TKT-0040",
  subject: "API rate limit errors on webhook delivery",
  status: "open",
  priority: "high",
  category: "technical",
  from: "Marcus Webb",
  email: "m.webb@devco.io",
  time: "23m ago",
  sla: 78,
  body: "We're seeing 429 errors since 10am UTC despite being within limits.",
  triage: null,
};

const VALID_TRIAGE_RESPONSE = {
  category: "technical",
  priority: "high",
  sentiment: "frustrated",
  tags: ["api", "rate-limit", "webhook"],
  summary: "User experiencing 429 errors despite being within documented rate limits.",
  suggestedResponse: "Hi Marcus, our rate limiter had a misconfiguration during maintenance. This has been resolved.",
};

// ─── /api/triage ─────────────────────────────────────────────────────────────

describe("POST /api/triage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when ticket is missing from body", async () => {
    const { POST } = await import("@/app/api/triage/route");
    const req = makeRequest({});
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid ticket payload/i);
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/triage/route");
    const req = makeRequest({ ticket: { id: "TKT-001" } }); // missing subject + body
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns shaped TriageResult on success", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(VALID_TRIAGE_RESPONSE) }],
    });

    const { POST } = await import("@/app/api/triage/route");
    const req = makeRequest({ ticket: VALID_TICKET });
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.category).toBe("technical");
    expect(json.priority).toBe("high");
    expect(json.sentiment).toBe("frustrated");
    expect(Array.isArray(json.tags)).toBe(true);
    expect(typeof json.summary).toBe("string");
    expect(typeof json.suggestedResponse).toBe("string");
  });

  it("strips markdown fences from AI response", async () => {
    const fenced = "```json\n" + JSON.stringify(VALID_TRIAGE_RESPONSE) + "\n```";
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: fenced }],
    });

    const { POST } = await import("@/app/api/triage/route");
    const req = makeRequest({ ticket: VALID_TICKET });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.category).toBe("technical");
  });

  it("falls back to ticket values when AI returns invalid category", async () => {
    const badResponse = { ...VALID_TRIAGE_RESPONSE, category: "unknown_category" };
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(badResponse) }],
    });

    const { POST } = await import("@/app/api/triage/route");
    const req = makeRequest({ ticket: VALID_TICKET });
    const res = await POST(req as never);
    const json = await res.json();
    // Falls back to original ticket category
    expect(json.category).toBe(VALID_TICKET.category);
  });

  it("falls back to ticket priority when AI returns invalid priority", async () => {
    const badResponse = { ...VALID_TRIAGE_RESPONSE, priority: "extreme" };
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(badResponse) }],
    });

    const { POST } = await import("@/app/api/triage/route");
    const req = makeRequest({ ticket: VALID_TICKET });
    const res = await POST(req as never);
    const json = await res.json();
    expect(json.priority).toBe(VALID_TICKET.priority);
  });

  it("limits tags to 6 even if AI returns more", async () => {
    const manyTags = { ...VALID_TRIAGE_RESPONSE, tags: ["a", "b", "c", "d", "e", "f", "g", "h"] };
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(manyTags) }],
    });

    const { POST } = await import("@/app/api/triage/route");
    const req = makeRequest({ ticket: VALID_TICKET });
    const res = await POST(req as never);
    const json = await res.json();
    expect(json.tags.length).toBeLessThanOrEqual(6);
  });

  it("returns 502 when AI response is not valid JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Sorry, I cannot help with that." }],
    });

    const { POST } = await import("@/app/api/triage/route");
    const req = makeRequest({ ticket: VALID_TICKET });
    const res = await POST(req as never);
    expect(res.status).toBe(502);
  });
});

// ─── /api/suggest ─────────────────────────────────────────────────────────────

describe("POST /api/suggest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 when ticket is missing", async () => {
    const { POST } = await import("@/app/api/suggest/route");
    const req = makeRequest({});
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns suggested reply text on success", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: "Hi Marcus, I've looked into the 429 errors and found the cause.",
        },
      ],
      usage: { input_tokens: 120, output_tokens: 45 },
    });

    const { POST } = await import("@/app/api/suggest/route");
    const req = makeRequest({ ticket: VALID_TICKET });
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.text).toBe("string");
    expect(json.text.length).toBeGreaterThan(0);
  });

  it("includes triage context in AI call when triage is present", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Here is a contextual reply." }],
    });

    const ticketWithTriage = {
      ...VALID_TICKET,
      triage: VALID_TRIAGE_RESPONSE,
    };

    const { POST } = await import("@/app/api/suggest/route");
    const req = makeRequest({ ticket: ticketWithTriage });
    await POST(req as never);

    const callArgs = mockCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content as string;
    expect(userContent).toContain("Triage context");
    expect(userContent).toContain(VALID_TRIAGE_RESPONSE.sentiment);
  });

  it("returns 502 when AI returns empty content", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "" }],
    });

    const { POST } = await import("@/app/api/suggest/route");
    const req = makeRequest({ ticket: VALID_TICKET });
    const res = await POST(req as never);
    expect(res.status).toBe(502);
  });

  it("calls the API with the correct model", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "A helpful reply." }],
    });

    const { POST } = await import("@/app/api/suggest/route");
    const req = makeRequest({ ticket: VALID_TICKET });
    await POST(req as never);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-4-20250514");
    expect(callArgs.max_tokens).toBeLessThanOrEqual(600);
  });
});