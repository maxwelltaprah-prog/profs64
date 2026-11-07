import { assertSameOrigin } from "./csrf";
import { AppError, errorResponse } from "./errors";
import { logger } from "./logger";
import { getRequestId } from "./request-id";

export interface ApiContext {
  requestId: string;
}

// Wraps a route handler with the checks every state-changing API shares: request ID, CSRF
// origin check, uniform error responses, and one structured log line with no body content.
export function withApi(
  route: string,
  handler: (request: Request, context: ApiContext) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const requestId = getRequestId(request.headers);
    const started = Date.now();
    let response: Response;
    try {
      assertSameOrigin(request);
      response = await handler(request, { requestId });
      response.headers.set("X-Request-Id", requestId);
      response.headers.set("Cache-Control", "no-store");
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error("unhandled_error", { route, requestId, error });
      }
      response = errorResponse(error, requestId);
    }
    logger.info("request", {
      route,
      method: request.method,
      status: response.status,
      durationMs: Date.now() - started,
      requestId,
    });
    return response;
  };
}
