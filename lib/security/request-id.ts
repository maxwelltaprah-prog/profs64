const VALID_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

// Reuses a caller-supplied ID only if it is a plain token, so a client cannot inject
// newlines or oversized values into logs. Otherwise a fresh one is generated.
export function getRequestId(headers: Headers): string {
  const supplied = headers.get("x-request-id");
  return supplied !== null && VALID_REQUEST_ID.test(supplied) ? supplied : crypto.randomUUID();
}
