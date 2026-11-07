# Known issues

Medium and low findings that are not fixed yet, with the reason.

| ID   | Finding                                                                                                                       | Severity | Rationale                                                                                                    | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| KI-1 | `npm audit` reports moderate advisories in `minimatch` through the typescript-eslint chain pulled in by `eslint-config-next`. | Medium   | Dev-time lint tooling only; not in the runtime bundle. The audit gate is set to `high`. Upstream fix needed. | Open   |
