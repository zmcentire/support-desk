import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { Ticket, TriageResult, Priority, Category, Sentiment } from "@/types/ticket";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TRIAGE_SYSTEM_PROMPT = `You are an expert support ticket triage system. Analyze the provided ticket and respond with ONLY a valid JSON object — no markdown, no backticks, no preamble.

Required fields:
- category: one of "technical" | "billing" | "account" | "feature"
- priority: one of "critical" | "high" | "medium" | "low"
- sentiment: one of "frustrated" | "neutral" | "positive" | "urgent"
- tags: array of 3-5 lowercase keyword strings relevant to the issue
- summary: 1-2 sentence summary of the issue and its likely cause or category
- suggestedResponse: a concise, empathetic, professional reply (2-4 sentences). Be specific to the issue. Don't use a generic opener like "Thank you for contacting us."

Priority guidance:
- critical: user is completely blocked, time-sensitive (e.g. locked out before a meeting, data loss risk)
- high: significant impact, no workaround, affects core workflow
- medium: moderate impact, partial workaround may exist
- low: minor inconvenience, enhancement requests

Sentiment guidance:
- frustrated: user expresses irritation, repeating themselves, or has waited too long
- urgent: user signals urgency explicitly ("ASAP", "client call in 1 hour")
- positive: user is calm, polite, or expansion-focused
- neutral: factual, no strong emotional signal`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ticket: Ticket = body.ticket;

    if (!ticket?.id || !ticket?.subject || !ticket?.body) {
      return NextResponse.json(
        { error: "Invalid ticket payload — id, subject, and body are required" },
        { status: 400 }
      );
    }

    const userContent = [
      `Ticket ID: ${ticket.id}`,
      `Subject: ${ticket.subject}`,
      `From: ${ticket.from} <${ticket.email}>`,
      `Category hint: ${ticket.category}`,
      `Current priority: ${ticket.priority}`,
      ``,
      `Message:`,
      ticket.body,
    ].join("\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: TRIAGE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const rawText =
      message.content.find((b) => b.type === "text")?.text ?? "{}";

    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/```(?:json)?|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    // Validate and shape the response
    const validCategories: Category[] = ["technical", "billing", "account", "feature"];
    const validPriorities: Priority[] = ["critical", "high", "medium", "low"];
    const validSentiments: Sentiment[] = ["frustrated", "neutral", "positive", "urgent"];

    const triage: TriageResult = {
      category: validCategories.includes(parsed.category as Category)
        ? (parsed.category as Category)
        : ticket.category,
      priority: validPriorities.includes(parsed.priority as Priority)
        ? (parsed.priority as Priority)
        : ticket.priority,
      sentiment: validSentiments.includes(parsed.sentiment as Sentiment)
        ? (parsed.sentiment as Sentiment)
        : "neutral",
      tags: Array.isArray(parsed.tags)
        ? (parsed.tags as string[]).slice(0, 6)
        : [],
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary
          : "No summary available.",
      suggestedResponse:
        typeof parsed.suggestedResponse === "string"
          ? parsed.suggestedResponse
          : "Thank you for reaching out. I'm looking into this and will follow up shortly.",
    };

    return NextResponse.json(triage);
  } catch (err) {
    console.error("[/api/triage] Error:", err);

    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Failed to parse AI response as JSON" },
        { status: 502 }
      );
    }

    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${err.message}`, status: err.status },
        { status: err.status ?? 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}