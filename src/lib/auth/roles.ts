export const appRoles = ["seller", "manager", "approver", "admin"] as const;

export type AppRole = (typeof appRoles)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && appRoles.includes(value as AppRole);
}

export function hasAnyRole(role: AppRole, allowed: readonly AppRole[]): boolean {
  return allowed.includes(role);
}

export function canDecideApproval(actorId: string, ownerId: string, approverId: string | null): boolean {
  return Boolean(approverId && actorId === approverId && actorId !== ownerId);
}
