// Stamps security headers onto the SSR community-deck pages. These render text
// authored by other users, so they are the single most important surface on the
// site to have a CSP — and until now they had none at all.
import { withSecurityHeaders, DECK_CSP } from '../_lib/security-headers.js';

export async function onRequest(context) {
  return withSecurityHeaders(await context.next(), DECK_CSP);
}
