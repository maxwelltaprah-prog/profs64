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

  return NextResponse.redirect(new URL("/login?error=link_invalid", request.url));
}
