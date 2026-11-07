import { z } from "zod";

// Strict objects reject unexpected keys so a client cannot smuggle extra fields past validation.
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

const newPassword = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

export const signupSchema = z.strictObject({ email, password: newPassword });
export const loginSchema = z.strictObject({ email, password: z.string().min(1).max(PASSWORD_MAX) });
export const forgotPasswordSchema = z.strictObject({ email });
export const resetPasswordSchema = z.strictObject({ password: newPassword });

export const AUTH_BODY_LIMIT_BYTES = 4 * 1024;

export const createProjectSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, "Enter a project name.")
    .max(80)
    // No control characters; names are rendered as text only, but keep stored data clean.
    .regex(/^[^\u0000-\u001f\u007f]+$/),
});
export const PROJECT_BODY_LIMIT_BYTES = 2 * 1024;

export const CHAT_BODY_LIMIT_BYTES = 32 * 1024;
export const CHAT_TEXT_MAX_CHARS = 8000;

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
