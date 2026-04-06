export type AuthUser = {
  id_ukpd: string;
  nama_ukpd: string;
  role?: string | null;
  wilayah?: string | null;
};

const STORAGE_KEY = 'auth_user';

export function storeUser(user: AuthUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearStoredUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('token');
}

export type AccessRole = 'super' | 'wilayah' | 'ukpd';

export function normalizeRole(role?: string | null): AccessRole {
  const value = (role || '').toLowerCase();
  if (value.includes('super')) return 'super';
  if (value.includes('wilayah')) return 'wilayah';
  return 'ukpd';
}

export function roleLabel(role?: string | null) {
  const normalized = normalizeRole(role);
  if (normalized === 'super') return 'Super Admin';
  if (normalized === 'wilayah') return 'Admin Wilayah';
  return 'Admin UKPD';
}
