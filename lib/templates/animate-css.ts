// The utilities from tailwindcss-animate (the plugin in Lovable's template and in every new
// project's tailwind.config.ts), written as plain CSS for the live preview. The preview's runtime
// Tailwind receives its config by postMessage, which cannot carry plugin functions, so these
// classes are added to the project's CSS instead. Being in @layer utilities, they work with
// variants such as data-[state=open]:animate-in and motion-safe:.

const SPACING: ReadonlyArray<[string, string]> = [
  ["1", "0.25rem"],
  ["2", "0.5rem"],
  ["3", "0.75rem"],
  ["4", "1rem"],
  ["6", "1.5rem"],
  ["8", "2rem"],
  ["10", "2.5rem"],
  ["1/2", "50%"],
  ["full", "100%"],
];
const OPACITY = ["0", "5", "10", "20", "25", "30", "40", "50", "60", "70", "75", "80", "90", "95"];
const SCALE = ["0", "50", "75", "90", "95", "100", "105", "110"];
const DURATIONS = ["75", "100", "150", "200", "300", "500", "700", "1000"];

const escape = (name: string) => name.replace("/", "\\/");

function build(): string {
  const rules: string[] = [
    `.animate-in { animation-name: enter; animation-duration: 150ms; --tw-enter-opacity: initial; --tw-enter-scale: initial; --tw-enter-rotate: initial; --tw-enter-translate-x: initial; --tw-enter-translate-y: initial; }`,
    `.animate-out { animation-name: exit; animation-duration: 150ms; --tw-exit-opacity: initial; --tw-exit-scale: initial; --tw-exit-rotate: initial; --tw-exit-translate-x: initial; --tw-exit-translate-y: initial; }`,
    `.fade-in { --tw-enter-opacity: 0; }`,
    `.fade-out { --tw-exit-opacity: 0; }`,
    `.zoom-in { --tw-enter-scale: 0; }`,
    `.zoom-out { --tw-exit-scale: 0; }`,
    `.fill-mode-forwards { animation-fill-mode: forwards; }`,
    `.fill-mode-both { animation-fill-mode: both; }`,
    `.running { animation-play-state: running; }`,
    `.paused { animation-play-state: paused; }`,
  ];
  for (const o of OPACITY) {
    rules.push(`.fade-in-${o} { --tw-enter-opacity: ${Number(o) / 100}; }`);
    rules.push(`.fade-out-${o} { --tw-exit-opacity: ${Number(o) / 100}; }`);
  }
  for (const s of SCALE) {
    rules.push(`.zoom-in-${s} { --tw-enter-scale: ${Number(s) / 100}; }`);
    rules.push(`.zoom-out-${s} { --tw-exit-scale: ${Number(s) / 100}; }`);
  }
  for (const [name, value] of SPACING) {
    const n = escape(name);
    rules.push(`.slide-in-from-top-${n} { --tw-enter-translate-y: -${value}; }`);
    rules.push(`.slide-in-from-bottom-${n} { --tw-enter-translate-y: ${value}; }`);
    rules.push(`.slide-in-from-left-${n} { --tw-enter-translate-x: -${value}; }`);
    rules.push(`.slide-in-from-right-${n} { --tw-enter-translate-x: ${value}; }`);
    rules.push(`.slide-out-to-top-${n} { --tw-exit-translate-y: -${value}; }`);
    rules.push(`.slide-out-to-bottom-${n} { --tw-exit-translate-y: ${value}; }`);
    rules.push(`.slide-out-to-left-${n} { --tw-exit-translate-x: -${value}; }`);
    rules.push(`.slide-out-to-right-${n} { --tw-exit-translate-x: ${value}; }`);
  }
  for (const d of DURATIONS) rules.push(`.duration-${d} { animation-duration: ${d}ms; }`);
  for (const d of DURATIONS) rules.push(`.delay-${d} { animation-delay: ${d}ms; }`);

  return `
@keyframes enter {
  from {
    opacity: var(--tw-enter-opacity, 1);
    transform: translate3d(var(--tw-enter-translate-x, 0), var(--tw-enter-translate-y, 0), 0)
      scale3d(var(--tw-enter-scale, 1), var(--tw-enter-scale, 1), var(--tw-enter-scale, 1))
      rotate(var(--tw-enter-rotate, 0));
  }
}
@keyframes exit {
  to {
    opacity: var(--tw-exit-opacity, 1);
    transform: translate3d(var(--tw-exit-translate-x, 0), var(--tw-exit-translate-y, 0), 0)
      scale3d(var(--tw-exit-scale, 1), var(--tw-exit-scale, 1), var(--tw-exit-scale, 1))
      rotate(var(--tw-exit-rotate, 0));
  }
}
@layer utilities {
${rules.map((rule) => `  ${rule}`).join("\n")}
}
`;
}

export const ANIMATE_UTILITIES_CSS = build();
