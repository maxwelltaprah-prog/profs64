import { createServerClient } from "@supabase/ssr";
import { type User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { hardenCookieOptions } from "./cookies";
import { getPublicEnv, isProduction } from "./env";

// Refreshes the session cookie for page requests and reports who the caller is. This is an
// optimistic check for redirects only; every page and route re-verifies with getVerifiedUser().
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const env = getPublicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, hardenCookieOptions(options, isProduction()));
          }
        },
      },
    },
  );

  // getUser() asks the Auth server to validate the token, unlike reading the cookie.
  const { data } = await supabase.auth.getUser();
  return { response, user: data.user };
}
