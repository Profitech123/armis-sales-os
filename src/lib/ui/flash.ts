const errorMessages: Record<string, string> = {
  invalid_account: "Check the account fields and try again.",
  invalid_contact: "Check the contact fields and try again.",
  invalid_opportunity: "Check the opportunity fields and try again.",
  invalid_activity: "Check the activity fields and try again.",
  duplicate_account: "An active account with this name already exists.",
  duplicate_contact: "An active contact with this email already exists.",
  create_failed: "The record could not be saved. Try again or contact an administrator.",
  update_failed: "The change could not be saved. Try again or contact an administrator.",
  forbidden: "You are not authorized to perform that action.",
  invalid_assignment: "Choose a valid assignee before reassigning.",
  assignment_conflict: "This activity changed after you opened it. Refresh and try again.",
  assignment_forbidden: "You are not authorized to reassign that activity.",
};

const successMessages: Record<string, string> = {
  account: "Account created.",
  contact: "Contact created.",
  activity: "Activity created.",
  assignment: "Activity reassigned.",
  opportunity: "Opportunity saved.",
};

export type FlashParams = { error?: string; created?: string; updated?: string; duplicate?: string };

export function resolveFlash(params: FlashParams): { tone: "success" | "error"; message: string } | null {
  if (params.error) {
    const base = errorMessages[params.error] ?? "The action could not be completed.";
    const message = params.duplicate ? `${base} (existing record: ${params.duplicate})` : base;
    return { tone: "error", message };
  }
  if (params.created) return { tone: "success", message: successMessages[params.created] ?? "Created." };
  if (params.updated) return { tone: "success", message: successMessages[params.updated] ?? "Saved." };
  return null;
}
