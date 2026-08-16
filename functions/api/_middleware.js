// Stamps security headers onto every /api/* response (see ../_lib/security-headers.js).
// Scoped to this directory rather than the project root so static asset delivery
// is untouched — those already get their headers from /_headers.
import { withSecurityHeaders, API_CSP } from '../_lib/security-headers.js';

export async function onRequest(context) {
  return withSecurityHeaders(await context.next(), API_CSP);
}
