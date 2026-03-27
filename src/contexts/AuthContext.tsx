import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to fetch profile:', error.message);
    return null;
  }

  return data as Profile;
}

// Force clear all auth data from browser
function forceCleanup() {
  // Clear Supabase auth keys from localStorage
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('supabase') || key.includes('sb-'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
  sessionStorage.clear();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Auto-clear stale sessions: if URL has ?reset or session is broken
    if (window.location.search.includes('reset')) {
      forceCleanup();
      supabase.auth.signOut().catch(() => {});
      window.location.href = '/login';
      return;
    }

    async function init() {
      try {
        // Race: getSession vs 8s timeout
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 8000)
          ),
        ]);

        if (cancelled) return;

        const { data: { session } } = sessionResult;

        if (session?.user) {
          const p = await fetchProfile(session.user.id);
          if (cancelled) return;

          if (p) {
            setUser(session.user);
            setProfile(p);
          } else {
            // Profile not found, sign out
            await supabase.auth.signOut().catch(() => {});
            forceCleanup();
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
        if (!cancelled) {
          // Timeout or other error: clear everything and go to login
          await supabase.auth.signOut().catch(() => {});
          forceCleanup();
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // SIGNED_IN or TOKEN_REFRESHED
        const p = await fetchProfile(session.user.id);
        if (cancelled) return;

        if (p) {
          setUser(session.user);
          setProfile(p);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // If signOut fails, force cleanup
    }
    forceCleanup();
    setUser(null);
    setProfile(null);
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
