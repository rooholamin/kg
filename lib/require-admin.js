export function requireAdmin(session) {
  const roleName = session?.user?.roleName;
  if (roleName !== 'Administrator' && roleName !== 'Owner') {
    const error = new Error('Forbidden — admin only');
    error.code = 'FORBIDDEN';
    throw error;
  }
}
