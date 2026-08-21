import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/lib/auth/authorization";
import { searchSalesRecords } from "@/lib/data/sales-workflows";

export const metadata: Metadata = { title: "Search", description: "Permission-aware search across core sales records." };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePageActor();
  const { q = "" } = await searchParams;
  const results = await searchSalesRecords(q);
  return <main className="app-shell"><div className="container"><header className="page-header"><div><p className="mono">Authorized records only</p><h1 className="page-title">Sales <span className="marker">Search</span></h1></div></header><form className="search-form" method="get"><label className="sr-only" htmlFor="sales-search">Search records</label><input id="sales-search" name="q" defaultValue={q} minLength={2} maxLength={80} placeholder="Account, contact, opportunity, or activity" /><button className="button dark" type="submit">Search</button></form>{q.length > 0 && q.length < 2 ? <p>Enter at least two characters.</p> : results.length === 0 ? <div className="empty-state"><h2>No matching records</h2><p>Search only returns records permitted by row-level security.</p></div> : <div className="stack">{results.map((result) => <Link className="card row-card" href={result.href} key={`${result.type}-${result.id}`}><span className="chip">{result.type}</span><div><h3>{result.title}</h3><p>{result.subtitle ?? "No additional details"}</p></div><span aria-hidden>→</span></Link>)}</div>}</div></main>;
}
