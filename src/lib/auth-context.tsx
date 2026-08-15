import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface AuthUser {
  id: string;
  uid: string;
  email: string;
  name?: string | null;
}

export interface Business {
  id: string;
  name: string;
  onboardingCompleted: boolean;
}

type BusinessApiResponse = Partial<Business> & {
  id: string;
  name: string;
  onboarding_completed?: boolean;
};

/** Normalizes PostgreSQL snake_case fields to the shape used by the React app. */
function normalizeBusiness(rawBusiness: BusinessApiResponse | null | undefined): Business | null {
  if (!rawBusiness) return null;

  return {
    id: rawBusiness.id,
    name: rawBusiness.name,
    onboardingCompleted: rawBusiness.onboardingCompleted ?? rawBusiness.onboarding_completed ?? false,
  };
}

interface AuthContextType {
  user: AuthUser | null;
  business: Business | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  token: string | null;
  getToken: () => Promise<string | null>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  refreshBusiness: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TOKEN_KEY = 'mkt_agro_auth_token';
const FETCH_TIMEOUT_MS = 20000; // 20 seconds

/** Wraps fetch with a timeout and network error handling */
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Tempo limite excedido. O servidor demorou muito para responder. Tente novamente.');
    }
    throw new Error('Erro de rede. Verifique sua conexão e tente novamente.');
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Parses a response as JSON, handles non-JSON responses gracefully */
async function parseJsonResponse(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`Erro do servidor (${res.status}): ${text.substring(0, 200)}`);
    }
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const getToken = useCallback(async (): Promise<string | null> => {
    return token || localStorage.getItem(TOKEN_KEY);
  }, [token]);

  const authFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const currentToken = await getToken();
    const initHeaders = new Headers(init?.headers || {});
    if (currentToken && !initHeaders.has('Authorization')) {
      initHeaders.set('Authorization', `Bearer ${currentToken}`);
    }

    const response = await fetchWithTimeout(input.toString(), { ...init, headers: initHeaders });

    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setBusiness(null);
    }

    return response;
  }, [getToken]);

  const loadUserSession = useCallback(async (authToken: string) => {
    try {
      const res = await fetchWithTimeout('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await parseJsonResponse(res);
      if (res.ok && data) {
        setUser(data.user);
        setBusiness(normalizeBusiness(data.business));
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setBusiness(null);
      }
    } catch (e) {
      console.error('Failed to load user session:', e);
      // Don't log out on network errors — let the user see the app and retry
    }
  }, []);

  const refreshBusiness = async () => {
    const currentToken = await getToken();
    if (currentToken) {
      await loadUserSession(currentToken);
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      loadUserSession(storedToken).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loadUserSession]);

  const signIn = async (email: string, password: string) => {
    const res = await fetchWithTimeout('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await parseJsonResponse(res);

    if (!res.ok) {
      throw new Error(data?.error || `Erro ${res.status}: falha ao realizar login.`);
    }

    if (!data?.token) {
      throw new Error('Resposta inválida do servidor. Tente novamente.');
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    setBusiness(normalizeBusiness(data.business));
  };

  const signUp = async (name: string, email: string, password: string) => {
    const res = await fetchWithTimeout('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await parseJsonResponse(res);

    if (!res.ok) {
      throw new Error(data?.error || `Erro ${res.status}: falha ao criar conta.`);
    }

    if (!data?.token) {
      throw new Error('Resposta inválida do servidor. Tente novamente.');
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    setBusiness(normalizeBusiness(data.business));
  };

  const signOut = async () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setBusiness(null);
  };

  return (
    <AuthContext.Provider value={{ user, business, loading, signIn, signUp, signOut, token, getToken, authFetch, refreshBusiness }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
