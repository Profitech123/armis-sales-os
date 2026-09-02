/**
 * A <select>'s defaultValue that doesn't match any rendered <option> (e.g.
 * the record's linked account/contact was archived after the options list
 * was fetched, so it's missing from an active-only list) makes the browser
 * silently fall back to selecting the first option instead. Callers should
 * render an extra option for the current value whenever this returns true,
 * so an unmodified selection keeps saving the record's actual current link
 * instead of silently reassigning it.
 */
export function needsCurrentValueOption(id: string | null | undefined, list: { id: string }[]): boolean {
  return Boolean(id) && !list.some((item) => item.id === id);
}
