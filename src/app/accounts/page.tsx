import type { Metadata } from "next";
import { createAccount, createContact } from "@/app/actions/sales";
import { requirePageActor } from "@/lib/auth/authorization";
import { listAccounts, listContacts } from "@/lib/data/sales-workflows";

export const metadata: Metadata = { title: "Accounts and contacts", description: "Customer accounts and stakeholder contacts." };

export default async function AccountsPage() {
  await requirePageActor();
  const [accounts, contacts] = await Promise.all([listAccounts(), listContacts()]);
  return (
    <main className="app-shell"><div className="container">
      <header className="page-header"><div><p className="mono">Customer records</p><h1 className="page-title">Accounts &amp; <span className="marker">Contacts</span></h1><p className="subtitle">Repository-backed customer organizations and stakeholders. CRM synchronization remains disabled until field ownership is approved.</p></div></header>
      <section className="workflow-grid">
        <form className="card form-grid" action={createAccount}><h2>Create account</h2><label>Account name<input name="name" required maxLength={200} /></label><label>Industry<input name="industry" maxLength={120} /></label><label>Website<input name="website" type="url" maxLength={500} placeholder="https://" /></label><button className="button dark" type="submit">Create account</button></form>
        <form className="card form-grid" action={createContact}><h2>Create contact</h2><label>Account<select name="accountId" required defaultValue=""><option value="" disabled>Select account</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label><label>First name<input name="firstName" required maxLength={100} /></label><label>Last name<input name="lastName" maxLength={100} /></label><label>Email<input name="email" type="email" /></label><label>Phone<input name="phone" maxLength={60} /></label><label>Job title<input name="jobTitle" maxLength={120} /></label><label>Relationship role<input name="relationshipRole" maxLength={120} placeholder="Requires team-defined taxonomy" /></label><button className="button dark" type="submit" disabled={accounts.length === 0}>Create contact</button></form>
      </section>
      <section><div className="section-title"><span className="mono">01</span><h2>Accounts</h2></div>{accounts.length === 0 ? <div className="empty-state"><h2>No accounts yet</h2><p>Create the first repository-backed customer account.</p></div> : <div className="table-wrap"><table><caption className="sr-only">Customer accounts</caption><thead><tr><th>Account</th><th>Industry</th><th>Contacts</th><th>Opportunities</th><th>Website</th></tr></thead><tbody>{accounts.map((account) => <tr id={`account-${account.id}`} key={account.id}><td><strong>{account.name}</strong></td><td>{account.industry ?? "—"}</td><td>{account.contactCount}</td><td>{account.opportunityCount}</td><td>{account.website ? <a className="text-link" href={account.website} target="_blank" rel="noreferrer">Open website</a> : "—"}</td></tr>)}</tbody></table></div>}</section>
      <section><div className="section-title"><span className="mono">02</span><h2>Contacts</h2></div>{contacts.length === 0 ? <div className="empty-state"><h2>No contacts yet</h2><p>Add stakeholders after creating an account.</p></div> : <div className="table-wrap"><table><caption className="sr-only">Customer contacts</caption><thead><tr><th>Name</th><th>Account</th><th>Title</th><th>Relationship</th><th>Email</th><th>Phone</th></tr></thead><tbody>{contacts.map((contact) => <tr id={`contact-${contact.id}`} key={contact.id}><td><strong>{contact.name}</strong></td><td>{contact.accountName}</td><td>{contact.jobTitle ?? "—"}</td><td>{contact.relationshipRole ?? "—"}</td><td>{contact.email ?? "—"}</td><td>{contact.phone ?? "—"}</td></tr>)}</tbody></table></div>}</section>
    </div></main>
  );
}
