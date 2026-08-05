"use client";

import { TIER_LABELS } from "@/lib/contracts";

export function TierPicker({ value, onChange }: { value: number; onChange: (tier: number) => void }) {
  return (
    <div className="flex gap-2">
      {TIER_LABELS.map((label, index) => (
        <button
          key={label}
          onClick={() => onChange(index)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            value === index ? "border-black bg-black text-white" : "border-gray-300 text-gray-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
