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
  isSuperAdmin: boolean;
  isManager: boolean;
  isTeacher: boolean;
  canManageModule: (module: string) => boolean;
  isSuppliesManager: boolean;
  isChemicalsManager: boolean;
  isDutyManager: boolean;
  isReimbursementApprover: boolean;
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
  } catch (err) {
    console.error('Profile fetch exception:', err);
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
    // ignore
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          initDone.current = true;
          return;
        }

        // We have a user session
        setUser(session.user);

        // Fetch profile outside of callback to avoid Supabase deadlock
        // See: https://github.com/supabase/supabase/issues/41968
        const userId = session.user.id;
        setTimeout(async () => {
          let p = await fetchProfile(userId);
          if (!p) {
            await new Promise(r => setTimeout(r, 1000));
            p = await fetchProfile(userId);
          }

          if (p) {
            setProfile(p);
          } else {
            console.warn('Profile not found, user will have limited access');
          }

          setLoading(false);
          initDone.current = true;
        }, 0);
      },
    );

    // Trigger initial session check
    supabase.auth.getSession().catch((err) => {
      console.error('getSession error:', err);
      setLoading(false);
      initDone.current = true;
    });

    // Safety timeout - 10 seconds
    const safetyTimer = setTimeout(() => {
      if (!initDone.current) {
        console.warn('Auth safety timeout - stopping loading');
        setLoading(false);
        initDone.current = true;
      }
    }, 10000);

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
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
  const isSuperAdmin = profile?.role === 'super_admin';
  const isManager = profile?.role === 'manager';
  const isTeacher = profile?.role === 'teacher' || profile?.role === 'manager' || profile?.role === 'admin' || profile?.role === 'super_admin';

  const canManageModule = (module: string): boolean => {
    if (isSuperAdmin) return true; // 只有超级管理员自动拥有所有模块权限
    return profile?.managed_modules?.includes(module) ?? false;
  };

  const isSuppliesManager = canManageModule('supplies');
  const isChemicalsManager = canManageModule('chemicals');
  const isDutyManager = canManageModule('duty');
  // 报销审批：李健楠（admin角色）+ 大导（super_admin）
  // 报销审批：超级管理员 + 有 reimbursements 模块权限的人（李健楠）
  const isReimbursementApprover = isSuperAdmin || (profile?.managed_modules?.includes('reimbursements') ?? false);

  return (
    <AuthContext.Provider
      value={{
        user, profile, loading, signIn, signOut,
        isAdmin, isSuperAdmin, isManager, isTeacher,
        canManageModule, isSuppliesManager, isChemicalsManager, isDutyManager, isReimbursementApprover,
      }}
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
