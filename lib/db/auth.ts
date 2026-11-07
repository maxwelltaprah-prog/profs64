import "server-only";

import { type User } from "@supabase/supabase-js";

import { emailNotVerified, unauthenticated } from "@/lib/security/errors";

import { createSupabaseServerClient } from "./supabase-server";

export async function getOptionalUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

// Authenticated and email-verified. Required before any model call; see lib/security/mfa.ts
// for where a second-factor check slots in.
export async function getVerifiedUser(): Promise<User> {
  const user = await getOptionalUser();
  if (!user) throw unauthenticated();
  if (!user.email_confirmed_at) throw emailNotVerified();
  return user;
}
