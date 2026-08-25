import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { csvCell } from "@/lib/exports/csv";
import { validateProductionConfiguration } from "@/lib/config/production";

const migration=readFileSync("supabase/migrations/20260822000003_phase1_core_crm.sql","utf8");

describe("Phase 1 migration contract",()=>{
 it("defines canonical stages and optimistic concurrency",()=>{expect(migration).toContain("create table public.opportunity_stages");expect(migration).toContain("record_version");expect(migration).toContain("version_conflict");});
 it("keeps history and audit append-only",()=>{expect(migration).toContain("opportunity_history_immutable");expect(migration).toContain("audit_log_immutable");expect(migration).toContain("redact_audit_json");});
 it("applies explicit grants and RLS to new exposed tables",()=>{expect(migration).toContain("alter table public.opportunity_change_history enable row level security");expect(migration).toContain("grant select on public.opportunity_change_history to authenticated");expect(migration).toContain("revoke insert, update, delete on public.opportunity_change_history");});
});

describe("Phase 1 security helpers",()=>{
 it("neutralizes spreadsheet formulas and quotes CSV",()=>{expect(csvCell("=HYPERLINK(\"bad\")")).toBe("\"'=HYPERLINK(\"\"bad\"\")\"");expect(csvCell("+1")).toBe("\"'+1\"");expect(csvCell("normal")).toBe("\"normal\"");});
 it("rejects unsafe production configuration",()=>{const result=validateProductionConfiguration({NEXT_PUBLIC_USE_MOCK_DATA:"true",CRM_SYNC_ENABLED:"true"});expect(result.valid).toBe(false);expect(result.missing).toContain("NEXT_PUBLIC_SUPABASE_URL");expect(result.unsafe).toContain("NEXT_PUBLIC_USE_MOCK_DATA must be false");});
});
