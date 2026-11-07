// Where the preview loads npm packages from. Versions are pinned to the starter template so
// what is previewed is what `npm install` would give. Anything the model adds to package.json
// that is not listed here is loaded at the version esm.sh resolves, with React deduplicated.

import { STARTER_DEPENDENCIES } from "@/lib/templates/vite-react-starter";

export const CDN = "https://esm.sh";
export const REACT_VERSION = STARTER_DEPENDENCIES.react;

const PINNED = new Map<string, string>(Object.entries(STARTER_DEPENDENCIES));

// Everything React-based must share one React instance, which esm.sh does through ?deps=.
const DEPS = `deps=react@${REACT_VERSION},react-dom@${REACT_VERSION}`;

export function splitSpecifier(specifier: string): { name: string; subpath: string } {
  const parts = specifier.split("/");
  const take = specifier.startsWith("@") ? 2 : 1;
  const name = parts.slice(0, take).join("/");
  const rest = parts.slice(take).join("/");
  return { name, subpath: rest ? `/${rest}` : "" };
}

export function cdnUrlFor(specifier: string): string {
  const { name, subpath } = splitSpecifier(specifier);
  const version = PINNED.get(name);
  const pinned = version ? `${name}@${version}` : name;
  if (name === "react" || name === "react-dom") return `${CDN}/${pinned}${subpath}`;
  return `${CDN}/${pinned}${subpath}?${DEPS}`;
}
