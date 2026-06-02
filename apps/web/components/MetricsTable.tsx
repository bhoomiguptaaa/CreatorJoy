"use client";

import React from "react";
import { Eye, ThumbsUp, MessageCircle, TrendingUp } from "lucide-react";
import { formatNumber, formatRate } from "@/lib/format";

interface MetricsTableProps {
  videoA: {
    views: number;
    likes: number;
    comments: number;
    engagementRate: number;
  };
  videoB: {
    views: number;
    likes: number;
    comments: number;
    engagementRate: number;
  };
}

export function MetricsTable({ videoA, videoB }: MetricsTableProps) {
  // Helper to calculate delta percentage
  const calculateDelta = (valA: number, valB: number) => {
    if (valA === 0) {
      return valB === 0 ? "0%" : "↑ ∞%";
    }
    const pct = ((valB - valA) / valA) * 100;
    if (pct > 0) {
      return `↑ ${pct.toFixed(1)}%`;
    } else if (pct < 0) {
      return `↓ ${Math.abs(pct).toFixed(1)}%`;
    }
    return "0%";
  };

  const getDeltaColor = (valA: number, valB: number) => {
    if (valB > valA) return "text-emerald-500";
    if (valB < valA) return "text-rose-500";
    return "text-[var(--text-muted)]";
  };

  const renderRow = (
    label: string,
    icon: React.ReactNode,
    valA: number,
    valB: number,
    rowIndex: number,
    isRate: boolean = false
  ) => {
    // Calculate proportional bar widths
    const maxVal = Math.max(valA, valB);
    const widthA = maxVal > 0 ? `${(valA / maxVal) * 100}%` : "0%";
    const widthB = maxVal > 0 ? `${(valB / maxVal) * 100}%` : "0%";

    const formattedA = isRate ? formatRate(valA) : formatNumber(valA);
    const formattedB = isRate ? formatRate(valB) : formatNumber(valB);
    const delta = calculateDelta(valA, valB);
    const deltaColor = getDeltaColor(valA, valB);

    const rowBg = rowIndex % 2 !== 0 ? "bg-white/[0.02]" : "bg-transparent";

    return (
      <div className={`grid grid-cols-[1fr_100px_100px_80px] px-4 py-3 border-b border-[var(--border)]/50 last:border-0 hover:bg-white/[0.04] transition-colors duration-150 items-center ${rowBg}`}>
        {/* Metric Name */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          {icon}
          <span>{label}</span>
        </div>

        {/* Video A Value + Proportional Bar (Purple) */}
        <div className="pr-4">
          <div className="text-sm font-mono font-medium text-[var(--text-primary)]">
            {formattedA}
          </div>
          <div className="w-full bg-white/[0.03] h-0.5 rounded-full mt-1 overflow-hidden">
            <div
              className="bg-[#7C3AED] h-full rounded-full transition-all duration-500"
              style={{ width: widthA }}
            />
          </div>
        </div>

        {/* Video B Value + Proportional Bar (Cyan) */}
        <div className="pr-4">
          <div className="text-sm font-mono font-medium text-[var(--text-primary)]">
            {formattedB}
          </div>
          <div className="w-full bg-white/[0.03] h-0.5 rounded-full mt-1 overflow-hidden">
            <div
              className="bg-[#06b6d4] h-full rounded-full transition-all duration-500"
              style={{ width: widthB }}
            />
          </div>
        </div>

        {/* Delta */}
        <div className={`text-xs font-mono font-semibold ${deltaColor}`}>
          {delta}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden select-none">
      {/* Header Row */}
      <div className="grid grid-cols-[1fr_100px_100px_80px] px-4 py-2.5 border-b border-[var(--border)] text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] items-center">
        <div>Metric</div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
          Video A
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#06b6d4]" />
          Video B
        </div>
        <div>Delta</div>
      </div>

      {/* Rows */}
      {renderRow("Views", <Eye className="w-4 h-4 text-[var(--text-muted)]" />, videoA.views, videoB.views, 0)}
      {renderRow("Likes", <ThumbsUp className="w-4 h-4 text-[var(--text-muted)]" />, videoA.likes, videoB.likes, 1)}
      {renderRow("Comments", <MessageCircle className="w-4 h-4 text-[var(--text-muted)]" />, videoA.comments, videoB.comments, 2)}
      {renderRow("Engagement Rate", <TrendingUp className="w-4 h-4 text-[var(--text-muted)]" />, videoA.engagementRate, videoB.engagementRate, 3, true)}
    </div>
  );
}
