import "server-only";

import { type User } from "@supabase/supabase-js";
import { cache } from "react";

import { emailNotVerified, unauthenticated } from "@/lib/security/errors";

import { createSupabaseServerClient } from "./supabase-server";

// Cached per request so the shared layout and the page it wraps verify the session once.
export const getOptionalUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

// Authenticated and email-verified. Required before any model call; see lib/security/mfa.ts
// for where a second-factor check slots in.
export async function getVerifiedUser(): Promise<User> {
  const user = await getOptionalUser();
  if (!user) throw unauthenticated();
  if (!user.email_confirmed_at) throw emailNotVerified();
  return user;
}
