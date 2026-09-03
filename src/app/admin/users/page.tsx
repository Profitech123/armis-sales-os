import type { Metadata } from "next";
import { updateUserRole } from "@/app/actions/admin";
import { requirePageActor } from "@/lib/auth/authorization";
import { appRoles } from "@/lib/auth/roles";
import { listUsersForAdmin } from "@/lib/data/admin";

export const metadata: Metadata = { title: "User administration", description: "Server-controlled Sales OS roles and permissions." };

export default async function AdminUsersPage() {
  const actor = await requirePageActor(["admin"]);
  const users = await listUsersForAdmin();
  return <main className="app-shell"><div className="container"><header className="page-header"><div><p className="mono">Restricted administration</p><h1 className="page-title">Users &amp; <span className="marker">Permissions</span></h1><p className="subtitle">Role changes are server-controlled and audited. Self-role changes are blocked.</p></div></header><div className="card"><p><strong>Team membership configuration is disabled.</strong> Reporting lines and delegated manager permissions require sales-team approval before activation.</p></div><div className="table-wrap"><table><caption className="sr-only">Application users and roles</caption><thead><tr><th>User</th><th>Role</th><th>Change role</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.displayName ?? user.email}</strong><div>{user.email}</div></td><td><span className="chip">{user.role}</span></td><td>{user.id === actor.id ? <span className="mono">Current administrator</span> : <form className="inline-form" action={updateUserRole}><input type="hidden" name="userId" value={user.id} /><select name="role" defaultValue={user.role}>{appRoles.map((role) => <option value={role} key={role}>{role}</option>)}</select><button className="button" type="submit">Update</button></form>}</td></tr>)}</tbody></table></div></div></main>;
}
