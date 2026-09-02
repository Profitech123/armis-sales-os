import { describe, expect, it } from "vitest";
import { appRoles, canDecideApproval, hasAnyRole, isAppRole } from "@/lib/auth/roles";

describe("authorization roles", () => {
  it("accepts only server-defined application roles", () => {
    for (const role of appRoles) expect(isAppRole(role)).toBe(true);
    expect(isAppRole("owner")).toBe(false);
    expect(isAppRole({ role: "admin" })).toBe(false);
  });

  it("checks explicit allow lists without implicit privilege inheritance", () => {
    expect(hasAnyRole("manager", ["manager", "admin"])).toBe(true);
    expect(hasAnyRole("approver", ["manager", "admin"])).toBe(false);
  });

  it("prevents owners from deciding their own approval", () => {
    expect(canDecideApproval("seller-1", "seller", "seller-1", "seller-1")).toBe(false);
    expect(canDecideApproval("approver-1", "approver", "seller-1", "approver-1")).toBe(true);
    expect(canDecideApproval("admin-1", "admin", "seller-1", null)).toBe(false);
  });

  it("rejects a designated approver whose role has been downgraded", () => {
    expect(canDecideApproval("approver-1", "seller", "seller-1", "approver-1")).toBe(false);
  });
});
