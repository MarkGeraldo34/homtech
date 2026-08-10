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
    <div className="flex items-center gap-2 sm:gap-1 sm:rounded-full sm:border sm:border-border sm:bg-surface/60 sm:p-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors sm:border-0 ${
              active
                ? "border-transparent bg-gradient-to-r from-accent to-accent-2 text-white shadow-sm"
                : "border-border text-muted hover:border-accent hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
