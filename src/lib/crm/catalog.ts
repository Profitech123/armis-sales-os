export const opportunityStages = [
  { key: "qualification", label: "Qualification", probability: 10, terminal: false },
  { key: "discovery", label: "Discovery", probability: 25, terminal: false },
  { key: "solution_fit", label: "Solution Fit", probability: 45, terminal: false },
  { key: "proposal", label: "Proposal", probability: 65, terminal: false },
  { key: "negotiation", label: "Negotiation", probability: 85, terminal: false },
  { key: "closed_won", label: "Closed Won", probability: 100, terminal: true },
  { key: "closed_lost", label: "Closed Lost", probability: 0, terminal: true },
] as const;

export const opportunityLossReasons = [
  ["budget", "Budget unavailable"],
  ["competition", "Lost to competitor"],
  ["no_decision", "No decision"],
  ["timing", "Timing or priority changed"],
  ["solution_fit", "Solution fit"],
  ["relationship", "Relationship or access"],
] as const;

export const activityKinds = ["task", "follow_up", "call", "email", "note"] as const;
export const activityPriorities = ["low", "normal", "high", "urgent"] as const;
export const activityStatuses = ["open", "in_progress", "completed", "cancelled"] as const;

export function stageLabel(key: string) {
  return opportunityStages.find((stage) => stage.key === key)?.label ?? key.replaceAll("_", " ");
}

