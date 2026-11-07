import { type CookieOptions } from "@supabase/ssr";

// Session cookies are never read by browser JavaScript: all data access goes through server
// code, so httpOnly can be forced on regardless of what the Supabase client suggests.
export function hardenCookieOptions(
  options: CookieOptions | undefined,
  secure: boolean,
): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  };
}
