import { BRAND_ICONS } from "@/lib/integrations/brand-icons";

// The real logo of an integration, drawn for a light tile (bg-paper, the same in both themes). A fixed brand colour is applied through a class chosen from a
// fixed list, because the CSP forbids inline style attributes.
const COLOUR_CLASS: Record<string, string> = {
  "#00C7B7": "text-[#00C7B7]",
  "#3FCF8E": "text-[#3FCF8E]",
  "#635BFF": "text-[#635BFF]",
  "#34A853": "text-[#34A853]",
  "#4285F4": "text-[#4285F4]",
  "#4A154B": "text-[#4A154B]",
  "#F24E1E": "text-[#F24E1E]",
};

export function BrandIcon({ id, className }: { id: string; className?: string }) {
  const icon = BRAND_ICONS[id];
  if (!icon) return null;
  const colour = icon.hex ? (COLOUR_CLASS[icon.hex] ?? "text-paper-text") : "text-paper-text";
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      className={`${colour} ${className ?? "size-5"}`}
      fill="currentColor"
    >
      <path d={icon.path} />
    </svg>
  );
}
