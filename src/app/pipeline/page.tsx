import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { listOpportunities } from "@/lib/data/opportunities";
import { listAccounts } from "@/lib/data/sales-workflows";
import { createOpportunity } from "@/app/actions/sales";
import { requirePageActor } from "@/lib/auth/authorization";

export default async function PipelinePage() {
  await requirePageActor();
  const [deals, accounts] = await Promise.all([listOpportunities(), listAccounts()]);
  const missingNextStep = deals.filter((deal) => deal.nextStep === "Define next step").length;
  const averageProbability = deals.length ? Math.round(deals.reduce((total, deal) => total + deal.probability, 0) / deals.length) : 0;
  return (
    <main className="app-shell">
      <div className="container">
        <Link className="back-link mono" href="/"><ArrowLeft size={14} /> Control Center</Link>
        <header className="header-grid compact-header">
          <div>
            <p className="mono">Repository-backed pipeline</p>
            <h1 className="title">Active <span className="marker">Pipeline</span></h1>
            <p className="subtitle">A management view of value, concentration, momentum and the opportunities that require intervention.</p>
          </div>
          <aside className="sync-panel mono"><p>{deals.length} visible opportunities</p><p>{averageProbability}% average probability</p><p>{missingNextStep} missing next steps</p></aside>
        </header>

        <section className="intelligence">
          <p className="mono">Pipeline reading</p>
          <h2>{missingNextStep > 0 ? <><span className="highlight">{missingNextStep} opportunit{missingNextStep === 1 ? "y is" : "ies are"}</span> missing a defined next step.</> : <>Every visible opportunity has a <span className="highlight">defined next step</span>.</>}</h2>
          <p>Stage names remain configurable text until the sales team approves a canonical pipeline taxonomy.</p>
        </section>

        <section>
          <div className="section-title"><span className="mono">01</span><h2>Position</h2></div>
          <div className="grid grid-3"><article className="card metric"><p className="mono">Visible opportunities</p><strong>{deals.length}</strong><p>RLS-authorized records.</p></article><article className="card metric"><p className="mono">Average probability</p><strong>{averageProbability}%</strong><p>Seller-entered probability; forecasting is deferred.</p></article><article className="card metric"><p className="mono">Missing next step</p><strong>{missingNextStep}</strong><p>Records requiring sales hygiene.</p></article></div>
        </section>

        <section><div className="section-title"><span className="mono">02</span><h2>Create opportunity</h2></div><form className="card form-grid form-grid-wide" action={createOpportunity}><label>Account<select name="accountId" required defaultValue=""><option value="" disabled>Select account</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label><label>Opportunity name<input name="name" required maxLength={200} /></label><label>Stage<input name="stage" required maxLength={80} placeholder="Pending approved stage taxonomy" /></label><label>Value (AED)<input name="valueAmount" type="number" min="0" step="0.01" required /></label><label>Probability<input name="probability" type="number" min="0" max="100" required /></label><label>Expected close<input name="expectedCloseDate" type="date" /></label><label className="field-span">Next step<textarea name="nextStep" maxLength={500} rows={2} /></label><button className="button dark" type="submit" disabled={accounts.length === 0}>Create opportunity</button></form></section>

        <section>
          <div className="section-title"><span className="mono">03</span><h2>Opportunity register</h2></div>
          <div className="table-wrap">
            <table><thead><tr><th>Account</th><th>Opportunity</th><th>Stage</th><th>Value</th><th>Probability</th><th>Close</th><th>Next step</th><th>Health</th><th /></tr></thead>
              <tbody>{deals.map((deal) => <tr key={`${deal.account}-${deal.opportunity}`}><td><strong>{deal.account}</strong>{deal.attention && <div className="chips"><span className="chip orange">{deal.attention}</span></div>}</td><td>{deal.opportunity}</td><td>{deal.stage}</td><td>{deal.value}</td><td>{deal.probability}%</td><td>{deal.closeDate}</td><td>{deal.nextStep}</td><td>{deal.health}/100</td><td>{deal.id ? <Link className="icon-link" href={`/deals/${deal.id}`}><ArrowUpRight size={16} /></Link> : <span className="icon-link disabled" aria-hidden><ArrowUpRight size={16} /></span>}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
