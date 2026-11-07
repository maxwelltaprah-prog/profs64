// The fixed template every new project starts from, and the one the assistant's system prompt
// describes. Keep the two in sync: lib/ai/system-prompt.ts names these files and packages.

export interface StarterFile {
  path: string;
  content: string;
}

const packageJson = {
  name: "app",
  private: true,
  version: "0.0.0",
  type: "module",
  scripts: {
    dev: "vite",
    build: "tsc --noEmit && vite build",
    preview: "vite preview",
  },
  dependencies: {
    react: "^19.3.1",
    "react-dom": "^19.3.1",
  },
  devDependencies: {
    "@tailwindcss/vite": "^4.3.5",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.2.1",
    tailwindcss: "^4.3.5",
    typescript: "~5.9.3",
    vite: "^8.3.6",
  },
};

const tsconfig = {
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    module: "ESNext",
    moduleResolution: "bundler",
    jsx: "react-jsx",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    isolatedModules: true,
    types: ["vite/client"],
  },
  include: ["src", "vite.config.ts"],
};

export const STARTER_FILES: ReadonlyArray<StarterFile> = [
  { path: "package.json", content: `${JSON.stringify(packageJson, null, 2)}\n` },
  { path: "tsconfig.json", content: `${JSON.stringify(tsconfig, null, 2)}\n` },
  {
    path: "vite.config.ts",
    content: `import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
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
    content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
  },
  {
    path: "src/App.tsx",
    content: `export default function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-3 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">My app</h1>
      <p className="text-neutral-600">
        This is the starting point. Describe what you want to build in the chat and the files
        here will be changed to match.
      </p>
    </main>
  );
}
`,
  },
  { path: "src/index.css", content: `@import "tailwindcss";\n` },
  {
    path: "README.md",
    content: `# My app

A Vite, React, TypeScript and Tailwind CSS project.

\`\`\`
npm install
npm run dev
\`\`\`
`,
  },
];

export const STARTER_PATHS: ReadonlyArray<string> = STARTER_FILES.map((file) => file.path);
