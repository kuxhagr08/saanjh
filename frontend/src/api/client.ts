const isNativePlatform = typeof window !== 'undefined' && (
  Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
  window.location.protocol === 'capacitor:' ||
  (window.location.hostname === 'localhost' && window.location.port === '')
);

// Default server for mobile APKs connects to laptop LAN IP, web connects to localhost
const DEFAULT_SERVER_URL = isNativePlatform ? 'http://192.168.1.8:8000' : 'http://localhost:8000';

export function getServerUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('saanjh_server_url');
    if (custom) return custom.replace(/\/+$/, '');
  }
  const envUrl = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
  return DEFAULT_SERVER_URL;
}

export function setServerUrl(url: string): void {
  if (typeof window !== 'undefined') {
    const clean = url.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
    localStorage.setItem('saanjh_server_url', clean);
  }
}

export const getApiBase = (): string => `${getServerUrl()}/api`;
export const getWsBase = (): string => {
  const s = getServerUrl();
  return s.startsWith('https://')
    ? s.replace('https://', 'wss://')
    : s.replace('http://', 'ws://');
};

export const API_BASE = getApiBase();
export const WS_BASE = getWsBase();

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface UserProfile {
  id: number;
  email: string;
  phone_number?: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_url?: string;
  about?: string;
  status_visibility?: 'everyone' | 'contacts_only' | 'nobody';
  profile_photo_visibility?: 'everyone' | 'contacts_only' | 'nobody';
  read_receipts_enabled?: boolean;
  allow_phone_discovery?: boolean;
  allow_email_discovery?: boolean;
  allow_username_discovery?: boolean;
  messaging_permission?: 'everyone' | 'contacts_only' | 'nobody';
  created_at: string;
  has_keys: boolean;
}

export function getStoredTokens(): AuthTokens | null {
  const t = localStorage.getItem('apna_auth_tokens');
  return t ? JSON.parse(t) : null;
}

export function setStoredTokens(tokens: AuthTokens | null) {
  if (!tokens) {
    localStorage.removeItem('apna_auth_tokens');
  } else {
    localStorage.setItem('apna_auth_tokens', JSON.stringify(tokens));
  }
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const tokens = getStoredTokens();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (tokens?.access) {
    headers.set('Authorization', `Bearer ${tokens.access}`);
  }

  const currentBase = getApiBase();
  let res: Response;
  try {
    res = await fetch(`${currentBase}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    if (netErr.name === 'TypeError' && String(netErr.message || '').toLowerCase().includes('fetch')) {
      throw new Error(`Cannot connect to server at ${currentBase}. Please check server settings or Wi-Fi connection.`);
    }
    throw netErr;
  }

  // Token refresh attempt on 401
  if (res.status === 401 && tokens?.refresh) {
    const refreshRes = await fetch(`${currentBase}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: tokens.refresh }),
    }).catch(() => null);

    if (refreshRes && refreshRes.ok) {
      const data = await refreshRes.json();
      const newTokens = { ...tokens, access: data.access };
      setStoredTokens(newTokens);
      headers.set('Authorization', `Bearer ${newTokens.access}`);
      res = await fetch(`${currentBase}${endpoint}`, {
        ...options,
        headers,
      });
    } else {
      setStoredTokens(null);
      window.dispatchEvent(new CustomEvent('apna_auth_expired'));
    }
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const firstVal = Object.values(errorData)[0];
    const extracted = errorData.error || errorData.detail || (Array.isArray(firstVal) ? firstVal[0] : firstVal) || 'API request failed';
    throw new Error(typeof extracted === 'string' ? extracted : JSON.stringify(extracted));
  }

  return res.json();
}
