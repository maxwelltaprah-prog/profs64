// One error type for everything that should reach the client with a known status and a
// message that is safe to show. Anything else is treated as a bug and returned as a generic 500.
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: Readonly<Record<string, string>>;

  constructor(status: number, code: string, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export const badRequest = (message = "The request could not be read. Check it and try again.") =>
  new AppError(400, "bad_request", message);
export const unauthenticated = () => new AppError(401, "unauthenticated", "Sign in to continue.");
export const emailNotVerified = () =>
  new AppError(403, "email_not_verified", "Confirm your email address before using the assistant.");
export const forbidden = () => new AppError(403, "forbidden", "This request was blocked.");
export const notFound = () => new AppError(404, "not_found", "That resource does not exist.");
export const payloadTooLarge = () =>
  new AppError(413, "payload_too_large", "The request is too large.");
export const unsupportedMediaType = () =>
  new AppError(415, "unsupported_media_type", "Send the request as JSON.");
export const validationFailed = () =>
  new AppError(
    422,
    "validation_failed",
    "Some fields are missing or invalid. Check them and try again.",
  );
export const rateLimited = (retryAfterSeconds: number) =>
  new AppError(
    429,
    "rate_limited",
    `Too many attempts. Try again in ${retryAfterSeconds} seconds.`,
    {
      "Retry-After": String(retryAfterSeconds),
    },
  );

export interface ErrorBody {
  error: { code: string; message: string; requestId: string };
}

export function errorResponse(error: unknown, requestId: string): Response {
  const known = error instanceof AppError;
  const status = known ? error.status : 500;
  const body: ErrorBody = {
    error: {
      code: known ? error.code : "internal_error",
      message: known ? error.message : "Something went wrong on our side. Try again in a moment.",
      requestId,
    },
  };
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      ...(known ? error.headers : {}),
    },
  });
}

export const weakPassword = (message: string) => new AppError(422, "weak_password", message);
export const invalidCredentials = () =>
  new AppError(
    401,
    "invalid_credentials",
    "Email or password is incorrect, or the email address has not been confirmed yet.",
  );
