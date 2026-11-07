import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

// Parsed lazily so `next build` and unit tests do not need a configured environment.
// Messages name the variable but never echo its value.
function parse<T extends z.ZodType>(schema: T, label: string): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(`Invalid or missing ${label} environment variables: ${names.join(", ")}`);
  }
  return result.data;
}

export const getPublicEnv = () => parse(publicSchema, "public");
export const getServiceEnv = () => parse(serverSchema, "server");

export const isProduction = () => process.env.NODE_ENV === "production";
