import { execFileSync } from "node:child_process";
import path from "node:path";

const script = path.resolve(import.meta.dirname, "../../scripts/test-db.sh");

let startedLocalDb = false;

// With TEST_DATABASE_URL set (CI, against `supabase start`) nothing is started.
// Otherwise a throwaway local Postgres is created and removed again afterwards.
export function setup() {
  if (process.env["TEST_DATABASE_URL"]) return;
  const url = execFileSync(script, ["start"], { encoding: "utf8" }).trim();
  process.env["TEST_DATABASE_URL"] = url;
  process.env["TEST_DATABASE_SHIM"] = "1";
  startedLocalDb = true;
}

export function teardown() {
  if (startedLocalDb) execFileSync(script, ["stop"]);
}
