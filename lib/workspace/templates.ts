// Project templates: ready-made starting points. Picking one creates a project and sends its
// prompt as the first build message, so the app begins taking shape immediately. Each prompt is
// written to produce a solid, complete first version. Pure data; the gallery renders it.

export type TemplateCategory = "Websites" | "Tools" | "Dashboards" | "Fun";

export interface ProjectTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  /** The first build message. Written in full so the result is usable, not a stub. */
  prompt: string;
}

export const TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: "saas-landing",
    name: "SaaS landing page",
    category: "Websites",
    description: "Hero, features, pricing and a call to action.",
    prompt:
      "Build a modern SaaS landing page for a product called Northwind. Include a hero with a headline, subheading and primary button; a row of three feature cards with icons; a short 'how it works' section with three steps; a pricing section with three tiers (Free, Pro, Team); a testimonial; and a footer with links. Use the existing design tokens, make it fully responsive, and add tasteful entrance animations.",
  },
  {
    id: "portfolio",
    name: "Personal portfolio",
    category: "Websites",
    description: "Intro, projects grid and contact.",
    prompt:
      "Build a personal portfolio site. Include a short hero introduction with a name and one-line bio, a grid of six project cards (title, tag, short description), an about section, and a contact section with name, email and message fields. Make it responsive and polished with subtle motion.",
  },
  {
    id: "restaurant",
    name: "Restaurant site",
    category: "Websites",
    description: "Menu, hours and a booking call to action.",
    prompt:
      "Build a one-page site for a restaurant called Olive & Thyme. Include a hero with the name and a 'Book a table' button, an about paragraph, a menu with three sections (Starters, Mains, Desserts) each listing a few dishes with prices, opening hours, and a location/contact section. Make it warm, responsive and tasteful.",
  },
  {
    id: "crud-tasks",
    name: "Task manager",
    category: "Tools",
    description: "Add, complete, filter and delete tasks.",
    prompt:
      "Build a task manager app. Users can add a task with a title and optional due date, mark tasks complete, filter by All / Active / Done, and delete tasks. Keep the tasks in React state (no backend). Show a count of remaining tasks and an empty state. Make it clean and keyboard-friendly.",
  },
  {
    id: "crm",
    name: "Simple CRM",
    category: "Tools",
    description: "Contacts list with a detail panel.",
    prompt:
      "Build a simple CRM. Show a searchable list of contacts (name, company, status) on the left and a detail panel on the right with the selected contact's info and notes. Allow adding a new contact and editing notes. Seed it with a handful of example contacts. Keep everything in React state.",
  },
  {
    id: "invoice",
    name: "Invoice builder",
    category: "Tools",
    description: "Line items with a live total.",
    prompt:
      "Build an invoice builder. Let the user set a client name and date, add and remove line items (description, quantity, unit price), and see a live subtotal, tax and total. Include a clean printable layout. Keep state in React.",
  },
  {
    id: "analytics",
    name: "Analytics dashboard",
    category: "Dashboards",
    description: "KPI cards and charts from sample data.",
    prompt:
      "Build an analytics dashboard with sample data. Include four KPI cards (revenue, users, orders, conversion), a line chart of revenue over twelve months, a bar chart of orders by category, and a table of recent orders. Draw the charts with inline SVG (no chart library). Make it responsive.",
  },
  {
    id: "finance",
    name: "Expense tracker",
    category: "Dashboards",
    description: "Log spend and see it by category.",
    prompt:
      "Build an expense tracker. Let the user add expenses (description, amount, category, date), see a running monthly total, a breakdown by category as a simple bar chart (inline SVG), and a list of recent expenses with delete. Keep everything in React state and seed a few examples.",
  },
  {
    id: "memory-game",
    name: "Memory game",
    category: "Fun",
    description: "Flip-and-match card game.",
    prompt:
      "Build a memory card matching game. Show a grid of face-down cards; flipping two matches them if equal, otherwise they flip back. Track moves and elapsed time, and show a win message with a restart button. Make it responsive with smooth flip animations.",
  },
  {
    id: "quiz",
    name: "Quiz app",
    category: "Fun",
    description: "Multiple-choice quiz with a score.",
    prompt:
      "Build a multiple-choice quiz app with five general-knowledge questions. Show one question at a time with four options, give immediate feedback, track the score, and show a results screen with a restart button. Make it clean with light motion.",
  },
  {
    id: "pomodoro",
    name: "Pomodoro timer",
    category: "Fun",
    description: "Focus and break timer.",
    prompt:
      "Build a Pomodoro timer with 25-minute focus and 5-minute break sessions. Include start, pause and reset, a visible countdown, a session counter, and a gentle visual cue when a session ends. Make it calm and responsive.",
  },
];

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = [
  "Websites",
  "Tools",
  "Dashboards",
  "Fun",
];

export function templatesByCategory(): Array<{
  category: TemplateCategory;
  items: ProjectTemplate[];
}> {
  return TEMPLATE_CATEGORIES.map((category) => ({
    category,
    items: TEMPLATES.filter((template) => template.category === category),
  })).filter((group) => group.items.length > 0);
}

export function templateById(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id);
}
