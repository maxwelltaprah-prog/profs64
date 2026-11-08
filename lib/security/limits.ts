// Plain constants shared by server validation and client components. This module must stay
// free of Zod: Zod 4 compiles object parsers with `new Function`, which the strict CSP blocks
// in the browser, so client code imports limits from here and never from schemas.ts.

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export const AUTH_BODY_LIMIT_BYTES = 4 * 1024;
export const PROJECT_BODY_LIMIT_BYTES = 2 * 1024;

export const CHAT_BODY_LIMIT_BYTES = 32 * 1024;
export const CHAT_TEXT_MAX_CHARS = 8000;

export const FEEDBACK_BODY_LIMIT_BYTES = 256;
// Three files of up to 100 KB each, plus JSON escaping.
export const ATTACHMENT_BODY_LIMIT_BYTES = 512 * 1024;

export const DELETE_CONFIRMATION = "delete my account";
