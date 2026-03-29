"use client";

import { useTicketStats } from "@/lib/store";

interface StatProps {
  value: string | number;
  label: string;
  color?: string;
}

function Stat({ value, label, color }: StatProps) {
  return (
    <div className="stat">
      <div className="stat-val" style={color ? { color } : {}}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function StatsBar() {
  const { openCount, slaMetPercent, aiTriagedPercent } = useTicketStats();

  const slaColor =
    slaMetPercent >= 80 ? "var(--green)" : "var(--yellow)";

  return (
    <div className="stats-bar">
      <Stat value={openCount} label="Open" />
      <Stat value="2.4h"      label="Avg response" />
      <Stat
        value={`${slaMetPercent}%`}
        label="SLA met"
        color={slaColor}
      />
      <Stat
        value={`${aiTriagedPercent}%`}
        label="AI triaged"
        color="var(--accent)"
      />
    </div>
  );
}