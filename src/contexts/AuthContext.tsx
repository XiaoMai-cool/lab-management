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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          const p = await fetchProfile(session.user.id);
          setProfile(p);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const p = await fetchProfile(currentUser.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
