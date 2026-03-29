"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTicketStore, useIsSuggesting, useSelectedTicket } from "@/lib/store";
import { AiTriagePanel } from "@/components/AiTriagePanel";

export function TicketDetail() {
  const ticket       = useSelectedTicket();
  const updateDraft  = useTicketStore((s) => s.updateDraft);
  const sendReply    = useTicketStore((s) => s.sendReply);
  const resolveTicket = useTicketStore((s) => s.resolveTicket);
  const setSuggesting = useTicketStore((s) => s.setSuggesting);

  const suggesting   = useIsSuggesting(ticket?.id ?? "");
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  // Local draft mirrors the store value; updates are flushed to the store
  // on every keystroke so the value survives ticket re-selection.
  const [draft, setDraft] = useState(ticket?._draft ?? "");

  // Sync local draft when the selected ticket changes
  useEffect(() => {
    setDraft(ticket?._draft ?? "");
  }, [ticket?.id, ticket?._draft]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (ticket) updateDraft(ticket.id, value);
  };

  const suggestReply = useCallback(async () => {
    if (!ticket || suggesting) return;
    setSuggesting(ticket.id, true);

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      });

      if (!res.ok) throw new Error(`Suggest failed: ${res.status}`);
      const { text } = await res.json();
      setDraft(text);
      updateDraft(ticket.id, text);
    } catch {
      const fallback =
        ticket.triage?.suggestedResponse ??
        "Thank you for reaching out. I'm looking into this and will follow up shortly.";
      setDraft(fallback);
      updateDraft(ticket.id, fallback);
    } finally {
      setSuggesting(ticket.id, false);
    }
  }, [ticket, suggesting, setSuggesting, updateDraft]);

  // --- Empty state ----------------------------------------------------------

  if (!ticket) {
    return (
      <div className="detail">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            gap: 10,
            color: "var(--text3)",
          }}
        >
          <div style={{ fontSize: 32, opacity: 0.2 }}>◫</div>
          <div style={{ fontSize: 12 }}>Select a ticket to view</div>
          <div style={{ fontSize: 11, color: "var(--text3)", opacity: 0.6 }}>
            Use J / K to navigate
          </div>
        </div>
      </div>
    );
  }

  // --- Status badge colour --------------------------------------------------

  const statusBadgeClass =
    ticket.status === "resolved"
      ? "low"
      : ticket.status === "pending"
      ? "medium"
      : "high";

  // --- Rendered detail panel ------------------------------------------------

  return (
    <div className="detail">
      {/* Header */}
      <div className="detail-header">
        <div className="detail-id">
          {ticket.id} · {ticket.status.toUpperCase()} · SLA {ticket.sla}%
        </div>
        <div className="detail-subject">{ticket.subject}</div>
        <div className="detail-chips">
          <span className={`badge badge-${ticket.priority}`}>
            {ticket.priority.toUpperCase()}
          </span>
          <span className={`badge badge-${ticket.category}`}>
            {ticket.category}
          </span>
          <span className={`badge badge-${statusBadgeClass}`}>
            {ticket.status}
          </span>
        </div>
      </div>

      {/* Body: original message + AI triage panel */}
      <div className="detail-body">
        <div className="msg-block">
          <div className="msg-from">
            From <span>{ticket.from}</span> &lt;{ticket.email}&gt; ·{" "}
            {ticket.time}
          </div>
          <div className="msg-bubble">{ticket.body}</div>
        </div>

        <AiTriagePanel
          ticket={ticket}
          onUseResponse={(text) => {
            setDraft(text);
            updateDraft(ticket.id, text);
            // Move focus to reply box so the agent can edit immediately
            textareaRef.current?.focus();
          }}
        />
      </div>

      {/* Footer: reply box + actions */}
      <div className="detail-footer">
        <textarea
          ref={textareaRef}
          className="reply-box"
          placeholder="Write a reply…"
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          rows={3}
        />

        <div className="footer-actions">
          <button
            className="btn btn-primary"
            onClick={() => sendReply(ticket.id, draft)}
            disabled={!draft.trim()}
          >
            Send reply
          </button>

          <button
            className={`btn btn-ai${suggesting ? " loading" : ""}`}
            onClick={suggestReply}
            disabled={suggesting}
          >
            {suggesting ? (
              <>
                Generating
                <span className="typing-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </>
            ) : (
              "✦ AI suggest"
            )}
          </button>

          {ticket.status !== "resolved" && (
            <button
              className="btn btn-ghost"
              onClick={() => resolveTicket(ticket.id)}
            >
              Resolve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}