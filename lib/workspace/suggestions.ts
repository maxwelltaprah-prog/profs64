// Follow-up ideas shown under the composer after a reply. Deterministic and local: they look at
// what the project already has and offer the next obvious step, so they cost no credits and never
// send anything to a model. Each idea is skipped when the project already seems to cover it.

export interface SuggestionFile {
  path: string;
  content: string;
}

interface Idea {
  text: string;
  /** True when the project does not yet cover the idea. */
  applies: (files: readonly SuggestionFile[]) => boolean;
}

const hasPath = (files: readonly SuggestionFile[], pattern: string) =>
  files.some((file) => file.path.toLowerCase().includes(pattern));
const mentions = (files: readonly SuggestionFile[], pattern: string) =>
  files.some(
    (file) => file.path.startsWith("src/") && file.content.toLowerCase().includes(pattern),
  );

const IDEAS: readonly Idea[] = [
  {
    text: "Add a contact section with a simple form",
    applies: (f) => !hasPath(f, "contact") && !mentions(f, "<form"),
  },
  { text: "Add a dark mode toggle", applies: (f) => !mentions(f, "dark") },
  {
    text: "Add a pricing section with three plans",
    applies: (f) => !hasPath(f, "pricing") && !mentions(f, "pricing"),
  },
  {
    text: "Add a frequently asked questions section",
    applies: (f) => !hasPath(f, "faq") && !mentions(f, "frequently asked"),
  },
  { text: "Add a footer with links and a copyright line", applies: (f) => !hasPath(f, "footer") },
  {
    text: "Add a sticky navigation bar that scrolls to each section",
    applies: (f) => !hasPath(f, "nav") && !hasPath(f, "header"),
  },
  {
    text: "Make the layout work well on phones",
    applies: (f) => !mentions(f, "sm:") && !mentions(f, "md:"),
  },
  { text: "Add subtle hover and press animations to buttons and cards", applies: () => true },
  { text: "Tighten the typography and spacing so it feels more polished", applies: () => true },
  { text: "Check the page for accessibility problems and fix them", applies: () => true },
];

// Up to `count` ideas. `turn` (how many replies the project has had) rotates which ones come
// first, so the same three are not shown every time.
export function suggestFollowUps(
  files: readonly SuggestionFile[],
  turn: number,
  count = 3,
): string[] {
  const open = IDEAS.filter((idea) => idea.applies(files));
  if (open.length === 0) return [];
  const start = Math.max(0, turn) % open.length;
  const rotated = [...open.slice(start), ...open.slice(0, start)];
  return rotated.slice(0, count).map((idea) => idea.text);
}
