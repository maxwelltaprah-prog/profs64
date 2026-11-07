import { z } from "zod";

import {
  AUTH_BODY_LIMIT_BYTES,
  CHAT_BODY_LIMIT_BYTES,
  CHAT_TEXT_MAX_CHARS,
  DELETE_CONFIRMATION,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PROJECT_BODY_LIMIT_BYTES,
} from "@/lib/security/limits";

// Re-exported so server code keeps one import; client code imports from limits.ts directly.
export {
  AUTH_BODY_LIMIT_BYTES,
  CHAT_BODY_LIMIT_BYTES,
  CHAT_TEXT_MAX_CHARS,
  DELETE_CONFIRMATION,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PROJECT_BODY_LIMIT_BYTES,
};

// Strict objects reject unexpected keys so a client cannot smuggle extra fields past validation.
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

const newPassword = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

// `next` is a same-site path to land on after the confirmation link; the route re-checks it
// with safeRedirectPath, so the schema only bounds its size.
export const signupSchema = z.strictObject({
  email,
  password: newPassword,
  next: z.string().max(512).optional(),
});
export const loginSchema = z.strictObject({ email, password: z.string().min(1).max(PASSWORD_MAX) });
export const forgotPasswordSchema = z.strictObject({ email });
export const resetPasswordSchema = z.strictObject({ password: newPassword });

export const createProjectSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, "Enter a project name.")
    .max(80)
    // No control characters; names are rendered as text only, but keep stored data clean.
    .regex(/^[^\u0000-\u001f\u007f]+$/),
});

// The client sends only its newest message and a project id. History is loaded from the database,
// so a client can never supply or rewrite earlier turns.
export const chatBodySchema = z.strictObject({
  id: z.uuid(),
  message: z.object({
    id: z.string().max(100).optional(),
    role: z.literal("user"),
    parts: z
      .array(
        z.strictObject({
          type: z.literal("text"),
          text: z.string().trim().min(1).max(CHAT_TEXT_MAX_CHARS),
        }),
      )
      .length(1),
  }),
});
export type ChatBody = z.infer<typeof chatBodySchema>;

export const deleteAccountSchema = z.strictObject({
  password: z.string().min(1).max(PASSWORD_MAX),
  confirm: z.literal(DELETE_CONFIRMATION),
});
