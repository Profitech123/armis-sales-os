import type { Metadata } from "next";
import Link from "next/link";
import { createAccount, createContact } from "@/app/actions/sales";
import { requirePageActor } from "@/lib/auth/authorization";
import { listAccounts, listAccountsPage, listContactsPage } from "@/lib/data/sales-workflows";
import { FlashBanner } from "@/components/crm-forms";
import { buildAccountsQuery, buildExportHref, type AccountsPageParams } from "@/lib/ui/page-links";

export const metadata: Metadata = { title: "Accounts and contacts", description: "Customer accounts and stakeholder contacts." };

type SearchParams = AccountsPageParams;

export default async function AccountsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requirePageActor();
  const params = await searchParams;
  const accountsSort = params.accountsSort === "updated_desc" ? "updated_desc" : "name_asc";
  const contactsSort = params.contactsSort === "updated_desc" ? "updated_desc" : "name_asc";
  const [accountsPage, contactsPage, dropdownAccounts] = await Promise.all([
    listAccountsPage({ q: params.accountsQ, sort: accountsSort, cursor: params.accountsCursor }),
    listContactsPage({ q: params.contactsQ, sort: contactsSort, cursor: params.contactsCursor }),
    listAccounts(),
  ]);
  return (
    <main className="app-shell"><div className="container">
      <header className="page-header"><div><p className="mono">Customer records · {actor.role}</p><h1 className="page-title">Accounts &amp; <span className="marker">Contacts</span></h1><p className="subtitle">Repository-backed customer organizations and stakeholders. Managers can inspect team records; mutations remain owner-controlled.</p></div><div className="header-actions"><a className="button" href={buildExportHref("accounts", { q: params.accountsQ })}>Export accounts</a><a className="button" href={buildExportHref("contacts", { q: params.contactsQ })}>Export contacts</a><span className="mono field-help">Matches the current search · up to 20,000 rows; larger exports are marked &quot;truncated&quot; in the downloaded filename.</span></div></header>
      <FlashBanner params={params} />
      <section className="workflow-grid">
        <form className="card form-grid" action={createAccount}><h2>Create account</h2><label>Account name<input name="name" required maxLength={200} /></label><label>Industry<input name="industry" maxLength={120} /></label><label>Website<input name="website" type="url" maxLength={500} placeholder="https://" /></label><button className="button dark" type="submit">Create account</button></form>
        <form className="card form-grid" action={createContact}><h2>Create contact</h2><label>Account<select name="accountId" required defaultValue=""><option value="" disabled>Select account</option>{dropdownAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label><label>First name<input name="firstName" required maxLength={100} /></label><label>Last name<input name="lastName" maxLength={100} /></label><label>Email<input name="email" type="email" /></label><label>Phone<input name="phone" maxLength={60} /></label><label>Job title<input name="jobTitle" maxLength={120} /></label><label>Relationship role<input name="relationshipRole" maxLength={120} placeholder="Requires team-defined taxonomy" /></label><button className="button dark" type="submit" disabled={dropdownAccounts.length === 0}>Create contact</button></form>
      </section>
      <section>
        <div className="section-title"><span className="mono">01</span><h2>Accounts</h2></div>
        <form className="card filter-bar" action="/accounts">
          <input type="hidden" name="contactsQ" value={params.contactsQ ?? ""} /><input type="hidden" name="contactsSort" value={contactsSort} /><input type="hidden" name="contactsCursor" value={params.contactsCursor ?? ""} />
          <label className="sr-only" htmlFor="accountsQ">Search accounts</label>
          <input id="accountsQ" name="accountsQ" defaultValue={params.accountsQ ?? ""} placeholder="Search account name" maxLength={80} />
          <label className="sr-only" htmlFor="accountsSort">Sort accounts</label>
          <select id="accountsSort" name="accountsSort" defaultValue={accountsSort}><option value="name_asc">Name A–Z</option><option value="updated_desc">Recently updated</option></select>
          <button className="button" type="submit" aria-label="Filter accounts">Filter</button>
        </form>
        {accountsPage.data.length === 0 ? <div className="empty-state"><h2>No accounts found</h2><p>Adjust the filter or create the first repository-backed customer account.</p></div> : <div className="table-wrap"><table><caption className="sr-only">Customer accounts</caption><thead><tr><th>Account</th><th>Industry</th><th>Contacts</th><th>Opportunities</th><th>Website</th></tr></thead><tbody>{accountsPage.data.map((account) => <tr id={`account-${account.id}`} key={account.id}><td><Link href={`/accounts/${account.id}`}><strong>{account.name}</strong></Link></td><td>{account.industry ?? "—"}</td><td>{account.contactCount}</td><td>{account.opportunityCount}</td><td>{account.website ? <a className="text-link" href={account.website} target="_blank" rel="noreferrer">Open website</a> : "—"}</td></tr>)}</tbody></table></div>}
        <div className="card-actions">{params.accountsCursor && <Link className="button" href={buildAccountsQuery(params,{ accountsCursor: "" })}>⇤ First page</Link>}{accountsPage.nextCursor && <Link className="button" href={buildAccountsQuery(params,{ accountsCursor: accountsPage.nextCursor })}>Next accounts →</Link>}</div>
      </section>
      <section>
        <div className="section-title"><span className="mono">02</span><h2>Contacts</h2></div>
        <form className="card filter-bar" action="/accounts">
          <input type="hidden" name="accountsQ" value={params.accountsQ ?? ""} /><input type="hidden" name="accountsSort" value={accountsSort} /><input type="hidden" name="accountsCursor" value={params.accountsCursor ?? ""} />
          <label className="sr-only" htmlFor="contactsQ">Search contacts</label>
          <input id="contactsQ" name="contactsQ" defaultValue={params.contactsQ ?? ""} placeholder="Search name or email" maxLength={80} />
          <label className="sr-only" htmlFor="contactsSort">Sort contacts</label>
          <select id="contactsSort" name="contactsSort" defaultValue={contactsSort}><option value="name_asc">Last name A–Z</option><option value="updated_desc">Recently updated</option></select>
          <button className="button" type="submit" aria-label="Filter contacts">Filter</button>
        </form>
        {contactsPage.data.length === 0 ? <div className="empty-state"><h2>No contacts found</h2><p>Adjust the filter or add stakeholders after creating an account.</p></div> : <div className="table-wrap"><table><caption className="sr-only">Customer contacts</caption><thead><tr><th>Name</th><th>Account</th><th>Title</th><th>Relationship</th><th>Email</th><th>Phone</th></tr></thead><tbody>{contactsPage.data.map((contact) => <tr id={`contact-${contact.id}`} key={contact.id}><td><Link href={`/contacts/${contact.id}`}><strong>{contact.name}</strong></Link></td><td>{contact.accountName}</td><td>{contact.jobTitle ?? "—"}</td><td>{contact.relationshipRole ?? "—"}</td><td>{contact.email ?? "—"}</td><td>{contact.phone ?? "—"}</td></tr>)}</tbody></table></div>}
        <div className="card-actions">{params.contactsCursor && <Link className="button" href={buildAccountsQuery(params,{ contactsCursor: "" })}>⇤ First page</Link>}{contactsPage.nextCursor && <Link className="button" href={buildAccountsQuery(params,{ contactsCursor: contactsPage.nextCursor })}>Next contacts →</Link>}</div>
      </section>
    </div></main>
  );
}
