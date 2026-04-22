import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  menuAccess: string[];
  entityAccess: string[];
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  hasMenuAccess: (menuName: string) => boolean;
  hasEntityAccess: (entityId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuAccess, setMenuAccess] = useState<string[]>([]);
  const [entityAccess, setEntityAccess] = useState<string[]>([]);

  const isAdmin = appUser?.role === 'admin';

  useEffect(() => {
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadAppUser(session.user.id);
        } else {
          setAppUser(null);
          setMenuAccess([]);
          setEntityAccess([]);
        }
      })();
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      Promise.resolve(p),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ]);
  }

  async function checkUser() {
    try {
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        3000,
        'getSession'
      );
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        void loadAppUser(session.user.id);
      }
    } catch (error) {
      console.error('Error checking user session:', error);
      setLoading(false);
    }
  }

  async function loadAppUser(userId: string) {
    try {
      const { data: appUserData, error: appUserError } = await withTimeout(
        supabase.from('app_users').select('*').eq('id', userId).maybeSingle(),
        5000,
        'loadAppUser'
      );
      if (appUserError) throw appUserError;

      if (appUserData) {
        setAppUser(appUserData as AppUser);
        void loadPermissions(userId, appUserData.role);
      }
    } catch (error) {
      console.error('Error loading app user:', error);
    }
  }

  async function loadPermissions(userId: string, role: string) {
    try {
      if (role === 'admin') {
        setMenuAccess([]);
        setEntityAccess([]);
        return;
      }

      const [menuResult, entityResult] = await Promise.all([
        supabase
          .from('user_menu_access')
          .select('menu_item_id, menu_items(menu_name)')
          .eq('user_id', userId),
        supabase
          .from('user_entity_access')
          .select('entity_id')
          .eq('user_id', userId),
      ]);

      if (menuResult.data) {
        const menuNames = menuResult.data
          .map((r: any) => r.menu_items?.menu_name)
          .filter(Boolean);
        setMenuAccess(menuNames);
      }

      if (entityResult.data) {
        const entityIds = entityResult.data.map((r: any) => r.entity_id);
        setEntityAccess(entityIds);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  }

  const refreshPermissions = useCallback(async () => {
    if (appUser) {
      await loadPermissions(appUser.id, appUser.role);
    }
  }, [appUser]);

  const hasMenuAccess = useCallback((menuName: string) => {
    if (isAdmin) return true;
    if (menuName === 'settings') return true;
    return menuAccess.includes(menuName);
  }, [isAdmin, menuAccess]);

  const hasEntityAccess = useCallback((entityId: string) => {
    if (isAdmin) return true;
    return entityAccess.includes(entityId);
  }, [isAdmin, entityAccess]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    setUser(null);
    setAppUser(null);
    setMenuAccess([]);
    setEntityAccess([]);
  }

  const value = {
    user,
    appUser,
    loading,
    menuAccess,
    entityAccess,
    isAdmin,
    signIn,
    signOut,
    refreshPermissions,
    hasMenuAccess,
    hasEntityAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
