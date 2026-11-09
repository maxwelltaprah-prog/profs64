// The Tailwind theme the starter template uses, in the shape shadcn/ui expects (HSL tokens read
// from CSS variables). It is a plain object so the same definition can be written into the
// project's tailwind.config.ts and handed to the preview's runtime Tailwind unchanged.

const hsl = (name: string) => `hsl(var(--${name}))`;

export const SHADCN_THEME_EXTEND = {
  container: {
    center: true,
    padding: "2rem",
    screens: { "2xl": "1400px" },
  },
  colors: {
    border: hsl("border"),
    input: hsl("input"),
    ring: hsl("ring"),
    background: hsl("background"),
    foreground: hsl("foreground"),
    primary: { DEFAULT: hsl("primary"), foreground: hsl("primary-foreground") },
    secondary: { DEFAULT: hsl("secondary"), foreground: hsl("secondary-foreground") },
    destructive: { DEFAULT: hsl("destructive"), foreground: hsl("destructive-foreground") },
    muted: { DEFAULT: hsl("muted"), foreground: hsl("muted-foreground") },
    accent: { DEFAULT: hsl("accent"), foreground: hsl("accent-foreground") },
    popover: { DEFAULT: hsl("popover"), foreground: hsl("popover-foreground") },
    card: { DEFAULT: hsl("card"), foreground: hsl("card-foreground") },
  },
  borderRadius: {
    lg: "var(--radius)",
    md: "calc(var(--radius) - 2px)",
    sm: "calc(var(--radius) - 4px)",
  },
  // Lovable's template keyframes (shadcn accordion) plus two small entrances the assistant uses.
  keyframes: {
    "accordion-down": {
      from: { height: "0" },
      to: { height: "var(--radix-accordion-content-height)" },
    },
    "accordion-up": {
      from: { height: "var(--radix-accordion-content-height)" },
      to: { height: "0" },
    },
    "fade-up": {
      from: { opacity: "0", transform: "translateY(8px)" },
      to: { opacity: "1", transform: "translateY(0)" },
    },
    "scale-in": {
      from: { opacity: "0", transform: "scale(0.97)" },
      to: { opacity: "1", transform: "scale(1)" },
    },
  },
  animation: {
    "accordion-down": "accordion-down 0.2s ease-out",
    "accordion-up": "accordion-up 0.2s ease-out",
    "fade-up": "fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
    "scale-in": "scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
  },
} as const;

export const SHADCN_TAILWIND_CONFIG = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: SHADCN_THEME_EXTEND },
} as const;

// The CSS custom properties the tokens above read. Lovable's default palette: neutral, with a
// near-black primary in light mode and the inverse in dark mode.
export const SHADCN_INDEX_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`;
