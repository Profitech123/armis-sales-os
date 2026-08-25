import { describe, expect, it } from "vitest";
import { buildAccountsQuery, buildActivitiesQuery, buildActivityEditLink, buildExportHref, buildPipelineQuery } from "@/lib/ui/page-links";

describe("buildAccountsQuery", () => {
  it("preserves the other list's filter/sort/cursor state while applying an override", () => {
    const params = { accountsQ: "Acme", accountsSort: "name_asc", accountsCursor: "cursor-a", contactsQ: "Jane", contactsSort: "updated_desc", contactsCursor: "cursor-b" };
    const href = buildAccountsQuery(params, { accountsCursor: "cursor-a-next" });
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/accounts");
    expect(url.searchParams.get("accountsQ")).toBe("Acme");
    expect(url.searchParams.get("accountsCursor")).toBe("cursor-a-next");
    expect(url.searchParams.get("contactsQ")).toBe("Jane");
    expect(url.searchParams.get("contactsCursor")).toBe("cursor-b");
  });

  it("clears a cursor when overridden with an empty string, producing a first-page link", () => {
    const params = { accountsCursor: "cursor-a" };
    const href = buildAccountsQuery(params, { accountsCursor: "" });
    expect(new URL(href, "http://localhost").searchParams.has("accountsCursor")).toBe(false);
  });

  it("never carries forward transient flash params", () => {
    const params = { error: "duplicate_account", created: "account", duplicate: "some-id", accountsQ: "Acme" };
    const href = buildAccountsQuery(params, {});
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.has("error")).toBe(false);
    expect(url.searchParams.has("created")).toBe(false);
    expect(url.searchParams.has("duplicate")).toBe(false);
    expect(url.searchParams.get("accountsQ")).toBe("Acme");
  });

  it("returns the bare path when there is no state to carry", () => {
    expect(buildAccountsQuery({}, {})).toBe("/accounts");
  });
});

describe("buildActivitiesQuery", () => {
  it("drops the cursor when filters change (no cursor override supplied)", () => {
    const params = { q: "old search", cursor: "cursor-a" };
    const href = buildActivitiesQuery({ q: "new search" }, {});
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.get("q")).toBe("new search");
    expect(url.searchParams.has("cursor")).toBe(false);
    void params;
  });

  it("never carries forward edit or transient flash params onto a pagination link", () => {
    const params = { edit: "activity-1", error: "invalid_assignment", created: "activity", updated: "assignment", q: "task", status: "open" };
    const href = buildActivitiesQuery(params, { cursor: "next-cursor" });
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.has("edit")).toBe(false);
    expect(url.searchParams.has("error")).toBe(false);
    expect(url.searchParams.has("created")).toBe(false);
    expect(url.searchParams.has("updated")).toBe(false);
    expect(url.searchParams.get("q")).toBe("task");
    expect(url.searchParams.get("status")).toBe("open");
    expect(url.searchParams.get("cursor")).toBe("next-cursor");
  });

  it("clears the cursor for a first-page reset link", () => {
    const href = buildActivitiesQuery({ cursor: "cursor-a", status: "open" }, { cursor: "" });
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.has("cursor")).toBe(false);
    expect(url.searchParams.get("status")).toBe("open");
  });
});

describe("buildActivityEditLink", () => {
  it("preserves the current filter/sort/cursor view and appends the row anchor", () => {
    const params = { q: "urgent", status: "open", priority: "urgent", sort: "updated_desc", cursor: "cursor-a" };
    const href = buildActivityEditLink(params, "activity-42");
    const [path, hash] = href.split("#");
    const url = new URL(path, "http://localhost");
    expect(url.searchParams.get("q")).toBe("urgent");
    expect(url.searchParams.get("status")).toBe("open");
    expect(url.searchParams.get("priority")).toBe("urgent");
    expect(url.searchParams.get("sort")).toBe("updated_desc");
    expect(url.searchParams.get("cursor")).toBe("cursor-a");
    expect(url.searchParams.get("edit")).toBe("activity-42");
    expect(hash).toBe("activity-activity-42");
  });

  it("excludes stale edit/error/created/updated params even if present on the current params object", () => {
    const params = { edit: "old-activity", error: "invalid_assignment", created: "activity", updated: "assignment" };
    const href = buildActivityEditLink(params, "activity-42");
    const url = new URL(href.split("#")[0], "http://localhost");
    expect(url.searchParams.get("edit")).toBe("activity-42");
    expect(url.searchParams.has("error")).toBe(false);
    expect(url.searchParams.has("created")).toBe(false);
    expect(url.searchParams.has("updated")).toBe(false);
  });
});

describe("buildPipelineQuery", () => {
  it("drops the cursor when filters change (submitting the filter form navigates without a cursor param)", () => {
    const href = buildPipelineQuery({ q: "new search" }, {});
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/pipeline");
    expect(url.searchParams.get("q")).toBe("new search");
    expect(url.searchParams.has("cursor")).toBe(false);
  });

  it("never carries forward transient flash params onto a pagination link", () => {
    const params = { error: "invalid_opportunity", created: "opportunity", stage: "negotiation" };
    const href = buildPipelineQuery(params, { cursor: "next-cursor" });
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.has("error")).toBe(false);
    expect(url.searchParams.has("created")).toBe(false);
    expect(url.searchParams.get("stage")).toBe("negotiation");
    expect(url.searchParams.get("cursor")).toBe("next-cursor");
  });

  it("clears the cursor for a first-page reset link while preserving other filters", () => {
    const href = buildPipelineQuery({ cursor: "cursor-a", stage: "negotiation", sort: "name_asc" }, { cursor: "" });
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.has("cursor")).toBe(false);
    expect(url.searchParams.get("stage")).toBe("negotiation");
    expect(url.searchParams.get("sort")).toBe("name_asc");
  });

  it("returns the bare path when there is no state to carry", () => {
    expect(buildPipelineQuery({}, {})).toBe("/pipeline");
  });
});

describe("buildExportHref", () => {
  it("builds a bare export link when there are no filters", () => {
    expect(buildExportHref("opportunities")).toBe("/api/exports/core?entity=opportunities");
  });

  it("carries the current search term so the export matches what's on screen", () => {
    expect(buildExportHref("accounts", { q: "Acme" })).toBe("/api/exports/core?entity=accounts&q=Acme");
  });

  it("URL-encodes a search term containing reserved characters", () => {
    const href = buildExportHref("contacts", { q: "Smith, Jane (VP)" });
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.get("q")).toBe("Smith, Jane (VP)");
  });

  it("carries the current stage filter for an opportunities export", () => {
    const href = buildExportHref("opportunities", { q: "Acme", stage: "negotiation" });
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.get("entity")).toBe("opportunities");
    expect(url.searchParams.get("q")).toBe("Acme");
    expect(url.searchParams.get("stage")).toBe("negotiation");
  });

  it("omits an unset filter rather than sending an empty param", () => {
    const href = buildExportHref("opportunities", { q: undefined, stage: "negotiation" });
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.has("q")).toBe(false);
    expect(url.searchParams.get("stage")).toBe("negotiation");
  });
});
