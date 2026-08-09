"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/lend", label: "Lend" },
  { href: "/borrow", label: "Borrow" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-surface/60 p-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-gradient-to-r from-accent to-accent-2 text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
