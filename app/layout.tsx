import type { Metadata } from "next";
import { DM_Mono, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SupportDesk — AI-Powered Ticket Management",
  description:
    "Internal support ticket dashboard with Claude AI triage, SLA tracking, and intelligent reply suggestions.",
  keywords: ["support", "tickets", "AI triage", "SLA", "helpdesk"],
  authors: [{ name: "Zach" }],
  openGraph: {
    title: "SupportDesk",
    description: "AI-powered support ticket management dashboard",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sora.variable} ${dmMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}