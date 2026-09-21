import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { shouldEndSession } from '../lib/session';
import {
  canReachEntity,
  canReachMenu,
  loadIdentity,
  type AppUser,
  type Identity,
} from '../services/permissions.service';

export type { AppUser };

/**
 * How far the account load got.
 *
 * `unavailable` is the one that matters. It used to be folded into "signed in as
 * a user with no permissions", which is a claim about the person rather than
 * about the request, and it is why an admin could be shown Access Denied on
 * every page with their own email in the menu.
 */
export type AuthStatus = 'loading' | 'ready' | 'not-provisioned' | 'unavailable';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  menuAccess: string[];
  entityAccess: string[];
  isAdmin: boolean;
  /** How the account load ended. See `AuthStatus`. */
  status: AuthStatus;
  /** Why the account could not be read, when `status` is `unavailable`. */
  statusReason: string | null;
  /** Try the account load again, for the retry a failed load offers. */
  retryIdentity: () => Promise<void>;
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
  /*
    One object, replaced as a whole.

    The account and its grants used to be three independent pieces of state set
    at three different moments, so there were renders where the app knew who
    somebody was and had not yet heard what they could reach. Every guard read
    that as a denial. Holding them together means there is no such moment: either
    the identity is there in full, or it is null.
  */
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [statusReason, setStatusReason] = useState<string | null>(null);

  // Read inside the auth listener, which is registered once and would otherwise
  // close over the identity as it was at mount.
  const identityRef = useRef<Identity | null>(null);
  useEffect(() => { identityRef.current = identity; }, [identity]);

  const appUser = identity?.appUser ?? null;
  const menuAccess = identity?.menuAccess ?? [];
  const entityAccess = identity?.entityAccess ?? [];
  const isAdmin = appUser?.role === 'admin';
  const loading = status === 'loading';

  /*
    Apply a verdict from the service.

    Every branch either installs a complete identity or clears it. Nothing here
    fabricates an account: the case this whole rewrite exists for --
    `unavailable` -- leaves `identity` null and says so, rather than answering
    "a user with no permissions" to a question that was never answered.
  */
  const applyResult = useCallback(async (result: Awaited<ReturnType<typeof loadIdentity>>) => {
    if (result.status === 'ok') {
      setIdentity(result.identity);
      setStatusReason(null);
      setStatus('ready');
      return;
    }
    if (result.status === 'deactivated') {
      // The database enforces this too; this only stops the app showing a shell
      // it cannot use.
      await supabase.auth.signOut().catch(() => {});
      setUser(null);
      setIdentity(null);
      setStatusReason(null);
      setStatus('ready');
      return;
    }
    setIdentity(null);
    setStatusReason(result.status === 'unavailable' ? result.reason : null);
    setStatus(result.status === 'unavailable' ? 'unavailable' : 'not-provisioned');
  }, []);

  const loadFor = useCallback(async (userId: string) => {
    setStatus('loading');
    await applyResult(await loadIdentity(userId));
  }, [applyResult]);

  const retryIdentity = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user?.id;
    if (!id) {
      setUser(null);
      setIdentity(null);
      setStatus('ready');
      return;
    }
    await loadFor(id);
  }, [loadFor]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadFor(session.user.id);
        } else {
          setIdentity(null);
          setStatus('ready');
        }
      } catch (error) {
        if (cancelled) return;
        // Could not even ask whether there is a session. Not a denial either.
        setStatusReason(error instanceof Error ? error.message : String(error));
        setStatus('unavailable');
      }
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (cancelled) return;
        setUser(session?.user ?? null);
        if (!session?.user) {
          setIdentity(null);
          setStatusReason(null);
          setStatus('ready');
          return;
        }
        /*
          A token refresh fires this with the same account already loaded, and a
          tab waking from sleep fires it with the network not yet back. Reloading
          from scratch there is what used to demote a working session: the read
          failed and the catch invented a plain user.

          The identity we already hold is still correct -- the refresh proves the
          session, it does not change who anyone is -- so a background reload is
          only worth doing when we have nothing, or when the account changed.
        */
        const sameAccount = identityRef.current?.appUser.id === session.user.id;
        if (sameAccount && event === 'TOKEN_REFRESHED') return;
        await loadFor(session.user.id);
      })();
    });

    return () => {
      cancelled = true;
      authListener?.subscription.unsubscribe();
    };
  }, [loadFor]);

  const refreshPermissions = useCallback(async () => {
    if (identity) await loadFor(identity.appUser.id);
  }, [identity, loadFor]);

  /*
    Both answer `false` only when an identity is loaded and genuinely lacks the
    grant. With no identity there is nothing to ask, and the callers must not be
    handed a denial they would render as one -- App decides what to show for
    `loading`, `unavailable` and `not-provisioned` before it ever asks these.
  */
  const hasMenuAccess = useCallback(
    (menuName: string) => (identity ? canReachMenu(identity, menuName) : false),
    [identity],
  );

  const hasEntityAccess = useCallback(
    (entityId: string) => (identity ? canReachEntity(identity, entityId) : false),
    [identity],
  );

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
    setIdentity(null);
    setStatusReason(null);
    setStatus('ready');
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
    setIdentity(null);
    setStatusReason(null);
    setStatus('ready');
  }

  const value = {
    user,
    appUser,
    loading,
    menuAccess,
    entityAccess,
    isAdmin,
    status,
    statusReason,
    retryIdentity,
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
