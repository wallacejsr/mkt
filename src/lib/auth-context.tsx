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

    const response = await fetch(input, { ...init, headers: initHeaders });

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
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setBusiness(data.business);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setBusiness(null);
      }
    } catch (e) {
      console.error("Failed to load user session:", e);
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
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao realizar login.');
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    setBusiness(data.business);
  };

  const signUp = async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao criar conta.');
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    setBusiness(data.business);
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
