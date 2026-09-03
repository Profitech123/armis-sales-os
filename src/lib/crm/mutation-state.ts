export type MutationState = { ok: boolean; message: string; fieldErrors?: Record<string, string[]>; conflict?: boolean };
export const initialMutationState: MutationState = { ok: false, message: "" };
