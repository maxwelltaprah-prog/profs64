import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logger } from "@/lib/security/logger";
import { safeRedirectPath } from "@/lib/security/redirect";

// Landing point for the links in confirmation and recovery emails (PKCE flow).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code && code.length <= 512) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    logger.warn("auth_callback_failed", { code: error.code ?? "unknown" });
  }

  // Google sign-in for an address that is not on the beta list is refused by the database, which
  // Supabase reports as this generic message.
  const description = searchParams.get("error_description") ?? "";
  if (description.includes("Database error saving new user")) {
    logger.info("oauth_not_invited");
    return NextResponse.redirect(new URL("/login?error=invite_only", request.url));
  }

  return NextResponse.redirect(new URL("/login?error=link_invalid", request.url));
}
