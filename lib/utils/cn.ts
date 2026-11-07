// Joins class names, skipping falsy values. No merge logic: components declare variants
// explicitly instead of overriding each other's classes.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
