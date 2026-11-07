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
