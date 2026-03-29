# SupportDesk

An AI-powered support ticket dashboard built with Next.js 14, TypeScript, and the Claude API. Designed to demonstrate production-grade support tooling patterns: SLA tracking, intelligent triage, reply suggestion, and keyboard-driven queue management.

![Next.js](https://img.shields.io/badge/Next.js_14-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Claude API](https://img.shields.io/badge/Claude_API-D97757?style=flat)
![Zustand](https://img.shields.io/badge/Zustand-brown?style=flat)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white)

**[Live Demo →](https://support-desk.vercel.app)**

---

## What it does

Support teams spend significant time on repetitive triage decisions — reading a ticket, deciding priority, drafting an opening reply. SupportDesk demonstrates how an AI layer can handle that first pass, letting agents focus on resolution rather than categorization.

| Feature | Detail |
|---|---|
| **AI triage** | Claude analyzes each ticket and returns structured JSON: category, priority, sentiment, tags, summary, and a draft reply |
| **AI reply suggestion** | One-click reply generation, context-enriched with triage data when available |
| **Bulk triage** | Queues all untriaged open tickets sequentially with a live progress indicator |
| **SLA tracking** | Color-coded SLA bar per ticket (green ≥70%, yellow ≥40%, red <40%) |
| **Keyboard navigation** | `J`/`K` to move between tickets, `Esc` to deselect |
| **Live stats bar** | Open count, avg response time, SLA met %, AI triaged % |
| **Filter + sort** | By status, priority, or category; sort by newest, priority, or SLA risk |

---

## Architecture

```
support-desk/
├── app/
│   ├── layout.tsx              # Root layout, fonts, metadata
│   ├── page.tsx                # Dashboard — all UI components
│   ├── globals.css             # Design system CSS variables + component styles
│   └── api/
│       ├── triage/route.ts     # POST /api/triage  — Claude structured JSON
│       └── suggest/route.ts    # POST /api/suggest — Claude reply generation
├── lib/
│   ├── store.ts                # Zustand store: state, actions, selectors, hooks
│   └── tickets.ts              # Seed ticket data (8 realistic scenarios)
├── types/
│   └── ticket.ts               # Ticket, TriageResult, Priority, Status, Category
├── utils/
│   └── sla.ts                  # slaColor(), slaStatus(), priorityOrder()
├── __tests__/
│   ├── sla.test.ts             # 16 tests — utility functions
│   ├── store.test.ts           # 35 tests — Zustand actions + selectors
│   └── routes.test.ts          # 13 tests — API routes with mocked SDK
└── vitest.config.ts
```

### Key design decisions

**API keys stay server-side.** The original prototype called `api.anthropic.com` directly from the browser. All Claude calls now go through Next.js Route Handlers — the API key never reaches the client.

**Structured triage with validation.** The triage route prompts for strict JSON and validates every field against TypeScript union types before returning. Invalid AI-generated values (e.g. an unrecognized priority) fall back to the ticket's original values rather than crashing.

**Triage context enriches suggestions.** When a ticket has already been triaged, `/api/suggest` includes the sentiment, category, and summary in the Claude prompt. A reply to a `frustrated` customer reads differently than one to a `positive` one.

**Zustand with devtools.** Every action is labeled and visible in Redux DevTools. The store uses fine-grained selector hooks (`useSelectedTicket`, `useVisibleTickets`) so components only re-render when their specific slice changes.

---

## Getting started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
git clone https://github.com/your-username/support-desk.git
cd support-desk
npm install
```

### Environment

Create a `.env.local` file at the project root:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Never commit this file — it's already in `.gitignore`.

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run tests

```bash
npm install -D vitest @vitest/coverage-v8

npx vitest run              # single run
npx vitest                  # watch mode
npx vitest run --coverage   # with coverage report
```

---

## API reference

### `POST /api/triage`

Analyzes a ticket and returns structured triage data.

**Request body**
```json
{
  "ticket": {
    "id": "TKT-0041",
    "subject": "Cannot access my account",
    "body": "I reset my password and now...",
    "from": "Sarah Chen",
    "email": "s.chen@acmecorp.com",
    "category": "account",
    "priority": "high"
  }
}
```

**Response**
```json
{
  "category": "account",
  "priority": "critical",
  "sentiment": "urgent",
  "tags": ["locked-out", "password-reset", "auth"],
  "summary": "User locked out after password reset with time-sensitive client call.",
  "suggestedResponse": "Sarah, I can see your account is locked after 3 failed attempts..."
}
```

**Error responses**

| Status | Reason |
|---|---|
| `400` | Missing or malformed ticket payload |
| `429` | Anthropic rate limit — includes `retryAfter` field |
| `502` | AI response was not valid JSON |
| `500` | Internal server error |

---

### `POST /api/suggest`

Generates a reply draft for a ticket. Includes triage context in the prompt when available.

**Request body**
```json
{
  "ticket": { "...same shape as triage..." }
}
```

**Response**
```json
{
  "text": "Hi Marcus, I've investigated the 429 errors and found the cause..."
}
```

---

## Ticket data model

```typescript
interface Ticket {
  id: string;           // "TKT-0041"
  subject: string;
  status: "open" | "pending" | "resolved";
  priority: "critical" | "high" | "medium" | "low";
  category: "technical" | "billing" | "account" | "feature";
  from: string;         // Customer name
  email: string;
  time: string;         // Relative time string ("4m ago")
  sla: number;          // 0–100, percentage of SLA window remaining
  body: string;         // Full ticket message
  triage: TriageResult | null;
  _draft?: string;      // In-progress reply draft
}
```

---

## What I'd build next

**Persistence** — swap the in-memory ticket array for a Postgres database (Neon or Supabase) with Drizzle ORM. Tickets, triage results, and reply history would persist across sessions.

**Zendesk / Freshdesk integration** — replace the seed data with a real webhook receiver that ingests tickets from a live helpdesk platform via their API.

**Slack notifications** — post a message to a `#support-critical` channel when a ticket is classified as critical priority or SLA drops below 40%.

**Agent assignment** — add an `assignedTo` field and an assignment UI, mirroring how real support queues route tickets to specific agents or tiers.

**Response time analytics** — track actual first-response time per ticket and surface a rolling average, P95, and SLA breach rate in a chart using Recharts.

**Streaming replies** — use the Anthropic streaming API so reply suggestions appear word-by-word rather than all at once, reducing perceived latency on longer drafts.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 App Router | Server components + Route Handlers in one project |
| Language | TypeScript | Union types enforce valid ticket states throughout |
| AI | Anthropic Claude (claude-sonnet-4-20250514) | Structured JSON output, strong instruction-following |
| State | Zustand + devtools | Minimal API, great DX, fine-grained selector hooks |
| Styling | CSS variables + globals | Zero-runtime, matches the dark design system |
| Fonts | Sora + DM Mono | Editorial sans paired with monospace for IDs/badges |
| Testing | Vitest | Fast, ESM-native, identical API to Jest |
| Deployment | Vercel | Zero-config Next.js, edge-ready Route Handlers |

---

## License

MIT
