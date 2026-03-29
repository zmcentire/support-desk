import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { Ticket } from "@/types/ticket";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SUGGEST_SYSTEM_PROMPT = `You are an experienced support engineer writing a reply to a customer ticket.

Guidelines:
- Be concise but genuinely helpful: 2-4 sentences
- Be specific to the exact issue described — never write a generic response
- Be empathetic without being sycophantic ("I totally understand how frustrating that must be!" is not allowed)
- If it's a bug or outage, acknowledge it directly and give a concrete next step or timeline if possible
- If it's a billing issue, be specific about what will happen (refund, investigation, etc.)
- If it's a feature request, acknowledge it has been logged and offer any available workaround
- Never start with "Thank you for contacting us" or "I hope this message finds you well"
- Never promise things you can't guarantee
- Write in plain, natural language — not corporate support-speak
- Do not add a sign-off or signature; the system will append that automatically
- Output ONLY the reply text — no subject, no label, no preamble`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ticket: Ticket = body.ticket;

    if (!ticket?.id || !ticket?.subject || !ticket?.body) {
      return NextResponse.json(
        { error: "Invalid ticket payload" },
        { status: 400 }
      );
    }

    // Enrich context with triage data if already available
    const triageContext = ticket.triage
      ? [
          `Triage context:`,
          `- Category: ${ticket.triage.category}`,
          `- Priority: ${ticket.triage.priority}`,
          `- Customer sentiment: ${ticket.triage.sentiment}`,
          `- Issue summary: ${ticket.triage.summary}`,
          ``,
        ].join("\n")
      : "";

    const userContent = [
      `Ticket ID: ${ticket.id}`,
      `Subject: ${ticket.subject}`,
      `Customer name: ${ticket.from}`,
      `Customer email: ${ticket.email}`,
      `SLA: ${ticket.sla}% remaining`,
      ``,
      triageContext,
      `Customer message:`,
      ticket.body,
      ``,
      `Write a reply to send to ${ticket.from.split(" ")[0]}.`,
    ].join("\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: SUGGEST_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const text =
      message.content.find((b) => b.type === "text")?.text?.trim() ?? "";

    if (!text) {
      return NextResponse.json(
        { error: "Empty response from AI" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      text,
      // Surface token usage for debugging/monitoring in development
      ...(process.env.NODE_ENV === "development" && {
        usage: message.usage,
      }),
    });
  } catch (err) {
    console.error("[/api/suggest] Error:", err);

    if (err instanceof Anthropic.APIError) {
      // Surface rate limit info so the client can back off
      if (err.status === 429) {
        return NextResponse.json(
          {
            error: "Rate limited — please wait a moment before trying again",
            retryAfter: err.headers?.["retry-after"] ?? "60",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `Anthropic API error: ${err.message}` },
        { status: err.status ?? 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}