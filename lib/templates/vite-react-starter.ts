// The fixed template every new project starts from, and the one the assistant's system prompt
// describes. It follows the shape Lovable scaffolds (vite_react_shadcn_ts): Vite 5, React 18,
// TypeScript, Tailwind 3 with shadcn/ui tokens, a few shadcn components, lucide icons and
// react-router. Keep lib/ai/system-prompt.ts and lib/preview/packages.ts in step with it.

import { SHADCN_INDEX_CSS, SHADCN_TAILWIND_CONFIG } from "./shadcn-theme";

export interface StarterFile {
  path: string;
  content: string;
}

// Versions are the ones in Lovable's template, pinned to exact releases so the preview can
// load the same versions from a CDN and the installed project matches what was previewed.
export const STARTER_DEPENDENCIES = {
  "@radix-ui/react-label": "2.1.7",
  "@radix-ui/react-slot": "1.2.3",
  "@tanstack/react-query": "5.83.0",
  "class-variance-authority": "0.7.1",
  clsx: "2.1.1",
  "lucide-react": "0.462.0",
  react: "18.3.1",
  "react-dom": "18.3.1",
  "react-router-dom": "6.30.1",
  "tailwind-merge": "2.6.0",
} as const;

export const STARTER_DEV_DEPENDENCIES = {
  "@types/react": "18.3.23",
  "@types/react-dom": "18.3.7",
  "@vitejs/plugin-react-swc": "3.11.0",
  autoprefixer: "10.4.21",
  postcss: "8.5.6",
  tailwindcss: "3.4.17",
  typescript: "5.8.3",
  vite: "5.4.19",
} as const;

const packageJson = {
  name: "my-app",
  private: true,
  version: "0.0.0",
  type: "module",
  scripts: {
    dev: "vite",
    build: "vite build",
    "build:dev": "vite build --mode development",
    preview: "vite preview",
  },
  dependencies: STARTER_DEPENDENCIES,
  devDependencies: STARTER_DEV_DEPENDENCIES,
};

const tsconfig = {
  compilerOptions: {
    target: "ES2020",
    lib: ["ES2020", "DOM", "DOM.Iterable"],
    module: "ESNext",
    moduleResolution: "bundler",
    jsx: "react-jsx",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    isolatedModules: true,
    baseUrl: ".",
    paths: { "@/*": ["./src/*"] },
    types: ["vite/client"],
  },
  include: ["src", "vite.config.ts"],
};

const componentsJson = {
  style: "default",
  rsc: false,
  tsx: true,
  tailwind: {
    config: "tailwind.config.ts",
    css: "src/index.css",
    baseColor: "slate",
    cssVariables: true,
  },
  aliases: {
    components: "@/components",
    utils: "@/lib/utils",
    ui: "@/components/ui",
    lib: "@/lib",
    hooks: "@/hooks",
  },
};

export const STARTER_FILES: ReadonlyArray<StarterFile> = [
  { path: "package.json", content: `${JSON.stringify(packageJson, null, 2)}\n` },
  { path: "tsconfig.json", content: `${JSON.stringify(tsconfig, null, 2)}\n` },
  { path: "components.json", content: `${JSON.stringify(componentsJson, null, 2)}\n` },
  {
    path: "vite.config.ts",
    content: `import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  server: { host: "::", port: 8080 },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
`,
  },
  {
    path: "tailwind.config.ts",
    content: `import type { Config } from "tailwindcss";

export default ${JSON.stringify(SHADCN_TAILWIND_CONFIG, null, 2)} satisfies Config;
`,
  },
  {
    path: "postcss.config.js",
    content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
  },
  {
    path: "index.html",
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My app</title>
    <meta name="description" content="Built with Buildr" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  },
  {
    path: "src/main.tsx",
    content: `import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(<App />);
`,
  },
  {
    path: "src/App.tsx",
    content: `import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        {/* Add custom routes above the catch-all "*" route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
`,
  },
  {
    path: "src/pages/Index.tsx",
    content: `import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight">My app</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          This is the starting point. Describe what you want to build in the chat and the files
          here will change to match.
        </p>
        <Button className="mt-6">Get started</Button>
      </div>
    </main>
  );
};

export default Index;
`,
  },
  {
    path: "src/pages/NotFound.tsx",
    content: `import { Link, useLocation } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">
          There is no page at {location.pathname}.
        </p>
        <Link to="/" className="mt-4 inline-block underline underline-offset-4">
          Back to home
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
`,
  },
  { path: "src/index.css", content: SHADCN_INDEX_CSS },
  {
    path: "src/lib/utils.ts",
    content: `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`,
  },
  {
    path: "src/components/ui/button.tsx",
    content: `import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
`,
  },
  {
    path: "src/components/ui/card.tsx",
    content: `import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
`,
  },
  {
    path: "src/components/ui/input.tsx",
    content: `import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
`,
  },
  {
    path: "src/components/ui/label.tsx",
    content: `import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
`,
  },
  {
    path: "src/components/ui/badge.tsx",
    content: `import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
`,
  },
  {
    path: "README.md",
    content: `# My app

A Vite, React, TypeScript and Tailwind CSS project with shadcn/ui components, built with Buildr.

\`\`\`
npm install
npm run dev
\`\`\`

Components live in \`src/components\`, pages in \`src/pages\`, and \`@/\` points at \`src/\`.
`,
  },
];

export const STARTER_PATHS: ReadonlyArray<string> = STARTER_FILES.map((file) => file.path);
