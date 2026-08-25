import type { Metadata } from "next";
import { approveGtmBrief, createGtmBrief, dispatchApprovedGtmBrief, generateSyntheticGtmResults, reviewGtmLead } from "@/app/actions/gtm";
import { requirePageActor } from "@/lib/auth/authorization";
import { listGtmBriefs, listGtmLeadCandidates } from "@/lib/data/gtm";

export const metadata: Metadata = { title: "GTM lead discovery", description: "Build, approve, and review product-led prospecting briefs." };

export default async function GtmPage({ searchParams }: { searchParams: Promise<{ brief?: string; error?: string; approved?: string; synthetic?: string }> }) {
  await requirePageActor(["seller", "manager", "admin"]);
  const params = await searchParams;
  const [briefs, candidates] = await Promise.all([listGtmBriefs(), listGtmLeadCandidates()]);
  const selected = briefs.find((brief) => brief.id === params.brief) ?? briefs[0] ?? null;
  const selectedCandidates = selected ? candidates.filter((lead) => lead.briefId === selected.id) : [];
  const expleeEnabled = process.env.EXPLEE_AUTOGTM_ENABLED === "true";

  return (
    <main className="app-shell"><div className="container">
      <header className="page-header"><div><p className="mono">Guided prospecting</p><h1 className="page-title">GTM <span className="marker">Lead Discovery</span></h1><p className="subtitle">Prepare and approve a structured search brief before any lead fetch. Vibe Prospecting is a workflow reference only; no data is sent to it.</p></div><div className="chips"><span className="chip orange">Explee {expleeEnabled ? "enabled" : "disabled"}</span><span className="chip blue">Synthetic mode</span></div></header>

      {params.error && <div className="card notice-card"><strong>Action not completed.</strong><p className="mono">{params.error.replaceAll("_", " ")}</p></div>}

      <section><div className="section-title"><span className="mono">01</span><h2>Build the ask</h2></div>
        <form className="card form-grid form-grid-wide" action={createGtmBrief}>
          <label>Product or service<input name="productService" required maxLength={200} placeholder="What are we taking to market?" /></label>
          <label>Target industries<input name="targetIndustries" required maxLength={500} placeholder="Banking, healthcare, government" /></label>
          <label>Geographies<input name="geographies" required maxLength={500} placeholder="UAE, Saudi Arabia" /></label>
          <label className="field-span">Company profile<textarea name="companyProfile" required rows={3} maxLength={1200} placeholder="Size, maturity, technology environment, operating model, or other hard filters" /></label>
          <label>Buyer roles<textarea name="buyerRoles" required rows={3} maxLength={800} placeholder="CISO, CIO, Head of IAM" /></label>
          <label>Pain points<textarea name="painPoints" required rows={3} maxLength={1600} placeholder="Problems the offer should solve" /></label>
          <label>Exclusions<textarea name="exclusions" rows={3} maxLength={1000} placeholder="Existing customers, competitors, unsuitable segments" /></label>
          <label>Lead quantity<input name="leadQuantity" type="number" required min={1} max={500} defaultValue={25} /></label>
          <button className="button dark" type="submit">Prepare search brief</button>
        </form>
      </section>

      <section><div className="section-title"><span className="mono">02</span><h2>Review and approve</h2></div>
        {selected ? <div className="workflow-grid">
          <aside className="card stack compact"><p className="mono">Saved briefs</p>{briefs.map((brief) => <a className={`section-link ${brief.id === selected.id ? "active" : ""}`} href={`/gtm?brief=${brief.id}`} key={brief.id}><strong>{brief.productService}</strong><span>{brief.status.replace("_", " ")} · {brief.leadQuantity} leads</span></a>)}</aside>
          <article className="card stack"><div className="card-actions"><span className={`chip ${selected.status === "draft" ? "orange" : "green"}`}>{selected.status.replace("_", " ")}</span><span className="mono">Local structured template</span></div><h2>{selected.structuredBrief.objective}</h2><div><strong>Ideal customer profile</strong><p>{selected.structuredBrief.idealCustomerProfile.industries.join(", ")} · {selected.structuredBrief.idealCustomerProfile.geographies.join(", ")}</p><p>{selected.structuredBrief.idealCustomerProfile.companyProfile}</p></div><div><strong>Buyer roles</strong><p>{selected.structuredBrief.buyerPersona.roles.join(", ")}</p></div><div><strong>Pain hypotheses</strong><ul>{selected.structuredBrief.buyerPersona.painHypotheses.map((pain) => <li key={pain}>{pain}</li>)}</ul></div><div><strong>Exclusions</strong><p>{selected.structuredBrief.exclusions.join(", ") || "None supplied"}</p></div><div className="brief-copy"><strong>Approved search prompt</strong><p>{selected.structuredBrief.searchPrompt}</p></div><div className="card-actions">{selected.status === "draft" && <form action={approveGtmBrief}><input type="hidden" name="id" value={selected.id} /><button className="button dark" type="submit">Approve brief</button></form>}{selected.status === "approved" && <><form action={dispatchApprovedGtmBrief}><input type="hidden" name="id" value={selected.id} /><button className="button dark" type="submit" disabled={!expleeEnabled}>Send to Explee through n8n</button></form><form action={generateSyntheticGtmResults}><input type="hidden" name="id" value={selected.id} /><button className="button" type="submit">Generate synthetic results</button></form></>}</div>{!expleeEnabled && <p className="mono">External dispatch is disabled. Approving a brief never fetches or imports leads.</p>}</article>
        </div> : <div className="empty-state"><h2>No search briefs yet</h2><p>Complete the guided prompt above to prepare the first reviewable ask.</p></div>}
      </section>

      <section><div className="section-title"><span className="mono">03</span><h2>Lead review queue</h2></div>
        {selectedCandidates.length === 0 ? <div className="empty-state"><h2>No candidate leads</h2><p>After approving a brief, use synthetic results to test the review workflow without external data.</p></div> : <div className="table-wrap"><table><caption className="sr-only">GTM lead candidates awaiting review</caption><thead><tr><th>Company</th><th>Buyer</th><th>Fit</th><th>Evidence</th><th>Review</th></tr></thead><tbody>{selectedCandidates.map((lead) => <tr key={lead.id}><td><strong>{lead.companyName}</strong><div>{lead.companyDomain ?? "No domain"}</div><span className="chip blue">{lead.source}</span></td><td>{lead.contactName ?? "Unresolved"}<div>{lead.contactTitle ?? "Role unresolved"}</div><div>{lead.contactEmail ?? "No email"}</div></td><td><strong>{lead.score}/100</strong><div>{lead.industry ?? "—"} · {lead.geography ?? "—"}</div><span className={`chip ${lead.validationStatus === "valid" ? "green" : "orange"}`}>{lead.validationStatus}</span></td><td><ul>{lead.evidence.map((item) => <li key={item}>{item}</li>)}</ul></td><td>{lead.reviewStatus === "pending" ? <div className="stack compact"><form action={reviewGtmLead}><input type="hidden" name="id" value={lead.id} /><input type="hidden" name="decision" value="approved" /><button className="button dark" type="submit">Approve for import</button></form><form action={reviewGtmLead}><input type="hidden" name="id" value={lead.id} /><input type="hidden" name="decision" value="rejected" /><button className="button" type="submit">Reject</button></form></div> : <span className={`chip ${lead.reviewStatus === "approved" ? "green" : "red"}`}>{lead.reviewStatus}</span>}</td></tr>)}</tbody></table></div>}
        <p className="mono">Approval only marks a candidate as eligible for a future import. This Phase 0 workflow never creates an account, contact, or opportunity automatically.</p>
      </section>
    </div></main>
  );
}

