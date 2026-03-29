"use client";

import { useCallback } from "react";
import { useTicketStore, useIsTriaging } from "@/lib/store";
import type { Ticket, TriageResult } from "@/types/ticket";

interface AiTriagePanelProps {
  ticket: Ticket;
  /** Called when the panel wants to push the suggested response into the reply box */
  onUseResponse: (text: string) => void;
}

export function AiTriagePanel({ ticket, onUseResponse }: AiTriagePanelProps) {
  const applyTriage  = useTicketStore((s) => s.applyTriage);
  const setTriaging  = useTicketStore((s) => s.setTriaging);
  const loading      = useIsTriaging(ticket.id);

  const runTriage = useCallback(async () => {
    if (loading) return;
    setTriaging(ticket.id, true);

    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      });

      if (!res.ok) throw new Error(`Triage failed: ${res.status}`);

      const data: TriageResult = await res.json();
      applyTriage(ticket.id, data);
    } catch {
      // API unavailable — apply a sensible fallback so the panel still
      // shows something useful and the agent can continue working
      const fallback: TriageResult = {
        category: ticket.category,
        priority: ticket.priority,
        sentiment: "frustrated",
        tags: ["support", "user-issue", "needs-investigation"],
        summary: `User is reporting: "${ticket.subject}". Requires prompt investigation.`,
        suggestedResponse: `Thank you for reaching out, ${
          ticket.from.split(" ")[0]
        }. I've reviewed your ticket and I'm looking into this right away. I'll follow up within the hour.`,
      };
      applyTriage(ticket.id, fallback);
    } finally {
      setTriaging(ticket.id, false);
    }
  }, [ticket, loading, applyTriage, setTriaging]);

  // --- Untriaged state -----------------------------------------------------

  if (!ticket.triage) {
    return (
      <div className="ai-block">
        <div className="ai-label">Claude triage analysis</div>
        <div className="ai-text" style={{ color: "var(--text3)" }}>
          Not yet analyzed.
        </div>
        <button
          className={`btn btn-ai btn-sm${loading ? " loading" : ""}`}
          style={{ marginTop: 8 }}
          onClick={runTriage}
          disabled={loading}
        >
          {loading ? (
            <>
              Analyzing
              <span className="typing-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </>
          ) : (
            "✦ Run AI triage"
          )}
        </button>
      </div>
    );
  }

  // --- Triaged state -------------------------------------------------------

  const { triage } = ticket;

  return (
    <div className="ai-block">
      <div className="ai-label">Claude triage analysis</div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span className={`badge badge-${triage.priority}`}>
          {triage.priority.toUpperCase()}
        </span>
        <span className={`badge badge-${triage.category}`}>
          {triage.category}
        </span>
        <span className="badge badge-medium">{triage.sentiment}</span>
      </div>

      <div className="ai-section-label" style={{ marginTop: 10 }}>
        Summary
      </div>
      <div className="ai-text">{triage.summary}</div>

      <div className="ai-section-label">Tags</div>
      <div className="ai-tags">
        {triage.tags.map((tag) => (
          <span key={tag} className="ai-tag">
            {tag}
          </span>
        ))}
      </div>

      <div className="ai-section-label">Suggested response</div>
      <div className="ai-response-box">{triage.suggestedResponse}</div>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onUseResponse(triage.suggestedResponse)}
        >
          Use this response
        </button>
        <button
          className={`btn btn-ai btn-sm${loading ? " loading" : ""}`}
          onClick={runTriage}
          disabled={loading}
          title="Re-run triage analysis"
        >
          {loading ? (
            <>
              Re-analyzing
              <span className="typing-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </>
          ) : (
            "↻ Re-triage"
          )}
        </button>
      </div>
    </div>
  );
}