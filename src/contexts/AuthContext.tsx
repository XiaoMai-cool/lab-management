import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  canManageModule: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Profile fetch error:', error.message);
      return null;
    }
    return data as Profile;
  } catch {
    return null;
  }
}

function clearAuthStorage() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('sb-'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage might not be available
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initDone = useRef(false);

  // Handle ?reset parameter
  useEffect(() => {
    if (window.location.search.includes('reset')) {
      clearAuthStorage();
      supabase.auth.signOut().catch(() => {});
      window.location.replace('/login');
    }
  }, []);

  useEffect(() => {
    // Only listen to auth state changes - this is the single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);

        if (!session?.user) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          initDone.current = true;
          return;
        }

        // We have a session - fetch profile
        setUser(session.user);
        const p = await fetchProfile(session.user.id);

        if (p) {
          setProfile(p);
        } else {
          // Session exists but no profile - broken state
          console.warn('No profile found, clearing session');
          setUser(null);
          setProfile(null);
          clearAuthStorage();
          supabase.auth.signOut().catch(() => {});
        }

        setLoading(false);
        initDone.current = true;
      },
    );

    // Trigger initial session check
    // This will fire onAuthStateChange with INITIAL_SESSION event
    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        console.error('getSession error:', error);
        clearAuthStorage();
        setLoading(false);
        initDone.current = true;
      }
    }).catch(() => {
      clearAuthStorage();
      setLoading(false);
      initDone.current = true;
    });

    // Safety: if nothing happens in 6 seconds, stop loading
    const safetyTimer = setTimeout(() => {
      if (!initDone.current) {
        console.warn('Auth safety timeout');
        clearAuthStorage();
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    }, 6000);

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // onAuthStateChange will handle the rest
  };

  const signOut = async () => {
    setUser(null);
    setProfile(null);
    clearAuthStorage();
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  };

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';
  const isManager = profile?.role === 'manager';

  const canManageModule = (module: string): boolean => {
    if (isAdmin) return true;
    return profile?.managed_modules?.includes(module) ?? false;
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signOut, isAdmin, isManager, canManageModule }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
