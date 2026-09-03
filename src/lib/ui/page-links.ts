export type AccountsPageParams = {
  error?: string; created?: string; duplicate?: string;
  accountsQ?: string; accountsSort?: string; accountsCursor?: string;
  contactsQ?: string; contactsSort?: string; contactsCursor?: string;
};

/**
 * Builds a link to /accounts carrying forward both lists' filter/sort/cursor
 * state, with the given overrides applied. Passing an empty-string override
 * for a cursor field clears it — this is how "first page" reset links and
 * cross-list cursor preservation are implemented (see AccountsPage).
 */
export function buildAccountsQuery(params: AccountsPageParams, overrides: Partial<AccountsPageParams>): string {
  const merged: AccountsPageParams = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (key === "error" || key === "created" || key === "duplicate") continue;
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `/accounts?${query}` : "/accounts";
}

export type ActivitiesPageParams = { edit?: string; error?: string; created?: string; updated?: string; q?: string; status?: string; priority?: string; sort?: string; cursor?: string };

/** Builds a link to /activities carrying forward filter/sort/cursor state; never carries "edit" or transient flash params. */
export function buildActivitiesQuery(params: ActivitiesPageParams, overrides: Partial<ActivitiesPageParams>): string {
  const merged: ActivitiesPageParams = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (key === "error" || key === "created" || key === "updated" || key === "edit") continue;
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `/activities?${query}` : "/activities";
}

const ACTIVITY_EDIT_LINK_KEYS = ["q", "status", "priority", "sort", "cursor"] as const;

/**
 * Builds the "Edit" link for one activity, preserving the current filter/sort/
 * cursor view so editing doesn't reset the seller's place in the list.
 */
export function buildActivityEditLink(params: ActivitiesPageParams, id: string): string {
  const qs = new URLSearchParams();
  for (const key of ACTIVITY_EDIT_LINK_KEYS) {
    const value = params[key];
    if (value) qs.set(key, value);
  }
  qs.set("edit", id);
  return `/activities?${qs.toString()}#activity-${id}`;
}

export type PipelinePageParams = { error?: string; created?: string; q?: string; stage?: string; sort?: string; cursor?: string };

/** Builds a link to /pipeline carrying forward filter/sort/cursor state; never carries transient flash params. */
export function buildPipelineQuery(params: PipelinePageParams, overrides: Partial<PipelinePageParams>): string {
  const merged: PipelinePageParams = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (key === "error" || key === "created") continue;
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `/pipeline?${query}` : "/pipeline";
}

/** Builds the export link for one entity, carrying forward the current listing filters so an export matches what's on screen. */
export function buildExportHref(entity: string, filters: Record<string, string | undefined> = {}): string {
  const qs = new URLSearchParams({ entity });
  for (const [key, value] of Object.entries(filters)) if (value) qs.set(key, value);
  return `/api/exports/core?${qs.toString()}`;
}
