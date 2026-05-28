import { createContext, useContext, useEffect, useState } from 'react';
import { sb } from '../lib/supabase.js';

// ── Error translation (Spanish messages) ────────────────────
function traducirError(msg) {
  if (msg.includes('Invalid login'))       return 'Correo o contraseña incorrectos';
  if (msg.includes('Email not confirmed')) return 'Confirma tu correo primero';
  if (msg.includes('already registered')) return 'Este correo ya está registrado';
  if (msg.includes('Password should'))    return 'La contraseña debe tener al menos 6 caracteres';
  if (msg.includes('rate limit'))         return 'Demasiados intentos. Espera un momento';
  return msg;
}

// ── Profile loader ───────────────────────────────────────────
async function fetchProfile(uid) {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();
  if (error) return null;
  return data;
}

// ── Context ──────────────────────────────────────────────────
export const AuthContext = createContext(null);

// ── Provider ─────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]       = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    let subscription;

    // Restore existing session on mount
    (async () => {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (session?.user) {
          setCurrentUser(session.user);
          const profile = await fetchProfile(session.user.id);
          setCurrentProfile(profile);
        }
      } catch {
        // getSession() threw — treat as unauthenticated
        setCurrentUser(null);
        setCurrentProfile(null);
      } finally {
        setLoading(false);
      }
    })();

    // Subscribe to auth state changes
    const { data } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setCurrentUser(session.user);
        const profile = await fetchProfile(session.user.id);
        setCurrentProfile(profile);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setCurrentProfile(null);
        localStorage.removeItem('ligaActualId');
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setCurrentUser(session.user);
      }
    });
    subscription = data.subscription;

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // ── Auth actions ─────────────────────────────────────────
  async function login(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(traducirError(error.message));
  }

  async function logout() {
    await sb.auth.signOut();
  }

  async function register(email, password, nombre) {
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { nombre } },
    });
    if (error) throw new Error(traducirError(error.message));
  }

  // ── Derived state ────────────────────────────────────────
  const isLoggedIn   = !!currentUser;
  const isAdmin      = ['superadmin', 'admin'].includes(currentProfile?.role);
  const isSuperAdmin = currentProfile?.role === 'superadmin';

  const value = {
    currentUser,
    currentProfile,
    isLoggedIn,
    isAdmin,
    isSuperAdmin,
    loading,
    login,
    logout,
    register,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Convenience hook ─────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
