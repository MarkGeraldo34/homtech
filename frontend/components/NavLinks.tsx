"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/lend", label: "Lend" },
  { href: "/borrow", label: "Borrow" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`py-3 transition-colors ${active ? "text-accent" : "hover:text-accent"}`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
