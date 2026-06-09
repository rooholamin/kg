/**
 * Throws a FORBIDDEN error if the session user's role slug is not in allowedSlugs.
 * Use after the session existence check in API routes.
 *
 * @param {import('next-auth').Session | null} session
 * @param {...string} allowedSlugs
 */
export function requireRole(session, ...allowedSlugs) {
  if (!allowedSlugs.includes(session?.user?.roleSlug)) {
    const err = new Error('Forbidden — insufficient role');
    err.code = 'FORBIDDEN';
    throw err;
  }
}
