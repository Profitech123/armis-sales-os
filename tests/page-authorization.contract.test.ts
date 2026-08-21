import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const protectedPages = [
  "src/app/page.tsx",
  "src/app/accounts/page.tsx",
  "src/app/activities/page.tsx",
  "src/app/admin/users/page.tsx",
  "src/app/communications/page.tsx",
  "src/app/connectors/page.tsx",
  "src/app/deals/[opportunityId]/page.tsx",
  "src/app/meetings/page.tsx",
  "src/app/meetings/[meetingId]/page.tsx",
  "src/app/pipeline/page.tsx",
  "src/app/proposals/page.tsx",
  "src/app/proposals/[proposalId]/page.tsx",
  "src/app/search/page.tsx",
  "src/app/tenders/page.tsx",
  "src/app/tenders/[tenderId]/page.tsx",
];

describe("protected page authorization contract", () => {
  it.each(protectedPages)("requires a server-side actor in %s", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).toContain("requirePageActor");
    expect(source).toMatch(/await requirePageActor\(/);
  });
});
