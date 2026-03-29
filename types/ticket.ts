export type Priority = "critical" | "high" | "medium" | "low";
export type Status = "open" | "pending" | "resolved";
export type Category = "technical" | "billing" | "account" | "feature";
export type Sentiment = "frustrated" | "neutral" | "positive" | "urgent";

export interface TriageResult {
  category: Category;
  priority: Priority;
  sentiment: Sentiment;
  tags: string[];
  summary: string;
  suggestedResponse: string;
}

export interface Ticket {
  id: string;
  subject: string;
  status: Status;
  priority: Priority;
  category: Category;
  from: string;
  email: string;
  time: string;
  sla: number;
  body: string;
  triage: TriageResult | null;
  _draft?: string;
}