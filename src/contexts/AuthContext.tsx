import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'super_admin' | 'admin' | 'manager';
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasMenuAccess: (menuName: string) => boolean;
  canAccessEntity: (entityId: string) => boolean;
  accessibleEntityIds: string[];
  accessibleMenus: string[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessibleEntityIds, setAccessibleEntityIds] = useState<string[]>([]);
  const [accessibleMenus, setAccessibleMenus] = useState<string[]>([]);

  useEffect(() => {
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadAppUser(session.user.id);
        } else {
          setAppUser(null);
          setAccessibleEntityIds([]);
          setAccessibleMenus([]);
        }
      })();
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadAppUser(session.user.id);
      }
    } catch (error) {
      console.error('Error checking user session:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAppUser(userId: string) {
    try {
      const { data: appUserData, error: appUserError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (appUserError) throw appUserError;

      if (appUserData) {
        setAppUser(appUserData);
        await loadUserPermissions(userId, appUserData.role);
      }
    } catch (error) {
      console.error('Error loading app user:', error);
    }
  }

  async function loadUserPermissions(userId: string, role: string) {
    try {
      if (role === 'super_admin') {
        const { data: allEntities } = await supabase
          .from('entities')
          .select('id');

        const { data: allMenus } = await supabase
          .from('menu_items')
          .select('name')
          .eq('is_active', true);

        setAccessibleEntityIds(allEntities?.map(e => e.id) || []);
        setAccessibleMenus(allMenus?.map(m => m.name) || []);
      } else if (role === 'admin') {
        const { data: entityAccess } = await supabase
          .from('user_entity_access')
          .select('entity_id')
          .eq('user_id', userId)
          .eq('can_view', true);

        const { data: allMenus } = await supabase
          .from('menu_items')
          .select('name')
          .eq('is_active', true);

        setAccessibleEntityIds(entityAccess?.map(e => e.entity_id) || []);
        setAccessibleMenus(allMenus?.map(m => m.name) || []);
      } else {
        const { data: entityAccess } = await supabase
          .from('user_entity_access')
          .select('entity_id')
          .eq('user_id', userId)
          .eq('can_view', true);

        const { data: menuAccess } = await supabase
          .from('user_menu_access')
          .select('menu_items(name)')
          .eq('user_id', userId);

        setAccessibleEntityIds(entityAccess?.map(e => e.entity_id) || []);
        setAccessibleMenus(menuAccess?.map((m: any) => m.menu_items?.name).filter(Boolean) || []);
      }
    } catch (error) {
      console.error('Error loading user permissions:', error);
    }
  }

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
    setAccessibleEntityIds([]);
    setAccessibleMenus([]);
  }

  function hasMenuAccess(menuName: string): boolean {
    if (!appUser) return false;
    if (appUser.role === 'super_admin') return true;
    if (appUser.role === 'admin') return true;
    return accessibleMenus.includes(menuName);
  }

  function canAccessEntity(entityId: string): boolean {
    if (!appUser) return false;
    if (appUser.role === 'super_admin') return true;
    return accessibleEntityIds.includes(entityId);
  }

  const value = {
    user,
    appUser,
    loading,
    signIn,
    signOut,
    hasMenuAccess,
    canAccessEntity,
    accessibleEntityIds,
    accessibleMenus,
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
