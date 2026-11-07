import { describe, expect, it } from "vitest";

import { buildPreview, entryFromIndexHtml, normalisePath } from "@/lib/preview/bundle";
import { cdnUrlFor, splitSpecifier } from "@/lib/preview/packages";
import { transpileWithSucrase } from "@/lib/preview/transpile";
import { STARTER_FILES } from "@/lib/templates/vite-react-starter";

const starter = () => new Map(STARTER_FILES.map((file) => [file.path, file.content]));

describe("preview bundle", () => {
  it("bundles the starter template with no errors and pinned CDN packages", () => {
    const bundle = buildPreview(starter(), transpileWithSucrase);
    expect(bundle.errors).toEqual([]);
    expect(bundle.entry).toBe("~/src/main.tsx");
    expect(Object.keys(bundle.modules)).toEqual(
      expect.arrayContaining(["~/src/App.tsx", "~/src/pages/Index.tsx", "~/src/lib/utils.ts"]),
    );
    expect(bundle.imports["react"]).toBe("https://esm.sh/react@18.3.1");
    expect(bundle.imports["react-dom/client"]).toBe("https://esm.sh/react-dom@18.3.1/client");
    expect(bundle.imports["class-variance-authority"]).toBe(
      "https://esm.sh/class-variance-authority@0.7.1?deps=react@18.3.1,react-dom@18.3.1",
    );
    expect(bundle.css).toContain("--background:");
    // The stylesheet import is gone from the module and nothing else was lost.
    expect(bundle.modules["~/src/main.tsx"]).not.toContain("index.css");
    expect(bundle.modules["~/src/main.tsx"]).toContain("createRoot");
    // JSX was compiled to the automatic runtime.
    expect(bundle.modules["~/src/pages/Index.tsx"]).toContain('from "react/jsx-runtime"');
    expect(bundle.modules["~/src/pages/Index.tsx"]).not.toContain("<main");
  });

  it("resolves the @/ alias, extensionless and index imports, and dynamic imports", () => {
    const files = new Map<string, string>([
      ["index.html", '<script type="module" src="/src/main.tsx"></script>'],
      [
        "src/main.tsx",
        'import a from "@/lib/a";\nimport b from "./widgets";\nconst c = import("../src/lazy.ts");\nexport { a, b, c };',
      ],
      ["src/lib/a.ts", "export default 1;"],
      ["src/widgets/index.tsx", "export default 2;"],
      ["src/lazy.ts", "export default 3;"],
    ]);
    const bundle = buildPreview(files, transpileWithSucrase);
    expect(bundle.errors).toEqual([]);
    const main = bundle.modules["~/src/main.tsx"] ?? "";
    expect(main).toContain('from "~/src/lib/a.ts"');
    expect(main).toContain('from "~/src/widgets/index.tsx"');
    expect(main).toContain('import("~/src/lazy.ts")');
    expect(Object.keys(bundle.modules).sort()).toEqual([
      "~/src/lazy.ts",
      "~/src/lib/a.ts",
      "~/src/main.tsx",
      "~/src/widgets/index.tsx",
    ]);
  });

  it("reports a missing import and a transpile error with the file they are in", () => {
    const files = new Map<string, string>([
      ["index.html", '<script type="module" src="/src/main.tsx"></script>'],
      ["src/main.tsx", 'import x from "./missing";\nimport y from "./broken";\nexport { x, y };'],
      ["src/broken.tsx", "export default <div>"],
    ]);
    const bundle = buildPreview(files, transpileWithSucrase);
    expect(bundle.errors).toEqual(
      expect.arrayContaining([
        { path: "src/main.tsx", message: "Cannot find ./missing." },
        expect.objectContaining({ path: "src/broken.tsx" }),
      ]),
    );
  });

  it("turns JSON and SVG files into modules and collects every stylesheet once", () => {
    const files = new Map<string, string>([
      ["index.html", '<script type="module" src="/src/main.tsx"></script>'],
      [
        "src/main.tsx",
        'import data from "./data.json";\nimport logo from "./logo.svg";\nimport "./a.css";\nimport "./b.css";\nimport "./a.css";\nexport { data, logo };',
      ],
      ["src/data.json", '{"n": 1}'],
      ["src/logo.svg", "<svg></svg>"],
      ["src/a.css", ".a{}"],
      ["src/b.css", ".b{}"],
    ]);
    const bundle = buildPreview(files, transpileWithSucrase);
    expect(bundle.errors).toEqual([]);
    expect(bundle.modules["~/src/data.json"]).toBe('export default {"n":1};\n');
    expect(bundle.modules["~/src/logo.svg"]).toContain("data:image/svg+xml");
    expect(bundle.css).toBe(".a{}\n.b{}");
    expect(bundle.modules["~/src/main.tsx"]).not.toContain(".css");
  });

  it("swaps the history router for the in-memory one only inside the preview", () => {
    const bundle = buildPreview(starter(), transpileWithSucrase);
    expect(bundle.imports["react-router-dom"]).toBe("~/preview-shims/react-router-dom.js");
    expect(bundle.modules["~/preview-shims/react-router-dom.js"]).toContain(
      "MemoryRouter as BrowserRouter",
    );
    // The project's own file still says BrowserRouter.
    expect(starter().get("src/App.tsx")).toContain("BrowserRouter");
  });

  it("fails clearly when index.html has no module entry or the entry is missing", () => {
    expect(
      buildPreview(new Map([["index.html", "<html></html>"]]), transpileWithSucrase).errors,
    ).toEqual([{ path: "index.html", message: 'No <script type="module" src> found.' }]);
    const files = new Map([["index.html", '<script type="module" src="/src/nope.tsx"></script>']]);
    expect(buildPreview(files, transpileWithSucrase).errors[0]?.message).toContain(
      "src/nope.tsx does not exist",
    );
  });

  it("does not choke on a pathological import statement", () => {
    const long = `import {${"a,".repeat(5000)}b} from "./x";\nexport {};`;
    const files = new Map([
      ["index.html", '<script type="module" src="/src/main.tsx"></script>'],
      ["src/main.tsx", long],
      ["src/x.ts", "export {};"],
    ]);
    const started = performance.now();
    buildPreview(files, transpileWithSucrase);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe("preview helpers", () => {
  it("normalises paths and reads the entry from index.html", () => {
    expect(normalisePath("src/pages", "../lib/a")).toBe("src/lib/a");
    expect(normalisePath("src", "./x/./y")).toBe("src/x/y");
    expect(normalisePath("", "/src/main.tsx")).toBe("src/main.tsx");
    expect(entryFromIndexHtml('<script type="module" src="/src/main.tsx">')).toBe("src/main.tsx");
    expect(entryFromIndexHtml('<script src="/x.js">')).toBeNull();
  });

  it("splits scoped and deep specifiers and pins known packages", () => {
    expect(splitSpecifier("@radix-ui/react-slot")).toEqual({
      name: "@radix-ui/react-slot",
      subpath: "",
    });
    expect(splitSpecifier("react-dom/client")).toEqual({ name: "react-dom", subpath: "/client" });
    expect(cdnUrlFor("@radix-ui/react-slot")).toBe(
      "https://esm.sh/@radix-ui/react-slot@1.2.3?deps=react@18.3.1,react-dom@18.3.1",
    );
    expect(cdnUrlFor("some-unknown-package/sub")).toBe(
      "https://esm.sh/some-unknown-package/sub?deps=react@18.3.1,react-dom@18.3.1",
    );
  });
});
