export type Role = 'admin' | 'staff';

const AUTH_ROLE_KEY = 'pos-auth-role';
const AUTH_USER_KEY = 'pos-auth-user';

export function setAuth(role: Role, userId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_ROLE_KEY, role);
  localStorage.setItem(AUTH_USER_KEY, userId);
}

export function getAuth() {
  if (typeof window === 'undefined') {
    return { role: null as Role | null, userId: null as string | null };
  }
  const role = localStorage.getItem(AUTH_ROLE_KEY) as Role | null;
  const userId = localStorage.getItem(AUTH_USER_KEY);
  return { role, userId };
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_ROLE_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}
