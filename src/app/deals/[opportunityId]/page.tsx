import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getOpportunity } from "@/lib/data/opportunities";
import { SupabaseNotConfiguredError } from "@/lib/data/errors";
import { requirePageActor } from "@/lib/auth/authorization";
import { listContacts } from "@/lib/data/sales-workflows";
import { OpportunityContactForm, OpportunityEditForm, OpportunityReassignForm, OpportunityTransitionForm } from "@/components/crm-forms";
import { listAssignableUsers } from "@/lib/data/crm-details";
import { stageLabel } from "@/lib/crm/catalog";

export default async function DealPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const actor = await requirePageActor();
  const { opportunityId } = await params;

  let deal;
  try {
    deal = await getOpportunity(opportunityId);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return (
        <main className="app-shell">
          <div className="container">
            <Link className="back-link mono" href="/pipeline"><ArrowLeft size={14} /> Pipeline</Link>
            <div className="empty-state">
              <h2>Supabase is not configured</h2>
              <p>Connect a Supabase project to view live opportunity data.</p>
            </div>
          </div>
        </main>
      );
    }
    throw error;
  }

  if (!deal) notFound();
  const [assignableUsers, contacts] = await Promise.all([listAssignableUsers(actor.id, actor.role), listContacts()]);
  const linkedContactIds = new Set(deal.stakeholders.map((s) => s.contactId));
  const linkableContacts = contacts.filter((c) => c.accountId === deal.accountId && !linkedContactIds.has(c.id));

  return (
    <main className="app-shell">
      <div className="container">
        <Link className="back-link mono" href="/pipeline"><ArrowLeft size={14} /> Pipeline</Link>
        <header className="deal-header">
          <div>
            <p className="mono">{deal.account} · Owner: {deal.owner}</p>
            <h1 className="title">{deal.account} <span className="marker">{deal.opportunity}</span></h1>
            <p className="subtitle">{deal.value} · {deal.probability}% canonical probability · {stageLabel(deal.stage)} · Expected close {deal.closeDate}</p>
          </div>
          <div className="score-card"><span className="mono">Opportunity health</span><strong>{deal.health}</strong><span>/100</span></div>
        </header>

        <section className="intelligence"><p className="mono">Next step</p><h2>{deal.nextStep}</h2>{deal.attention && <p>Flagged: {deal.attention}</p>}</section>

        {deal.ownerId === actor.id ? <section><div className="section-title"><span className="mono">Edit</span><h2>Opportunity details</h2></div><div className="workflow-grid"><OpportunityEditForm opportunity={{id:deal.id!,version:deal.recordVersion,name:deal.opportunity,valueAmount:deal.valueAmount ?? 0,expectedCloseDate:deal.expectedCloseDate,nextStep:deal.nextStep === "Define next step" ? "" : deal.nextStep}}/><OpportunityTransitionForm id={deal.id!} version={deal.recordVersion} stage={deal.stage}/></div></section> : <p className="card notice-card">You have manager visibility. Only the owner can edit or transition this opportunity.</p>}
        {(actor.role === "manager" || actor.role === "admin") && <OpportunityReassignForm id={deal.id!} version={deal.recordVersion} users={assignableUsers}/>}

        <div className="workspace-grid">
          <div className="workspace-main">
            <section>
              <div className="section-title"><span className="mono">00</span><h2>Related contacts</h2></div>
              {deal.stakeholders.length === 0 ? (
                <div className="empty-state"><h2>No linked stakeholders</h2><p>Link an account contact to this opportunity to track its buying group.</p></div>
              ) : (
                <div className="stack">
                  {deal.stakeholders.map((s) => (
                    <Link className="card row-card" href={`/contacts/${s.contactId}`} key={s.contactId}>
                      <div><strong>{s.name}</strong><p>{s.role}</p></div>
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
                </div>
              )}
              {deal.ownerId === actor.id && <OpportunityContactForm opportunityId={deal.id!} contacts={linkableContacts.map((c) => ({ id: c.id, name: c.name }))}/>}
            </section>
            <section>
              <div className="section-title"><span className="mono">01</span><h2>Related meetings</h2></div>
              {deal.meetings.length === 0 ? (
                <div className="empty-state"><h2>No meetings recorded</h2><p>Meetings linked to this opportunity will appear here.</p></div>
              ) : (
                <div className="stack">
                  {deal.meetings.map((meeting) => (
                    <Link className="card row-card" href={`/meetings/${meeting.id}`} key={meeting.id}>
                      <span className="number" />
                      <p>{meeting.title}</p>
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section><div className="section-title"><span className="mono">03</span><h2>Append-only change history</h2></div>{deal.history.length===0?<div className="empty-state"><h2>No lifecycle changes yet</h2><p>Canonical transitions and ownership changes will appear here.</p></div>:<div className="stack">{deal.history.map(item=><article className="card" key={item.id}><strong>{item.changeType.replaceAll("_"," ")}</strong><p className="mono">{new Intl.DateTimeFormat("en-AE",{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.createdAt))}</p><p>{JSON.stringify(item.beforeData)} → {JSON.stringify(item.afterData)}</p></article>)}</div>}</section>
            <section>
              <div className="section-title"><span className="mono">02</span><h2>Related proposals</h2></div>
              {deal.proposals.length === 0 ? (
                <div className="empty-state"><h2>No proposals yet</h2><p>Proposals created against this opportunity will appear here.</p></div>
              ) : (
                <div className="stack">
                  {deal.proposals.map((proposal) => (
                    <Link className="card row-card" href={`/proposals/${proposal.id}`} key={proposal.id}>
                      <span className="number" />
                      <p>{proposal.title} · v{proposal.version} · {proposal.status.replace("_", " ")}</p>
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
