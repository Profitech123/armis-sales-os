import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiActor = vi.fn();
vi.mock("@/lib/auth/authorization", () => ({ requireApiActor }));
vi.mock("@/lib/data/connectors", () => ({ listConnectorStatuses: vi.fn() }));

describe("business API authorization", () => {
  beforeEach(() => requireApiActor.mockReset());

  it("returns 401 for an unauthenticated communications request", async () => {
    requireApiActor.mockResolvedValue({ error: "Unauthorized", status: 401 });
    const { GET } = await import("@/app/api/communications/route");
    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("returns 403 when a non-admin requests connector administration", async () => {
    requireApiActor.mockResolvedValue({ error: "Forbidden", status: 403 });
    const { GET } = await import("@/app/api/connectors/route");
    const response = await GET();
    expect(response.status).toBe(403);
    expect(requireApiActor).toHaveBeenCalledWith(["admin"]);
  });

  it("server-controls opportunity ownership for an authenticated seller", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "22222222-2222-4222-8222-222222222222" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    requireApiActor.mockResolvedValue({
      user: { id: "11111111-1111-4111-8111-111111111111" },
      actor: { role: "seller" },
      supabase: { from: vi.fn(() => ({ insert })) },
    });
    const { POST } = await import("@/app/api/opportunities/route");
    const response = await POST(new Request("http://localhost/api/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: "33333333-3333-4333-8333-333333333333",
        name: "Staging opportunity",
        ownerName: "Attempted client owner",
        stage: "Discovery",
        valueAmount: 1000,
        probability: 20,
      }),
    }));
    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      owner_user_id: "11111111-1111-4111-8111-111111111111",
    }));
  });

  it("does not expose database error messages", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "23503", message: "secret constraint details" } });
    requireApiActor.mockResolvedValue({
      user: { id: "11111111-1111-4111-8111-111111111111" },
      actor: { role: "seller" },
      supabase: { from: vi.fn(() => ({ insert: () => ({ select: () => ({ single }) }) })) },
    });
    const { POST } = await import("@/app/api/opportunities/route");
    const response = await POST(new Request("http://localhost/api/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: "33333333-3333-4333-8333-333333333333",
        name: "Staging opportunity",
        ownerName: "Seller",
        stage: "Discovery",
        valueAmount: 1000,
        probability: 20,
      }),
    }));
    expect(response.status).toBe(500);
    const body = JSON.stringify(await response.json());
    expect(body).toContain("DATA_ACCESS_FAILED");
    expect(body).not.toContain("secret constraint details");
  });
});
