export type Deal = {
  id?: string;
  ownerId?: string;
  account: string;
  opportunity: string;
  owner: string;
  stage: string;
  value: string;
  valueAmount?: number;
  probability: number;
  closeDate: string;
  nextStep: string;
  health: number;
  attention?: string;
};

export const metrics = [
  { label: "Active pipeline", value: "AED 18.4M", note: "+12% since last month" },
  { label: "Weighted pipeline", value: "AED 8.9M", note: "48% effective probability" },
  { label: "At risk", value: "AED 4.1M", note: "6 opportunities require action" },
];

export const priorities = [
  {
    tone: "red",
    labels: ["Urgent", "Needs reply"],
    title: "DEWA — Smart Library Proposal",
    body: "The revised software and robotics concept was due two days ago. Microsoft architecture input and partner ownership remain outstanding.",
    action: "Approve the scope and send the revised proposal today.",
  },
  {
    tone: "orange",
    labels: ["Stale", "Strategic"],
    title: "Emirates Group — Entra ID Modernization",
    body: "No next meeting is confirmed for the 120,000-identity modernization opportunity. The deal has remained in solutioning for 18 days.",
    action: "Secure the technical workshop date and refresh the close plan.",
  },
  {
    tone: "blue",
    labels: ["Tender", "7 days"],
    title: "ENEC — AI Governance and Security",
    body: "Six mandatory tender requirements remain incomplete and two require partner evidence.",
    action: "Assign owners and initiate commercial review before tomorrow.",
  },
];

export type CommunicationItem = {
  account: string;
  subject: string;
  body: string;
  action: string;
  tone: "red" | "orange" | "blue" | "green";
  age: string;
};

export type CommunicationsQueue = {
  needsReply: CommunicationItem[];
  urgent: CommunicationItem[];
  waiting: CommunicationItem[];
};

export const communicationsQueue: CommunicationsQueue = {
  needsReply: [
    {
      account: "Microsoft / DEWA",
      subject: "Architecture input required for proposal",
      age: "2 days old",
      body: "Microsoft has not yet confirmed the Copilot and SharePoint reference architecture. The revised customer proposal cannot be finalized without it.",
      action: "Escalate internally and request confirmation by 14:00 today.",
      tone: "red",
    },
    {
      account: "Emirates Group",
      subject: "Entra modernization workshop dates",
      age: "6 hours old",
      body: "The identity team requested two options for the technical workshop and a concise list of pre-read items.",
      action: "Send two workshop options and the pre-read checklist.",
      tone: "orange",
    },
  ],
  urgent: [
    {
      account: "DEWA",
      subject: "Smart Library proposal milestone overdue",
      age: "2 days overdue",
      body: "The concept proposal remains in internal review while the customer is expecting consolidated software and robotics scope.",
      action: "Resolve scope ownership and submit the revised version today.",
      tone: "red",
    },
    {
      account: "ENEC",
      subject: "Tender clarification deadline approaching",
      age: "48 hours remaining",
      body: "Two clarification questions remain open around certification evidence and delivery responsibility.",
      action: "Confirm partner evidence and submit clarification questions.",
      tone: "orange",
    },
  ],
  waiting: [
    {
      account: "Aldar",
      subject: "Business case feedback",
      age: "Waiting 5 days",
      body: "The client is reviewing the AI adoption and identity governance business case. No response has been recorded since submission.",
      action: "Follow up with the sponsor and confirm next review meeting.",
      tone: "blue",
    },
    {
      account: "AD Ports",
      subject: "Copilot Studio stakeholder list",
      age: "Waiting 3 days",
      body: "The account team is waiting for the confirmed business stakeholders before preparing the discovery brief.",
      action: "Request the stakeholder list and proposed meeting window.",
      tone: "green",
    },
  ],
};

export const deals: Deal[] = [
  { account: "DEWA", opportunity: "AI Smart Library", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 2.50M", probability: 50, closeDate: "30 Nov", nextStep: "Submit revised concept", health: 64, attention: "Overdue" },
  { account: "Emirates Group", opportunity: "Entra ID Modernization", owner: "Elio Berberi", stage: "Solutioning", value: "AED 4.80M", probability: 45, closeDate: "15 Dec", nextStep: "Confirm technical workshop", health: 57, attention: "Stale" },
  { account: "Aldar", opportunity: "AI Security & Governance", owner: "Elio Berberi", stage: "Qualified", value: "AED 3.20M", probability: 40, closeDate: "20 Dec", nextStep: "Business case review", health: 71 },
  { account: "e&", opportunity: "Copilot Security & Governance", owner: "Sales Team", stage: "Negotiation", value: "AED 2.10M", probability: 70, closeDate: "30 Sep", nextStep: "Commercial clarification", health: 82 },
  { account: "AD Ports", opportunity: "Agentic AI Platform", owner: "Elio Berberi", stage: "Discovery", value: "AED 1.40M", probability: 30, closeDate: "31 Jan", nextStep: "Stakeholder mapping", health: 69 },
];
