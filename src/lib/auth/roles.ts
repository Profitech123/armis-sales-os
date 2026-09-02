export const appRoles = ["seller", "manager", "approver", "admin"] as const;

export type AppRole = (typeof appRoles)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && appRoles.includes(value as AppRole);
}

export function hasAnyRole(role: AppRole, allowed: readonly AppRole[]): boolean {
  return allowed.includes(role);
}

/**
 * Requires the actor to hold the "approver" role in addition to being the
 * record's designated approver, so a downgraded approver (e.g. demoted to
 * "seller" while still listed as approverId on an in-flight request) can no
 * longer decide it.
 */
export function canDecideApproval(actorId: string, actorRole: AppRole, ownerId: string, approverId: string | null): boolean {
  return Boolean(approverId && actorId === approverId && actorId !== ownerId && actorRole === "approver");
}
