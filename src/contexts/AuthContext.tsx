import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { shouldEndSession } from '../lib/session';

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
  /**
   * Sign out when a failed request turns out to be a dead session.
   * Resolves true when it did, meaning the caller should stop.
   */
  signOutIfSessionLost: (error: unknown) => Promise<boolean>;
  refreshPermissions: () => Promise<void>;
  hasMenuAccess: (menuName: string) => boolean;
  hasEntityAccess: (entityId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuAccess, setMenuAccess] = useState<string[]>([]);
  const [entityAccess, setEntityAccess] = useState<string[]>([]);

  const isAdmin = appUser?.role === 'admin';

  useEffect(() => {
    const hardTimeout = setTimeout(() => setLoading(false), 4000);
    checkUser().finally(() => clearTimeout(hardTimeout));

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadAppUser(session.user.id, session.user.email);
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
        void loadAppUser(session.user.id, session.user.email);
      }
    } catch (error) {
      console.error('Error checking user session:', error);
      setLoading(false);
    }
  }

  async function loadAppUser(userId: string, userEmail?: string) {
    try {
      const { data: appUserData, error: appUserError } = await withTimeout(
        supabase.from('app_users').select('*').eq('id', userId).maybeSingle(),
        5000,
        'loadAppUser'
      );
      if (appUserError) throw appUserError;

      if (appUserData) {
        // A deactivated account keeps no session. The database enforces this
        // too; this only makes the app stop showing a shell it cannot use.
        if (appUserData.is_active === false) {
          await supabase.auth.signOut();
          setUser(null);
          setAppUser(null);
          setMenuAccess([]);
          setEntityAccess([]);
          return;
        }
        setAppUser(appUserData as AppUser);
        void loadPermissions(userId, appUserData.role);
        return;
      }
      setAppUser({
        id: userId,
        email: userEmail ?? '',
        full_name: null,
        role: 'user',
        is_active: false,
      });
    } catch (error) {
      console.error('Error loading app user:', error);
      setAppUser({
        id: userId,
        email: userEmail ?? '',
        full_name: null,
        role: 'user',
        is_active: false,
      });
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

  /** Clear the session locally whatever the server says about it. */
  async function clearSession() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Already gone server-side, which is the case we are handling. Dropping
      // the local state is the part that has to happen either way.
    }
    setUser(null);
    setAppUser(null);
    setMenuAccess([]);
    setEntityAccess([]);
  }

  /**
   * Decide whether a refused request means the session is gone, and if so, end it.
   *
   * A token expiring is not announced. supabase-js refreshes in the background,
   * and when the refresh token is itself dead nothing tells the page — React goes
   * on holding the user and permissions it loaded while the token was good. Reads
   * already returned and their results are still on screen, so everything looks
   * signed in until a write reaches Postgres, where `auth.uid()` is null and the
   * row-level policy refuses it. That is the 42501 users were shown.
   *
   * The session is checked rather than assumed, because **42501 is also what a
   * genuine permission denial looks like**. Signing someone out for lacking a
   * permission would be its own defect, and a worse one: it would look like the
   * app logging people out at random. So a live session means the denial was
   * real, the user stays signed in, and they get the permission message instead.
   */
  async function signOutIfSessionLost(error: unknown): Promise<boolean> {
    // shouldEndSession screens the error shape too, so there is one rule rather
    // than half of it here and half of it there.
    const { data } = await supabase.auth.getSession();
    if (!shouldEndSession(error, data.session, Date.now())) return false;

    await clearSession();
    return true;
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
    signOutIfSessionLost,
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
