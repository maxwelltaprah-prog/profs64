import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { hardenCookieOptions } from "./cookies";
import { getPublicEnv, isProduction } from "./env";

// Per-request client that acts as the signed-in user, so Row Level Security applies.
export async function createSupabaseServerClient() {
  const env = getPublicEnv();
  const store = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            store.set(name, value, hardenCookieOptions(options, isProduction()));
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. proxy.ts refreshes
          // the session on every request, so skipping the write here is safe.
        }
      },
    },
  });
}
