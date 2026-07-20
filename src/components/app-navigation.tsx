"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["Today", "/"],
  ["Pipeline", "/pipeline"],
  ["Communications", "/communications"],
  ["Meetings", "/meetings"],
  ["Proposals", "/proposals"],
  ["Tenders", "/tenders"],
] as const;

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="shared-nav" aria-label="Primary navigation">
      <Link className="brand mono" href="/">Armis Sales OS</Link>
      <div className="nav-links">
        {items.map(([label, href]) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href.split("/").slice(0, 2).join("/"));
          return <Link className={`nav-link ${active ? "active" : ""}`} href={href} key={href}>{label}</Link>;
        })}
      </div>
    </nav>
  );
}
