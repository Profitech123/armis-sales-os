export type Deal = {
  id?: string;
  ownerId?: string;
  accountId?: string;
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
  { label: "Active pipeline", value: "AED 3.49M", note: "20 open opportunities" },
  { label: "Weighted pipeline", value: "AED 1.43M", note: "41% effective probability" },
  { label: "At risk", value: "AED 3.34M", note: "18 opportunities past target close date" },
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
  { account: "Solution Plus", opportunity: "Adoption program- Copilot for Microsoft 365", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 13K", valueAmount: 13176.67, probability: 50, closeDate: "31 Jul", nextStep: "Finalize adoption program rollout plan", health: 50, attention: "Overdue" },
  { account: "Microsoft Dubai", opportunity: "Adoption program- Copilot for Microsoft 365", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 34K", valueAmount: 33753.33, probability: 75, closeDate: "31 Jul", nextStep: "Confirm rollout timeline with stakeholders", health: 75, attention: "Overdue" },
  { account: "Emirates Investment Authority", opportunity: "DLP Consultation and Implementation", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 143K", valueAmount: 143196.43, probability: 25, closeDate: "30 Sep", nextStep: "Complete DLP consultation scope", health: 40 },
  { account: "Dubai Electricity & Water Authority", opportunity: "Ricardo AI 2026-2027", owner: "Elio Berberi", stage: "Solutioning", value: "AED 140K", valueAmount: 140000, probability: 100, closeDate: "31 Aug", nextStep: "Confirm resource allocation and contract terms", health: 85, attention: "Overdue" },
  { account: "Dubai Electricity & Water Authority", opportunity: "Alexandre 2026 S2 and 2027 S1", owner: "Elio Berberi", stage: "Solutioning", value: "AED 140K", valueAmount: 140000, probability: 100, closeDate: "31 Aug", nextStep: "Confirm resource allocation and contract terms", health: 85, attention: "Overdue" },
  { account: "Dubai Electricity & Water Authority", opportunity: "Jose - Data Resource", owner: "Elio Berberi", stage: "Solutioning", value: "AED 140K", valueAmount: 140000, probability: 100, closeDate: "31 Jul", nextStep: "Confirm resource allocation and contract terms", health: 85, attention: "Overdue" },
  { account: "Dubai Electricity & Water Authority", opportunity: "Vitor - Security Resource", owner: "Elio Berberi", stage: "Solutioning", value: "AED 228K", valueAmount: 228000, probability: 100, closeDate: "31 Aug", nextStep: "Confirm resource allocation and contract terms", health: 85, attention: "Overdue" },
  { account: "Dubai Electricity & Water Authority", opportunity: "AI Resource - Sophia", owner: "Elio Berberi", stage: "Solutioning", value: "TBC", valueAmount: 0, probability: 20, closeDate: "TBC", nextStep: "Confirm resourcing scope and close date", health: 45, attention: "Stale" },
  { account: "Sharjah Airport", opportunity: "(OPTIONAL - SUPPORT YEAR 2) IGA Implementation Microsoft ENTRA", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 80K", valueAmount: 79714.29, probability: 25, closeDate: "10 Jul", nextStep: "Confirm optional support year 2 renewal", health: 40, attention: "Overdue" },
  { account: "Federal Authority for Government Human Resources", opportunity: "Data - Empowered Idea Management System's", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 19K", valueAmount: 18953.33, probability: 25, closeDate: "30 Jun", nextStep: "Finalize data workstream scope", health: 40, attention: "Overdue" },
  { account: "Federal Authority for Government Human Resources", opportunity: "CorpApps - Empowered Idea Management System's", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 304K", valueAmount: 304131.67, probability: 25, closeDate: "30 Jun", nextStep: "Finalize corporate apps workstream scope", health: 40, attention: "Overdue" },
  { account: "UAE - Ministry of Finance", opportunity: "IGA Implementation Microsoft ENTRA", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 429K", valueAmount: 429188.97, probability: 25, closeDate: "31 Jul", nextStep: "Progress Entra IGA implementation plan", health: 40, attention: "Overdue" },
  { account: "Sharjah Airport", opportunity: "IGA Implementation Microsoft ENTRA", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 243K", valueAmount: 243395.71, probability: 25, closeDate: "30 Jun", nextStep: "Progress Entra IGA implementation plan", health: 40, attention: "Overdue" },
  { account: "Dubai Electricity & Water Authority", opportunity: "Data Team - Data Governance & AI-Readiness Initiative", owner: "Elio Berberi", stage: "Solutioning", value: "AED 1.33M", valueAmount: 1333584, probability: 25, closeDate: "31 Jul", nextStep: "Advance data governance readiness assessment", health: 40, attention: "Overdue" },
  { account: "Federal Authority for Government Human Resources", opportunity: "AI - Empowered Idea Management System's", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 35K", valueAmount: 34781.67, probability: 25, closeDate: "30 Jun", nextStep: "Finalize AI workstream scope", health: 40, attention: "Overdue" },
  { account: "Armis MEA", opportunity: "Internal - Purview Implementation Services", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 18K", valueAmount: 17910, probability: 50, closeDate: "30 Jun", nextStep: "Complete internal Purview rollout", health: 50, attention: "Overdue" },
  { account: "Strata Manufacturing PJSC", opportunity: "Purview Implementation Services", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 40K", valueAmount: 40260, probability: 50, closeDate: "9 Jul", nextStep: "Complete Purview implementation plan", health: 50, attention: "Overdue" },
  { account: "Strata Manufacturing PJSC", opportunity: "Contract Approval Migration", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 39K", valueAmount: 38610.67, probability: 75, closeDate: "10 Jul", nextStep: "Finalize contract approval migration plan", health: 75, attention: "Overdue" },
  { account: "Armis MEA", opportunity: "Entra ID Integration and MFA", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 67K", valueAmount: 67320, probability: 50, closeDate: "30 Jun", nextStep: "Complete Entra ID and MFA integration", health: 50, attention: "Overdue" },
  { account: "Sharjah Airport", opportunity: "Intranet", owner: "Elio Berberi", stage: "Proposal preparation", value: "AED 40K", valueAmount: 40310, probability: 25, closeDate: "22 Jul", nextStep: "Finalize intranet delivery plan", health: 40, attention: "Overdue" },
];
