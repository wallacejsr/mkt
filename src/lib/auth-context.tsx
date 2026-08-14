import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onIdTokenChanged, signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from './firebase.ts';

export interface Business {
  id: string;
  name: string;
  onboardingCompleted: boolean;
}

interface AuthContextType {
  user: User | null;
  business: Business | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  token: string | null;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  refreshBusiness: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const getToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      const freshToken = await auth.currentUser.getIdToken(forceRefresh);
      setToken(freshToken);
      return freshToken;
    } catch (e) {
      console.error("Error getting ID token:", e);
      return null;
    }
  }, []);

  const fetchSync = useCallback(async (idToken: string) => {
    try {
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` }
      });
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setBusiness(data.business);
      }
    } catch (e) {
      console.error("Failed to sync user", e);
    }
  }, []);

  const authFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let currentToken = await getToken();
    const initHeaders = new Headers(init?.headers || {});
    if (currentToken && !initHeaders.has('Authorization')) {
      initHeaders.set('Authorization', `Bearer ${currentToken}`);
    }

    let response = await fetch(input, { ...init, headers: initHeaders });

    if (response.status === 401 && auth.currentUser) {
      const freshToken = await getToken(true);
      if (freshToken) {
        initHeaders.set('Authorization', `Bearer ${freshToken}`);
        response = await fetch(input, { ...init, headers: initHeaders });
      }
    }

    return response;
  }, [getToken]);

  const refreshBusiness = async () => {
    const currentToken = await getToken();
    if (currentToken) {
      await fetchSync(currentToken);
    }
  };

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);
          await fetchSync(idToken);
        } catch (e) {
          console.error("Failed to get ID token on auth state change", e);
        }
      } else {
        setToken(null);
        setBusiness(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchSync]);

  const signIn = async () => {
    await signInWithPopup(auth, googleAuthProvider);
  };

  const signOut = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, business, loading, signIn, signOut, token, getToken, authFetch, refreshBusiness }}>
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
