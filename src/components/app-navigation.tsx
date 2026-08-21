"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

const items = [
  ["Today", "/"],
  ["Accounts", "/accounts"],
  ["Pipeline", "/pipeline"],
  ["Activities", "/activities"],
  ["Search", "/search"],
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
          return <Link aria-current={active ? "page" : undefined} className={`nav-link ${active ? "active" : ""}`} href={href} key={href}>{label}</Link>;
        })}
        {pathname !== "/sign-in" && <SignOutButton />}
      </div>
    </nav>
  );
}
