import { z } from "zod";

import { PACK_IDS } from "@/lib/credits/packs";
import { isValidBranch, parseRepoInput } from "@/lib/github/push";
import { INTEGRATION_IDS } from "@/lib/integrations/catalog";
import {
  ATTACHMENT_BODY_LIMIT_BYTES,
  AUTH_BODY_LIMIT_BYTES,
  CHAT_BODY_LIMIT_BYTES,
  CHAT_TEXT_MAX_CHARS,
  DELETE_CONFIRMATION,
  FEEDBACK_BODY_LIMIT_BYTES,
  TESTER_FEEDBACK_MAX_CHARS,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PROJECT_BODY_LIMIT_BYTES,
} from "@/lib/security/limits";

// Re-exported so server code keeps one import; client code imports from limits.ts directly.
export {
  ATTACHMENT_BODY_LIMIT_BYTES,
  FEEDBACK_BODY_LIMIT_BYTES,
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
  // Replace the newest reply instead of adding a message: the server drops that reply and answers
  // the last message again. History still comes from the database, never from the client.
  regenerate: z.boolean().optional(),
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

// The chat agent takes the conversation from the path, so the body is only the new message.
export const agentChatBodySchema = chatBodySchema.omit({ id: true });

export const conversationCreateSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
});
export const conversationRenameSchema = conversationCreateSchema;

// Renaming and/or pinning a conversation. At least one field must be present.
export const conversationUpdateSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(120).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((body) => body.title !== undefined || body.pinned !== undefined, {
    message: "Nothing to update.",
  });

// Renaming and/or pinning a project.
export const projectUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(80).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((body) => body.name !== undefined || body.pinned !== undefined, {
    message: "Nothing to update.",
  });

export const deleteAccountSchema = z.strictObject({
  password: z.string().min(1).max(PASSWORD_MAX),
  confirm: z.literal(DELETE_CONFIRMATION),
});

// Thumbs up, thumbs down, or clearing the choice. Nothing else is accepted.
export const feedbackBodySchema = z.strictObject({ rating: z.enum(["up", "down", "none"]) });
export type FeedbackBody = z.infer<typeof feedbackBodySchema>;

// Text files to attach to the next message. Names and contents are checked again by
// checkAttachment (lib/workspace/attachments.ts) so the same rules apply in the browser.
export const attachmentsBodySchema = z.strictObject({
  files: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(200),
        content: z.string().max(200_000),
      }),
    )
    .min(1)
    .max(3),
});
export type AttachmentsBody = z.infer<typeof attachmentsBodySchema>;

// Joining the credit-pack waitlist: only a known pack id is accepted.
export const waitlistBodySchema = z.strictObject({
  pack: z.enum(PACK_IDS as [string, ...string[]]),
});
// Feedback from a tester. The page is only the path they were on, so it is cut to a path shape.
export const testerFeedbackSchema = z.strictObject({
  message: z.string().trim().min(1).max(TESTER_FEEDBACK_MAX_CHARS),
  page: z
    .string()
    .max(200)
    .regex(/^\/[A-Za-z0-9/_\-.]*$/)
    .optional(),
});

export type WaitlistBody = z.infer<typeof waitlistBodySchema>;

// Asking to be told when an integration ships: only a known integration id is accepted.
export const integrationInterestSchema = z.strictObject({
  integration: z.enum(INTEGRATION_IDS as [string, ...string[]]),
});

// Push a project to GitHub. The token is only ever read from this body, used once and dropped.
export const githubPushSchema = z.strictObject({
  token: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{20,255}$/, "That does not look like a GitHub token."),
  repo: z
    .string()
    .trim()
    .max(200)
    .refine((value) => parseRepoInput(value) !== null, "Use the form owner/repository."),
  branch: z
    .string()
    .trim()
    .max(100)
    .refine(isValidBranch, "That is not a valid branch name.")
    .optional(),
  message: z
    .string()
    .trim()
    .max(200)
    .regex(/^[^\u0000-\u001f\u007f]*$/)
    .optional(),
  create: z.boolean().default(false),
});
