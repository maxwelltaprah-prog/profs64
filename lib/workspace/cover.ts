// A project has no screenshot, so its card shows a flat cover chosen from its id. The same
// project always gets the same cover. Pure; the variants are styled in globals.css (.cover-N).
export const COVER_VARIANTS = 6;

export function coverVariant(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % COVER_VARIANTS;
}
