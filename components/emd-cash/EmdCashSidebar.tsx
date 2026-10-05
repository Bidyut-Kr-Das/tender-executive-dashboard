"use client";

import { BadgeCheck, Clock, FileX, Users, IndianRupee, Hash } from "lucide-react";

export type EmdStatus = "REFUNDED" | "PENDING" | "WRITTEN OFF";

export interface EmdStats {
  count: number;
  totalEmd: number;
  customerCount: number;
}

const STATUS_META: Record<EmdStatus, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  REFUNDED: { label: "Refunded", icon: BadgeCheck, color: "var(--status-won-text)", bg: "var(--status-won-bg)", border: "var(--status-won-border)" },
  PENDING: { label: "Pending", icon: Clock, color: "var(--status-eval-text)", bg: "var(--status-eval-bg)", border: "var(--status-eval-border)" },
  "WRITTEN OFF": { label: "Written Off", icon: FileX, color: "var(--status-lost-text)", bg: "var(--status-lost-bg)", border: "var(--status-lost-border)" },
};

function formatCurrency(n: number) {
  if (!n) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

interface Props {
  stats: Record<EmdStatus, EmdStats>;
  selected: EmdStatus | "ALL";
  onSelect: (s: EmdStatus | "ALL") => void;
  totalRows: number;
}

export function EmdCashSidebar({ stats, selected, onSelect, totalRows }: Props) {
  const allStats: EmdStats = {
    count: totalRows,
    totalEmd: (Object.values(stats) as EmdStats[]).reduce((a, b) => a + b.totalEmd, 0),
    customerCount: 0, // computed separately, pass via prop if needed; here show sum distinct approximation
  };

  const statuses: EmdStatus[] = ["REFUNDED", "PENDING", "WRITTEN OFF"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* All card */}
      <button
        onClick={() => onSelect("ALL")}
        style={{
          textAlign: "left",
          background: selected === "ALL" ? "var(--card)" : "rgba(255,255,255,0.06)",
          border: selected === "ALL" ? "2px solid var(--info)" : "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "14px",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: selected === "ALL" ? "var(--brand-ink)" : "rgba(255,255,255,0.7)" }}>All Statuses</span>
          <span style={{ fontSize: "11px", fontWeight: 700, background: selected === "ALL" ? "var(--info-soft)" : "rgba(255,255,255,0.12)", color: selected === "ALL" ? "var(--info)" : "rgba(255,255,255,0.8)", padding: "2px 8px", borderRadius: "12px" }}>{totalRows}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: selected === "ALL" ? "var(--muted-foreground)" : "rgba(255,255,255,0.6)" }}>
            <Hash size={12} /> Records: <strong style={{ color: selected === "ALL" ? "var(--brand-ink)" : "var(--brand-foreground)" }}>{totalRows}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: selected === "ALL" ? "var(--muted-foreground)" : "rgba(255,255,255,0.6)" }}>
            <IndianRupee size={12} /> Total EMD: <strong style={{ color: selected === "ALL" ? "var(--brand-ink)" : "var(--brand-foreground)" }}>{formatCurrency(allStats.totalEmd)}</strong>
          </div>
        </div>
      </button>

      {statuses.map((key) => {
        const meta = STATUS_META[key];
        const s = stats[key];
        const Icon = meta.icon;
        const isSelected = selected === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(isSelected ? "ALL" : key)}
            style={{
              textAlign: "left",
              background: isSelected ? "var(--card)" : "rgba(255,255,255,0.06)",
              border: isSelected ? `2px solid ${meta.color}` : "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px",
              padding: "12px 14px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <span style={{ width: "28px", height: "28px", borderRadius: "8px", background: isSelected ? meta.bg : "rgba(255,255,255,0.10)", border: `1px solid ${isSelected ? meta.border : "rgba(255,255,255,0.12)"}`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: isSelected ? meta.color : "rgba(255,255,255,0.85)" }}>
                <Icon size={14} />
              </span>
              <span style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.4px", textTransform: "uppercase", color: isSelected ? "var(--brand-ink)" : "var(--brand-foreground)" }}>{meta.label}</span>
              <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: 700, background: isSelected ? meta.bg : "rgba(255,255,255,0.12)", color: isSelected ? meta.color : "rgba(255,255,255,0.9)", border: `1px solid ${isSelected ? meta.border : "transparent"}`, padding: "2px 8px", borderRadius: "12px" }}>{s.count}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: isSelected ? "var(--muted-foreground)" : "rgba(255,255,255,0.6)" }}><Users size={12} /> Customers</span>
                <strong style={{ color: isSelected ? "var(--brand-ink)" : "var(--brand-foreground)", fontSize: "12px" }}>{s.customerCount}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: isSelected ? "var(--muted-foreground)" : "rgba(255,255,255,0.6)" }}><IndianRupee size={12} /> Total EMD</span>
                <strong style={{ color: isSelected ? "var(--brand-ink)" : "var(--brand-foreground)", fontSize: "12px" }}>{formatCurrency(s.totalEmd)}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: isSelected ? "var(--muted-foreground)" : "rgba(255,255,255,0.6)" }}><Hash size={12} /> Records</span>
                <strong style={{ color: isSelected ? "var(--brand-ink)" : "var(--brand-foreground)", fontSize: "12px" }}>{s.count}</strong>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
