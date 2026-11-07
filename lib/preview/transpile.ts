import { transform } from "sucrase";

import type { Transpile } from "./bundle";

// TypeScript and JSX to plain ES modules, without type-checking, in the browser. Sucrase does
// no evaluation, so it runs under the app's strict CSP; the output runs only inside the
// sandboxed preview frame.
export const transpileWithSucrase: Transpile = (code, path) => {
  try {
    const result = transform(code, {
      transforms:
        path.endsWith(".ts") || path.endsWith(".js") ? ["typescript"] : ["typescript", "jsx"],
      jsxRuntime: "automatic",
      production: true,
      filePath: path,
      disableESTransforms: true,
    });
    return { code: result.code };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not transpile this file." };
  }
};
