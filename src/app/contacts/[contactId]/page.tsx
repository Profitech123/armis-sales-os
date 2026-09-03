import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/lib/auth/authorization";
import { getContactDetail } from "@/lib/data/crm-details";
import { listAccounts } from "@/lib/data/sales-workflows";
import { ContactEditForm } from "@/components/crm-forms";
import { stageLabel } from "@/lib/crm/catalog";

export default async function ContactDetailPage({params}:{params:Promise<{contactId:string}>}) {
 const actor=await requirePageActor(); const {contactId}=await params; const [contact,accounts]=await Promise.all([getContactDetail(contactId),listAccounts()]); if(!contact)notFound();
 return <main className="app-shell"><div className="container"><Link className="back-link mono" href="/accounts">← Accounts & contacts</Link><header className="page-header"><div><p className="mono">Contact · {contact.archived_at?"Archived":"Active"}</p><h1 className="page-title">{contact.first_name} <span className="marker">{contact.last_name}</span></h1><p className="subtitle">{contact.job_title??"Stakeholder"} · {contact.accounts?.name??"Unlinked account"}</p></div></header><ContactEditForm contact={contact} accounts={accounts} editable={contact.owner_user_id===actor.id}/><div className="workflow-grid"><section><div className="section-title"><span className="mono">01</span><h2>Opportunities</h2></div>{contact.opportunity_contacts.length?<div className="stack">{contact.opportunity_contacts.map(link=><Link className="card row-card" href={`/deals/${link.opportunity_id}`} key={link.opportunity_id}><div><strong>{link.opportunities?.name}</strong><p>{link.role} · {stageLabel(link.opportunities?.stage??"")}</p></div><span>→</span></Link>)}</div>:<div className="empty-state"><h2>No opportunity roles</h2><p>Link this contact as a stakeholder when qualifying a deal.</p></div>}</section><section><div className="section-title"><span className="mono">02</span><h2>Activity timeline</h2></div>{contact.activities.length?<div className="stack">{contact.activities.map(a=><article className="card" key={a.id}><strong>{a.subject}</strong><p>{a.kind.replace("_"," ")} · {a.status} · {a.priority}</p></article>)}</div>:<div className="empty-state"><h2>No activity yet</h2><p>Contact-linked work will appear here.</p></div>}</section></div></div></main>;
}

