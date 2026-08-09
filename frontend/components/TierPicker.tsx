"use client";

import { TIER_LABELS } from "@/lib/contracts";

export function TierPicker({ value, onChange }: { value: number; onChange: (tier: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TIER_LABELS.map((label, index) => {
        const active = value === index;
        return (
          <button
            key={label}
            onClick={() => onChange(index)}
            aria-pressed={active}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${
              active
                ? "border-transparent bg-gradient-to-r from-accent to-accent-2 text-white shadow-sm shadow-accent/30 scale-[1.03]"
                : "border-border bg-surface/60 text-foreground hover:border-accent hover:text-accent"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
