// The integrations Buildr plans to offer. None is connected yet: each entry is a place to record
// interest, in the order people most often ask for them. When one ships, set its status to
// "available" and add the connect flow next to it. Pure data; tested directly.

export type IntegrationCategory = "Code and deploy" | "Data and payments" | "Work apps";

export interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  /** One plain sentence on what connecting it would do. */
  blurb: string;
  status: "planned" | "available";
}

export const INTEGRATIONS: readonly Integration[] = [
  {
    id: "github",
    name: "GitHub",
    category: "Code and deploy",
    blurb: "Push a project to a repository and keep it in sync as you build.",
    status: "planned",
  },
  {
    id: "vercel",
    name: "Vercel",
    category: "Code and deploy",
    blurb: "Publish a project to a live address in one step.",
    status: "planned",
  },
  {
    id: "netlify",
    name: "Netlify",
    category: "Code and deploy",
    blurb: "Deploy a project as a static site with a custom domain.",
    status: "planned",
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "Data and payments",
    blurb: "Give a generated app a database and sign-in of its own.",
    status: "planned",
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Data and payments",
    blurb: "Add payments and checkout to an app you build.",
    status: "planned",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    category: "Data and payments",
    blurb: "Read and write spreadsheet rows from a generated app.",
    status: "planned",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    category: "Work apps",
    blurb: "Save chat documents to Drive and attach files from it.",
    status: "planned",
  },
  {
    id: "notion",
    name: "Notion",
    category: "Work apps",
    blurb: "Send chat documents to a Notion page.",
    status: "planned",
  },
  {
    id: "slack",
    name: "Slack",
    category: "Work apps",
    blurb: "Share a project preview link to a channel.",
    status: "planned",
  },
  {
    id: "figma",
    name: "Figma",
    category: "Work apps",
    blurb: "Start a project from a Figma design.",
    status: "planned",
  },
];

export const INTEGRATION_IDS = INTEGRATIONS.map((integration) => integration.id);
export const INTEGRATION_CATEGORIES: readonly IntegrationCategory[] = [
  "Code and deploy",
  "Data and payments",
  "Work apps",
];
