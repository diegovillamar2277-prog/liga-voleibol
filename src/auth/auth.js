// ============================================================
//  auth.js — Autenticación y sesión
// ============================================================
import { sb } from '../lib/supabase.js';

// ── Estado global de sesión ──────────────────────────────────
export let currentUser  = null;   // auth.users de Supabase
export let currentProfile = null; // public.profiles (rol, nombre, etc.)

// ── Inicializar: leer sesión guardada ───────────────────────
export async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await loadProfile(session.user.id);
  }
  // Escuchar cambios de sesión
  sb.auth.onAuthStateChange(async (event, session) => {
    currentUser   = session?.user ?? null;
    currentProfile = null;
    if (currentUser) await loadProfile(currentUser.id);
    document.dispatchEvent(new CustomEvent('auth-change', { detail: { event, user: currentUser, profile: currentProfile } }));
  });
}

async function loadProfile(uid) {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();
  if (!error) currentProfile = data;
}

// ── Login ────────────────────────────────────────────────────
export async function login(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(traducirError(error.message));
  return data;
}

// ── Registro de organizador ──────────────────────────────────
export async function register(email, password, nombre) {
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { nombre } }
  });
  if (error) throw new Error(traducirError(error.message));
  return data;
}

// ── Logout ──────────────────────────────────────────────────
export async function logout() {
  try {
    await sb.auth.signOut();
  } catch (_) {
    // Ignorar errores de logout (ej: token expirado → 403)
    // El estado local se limpia igual via onAuthStateChange
  }
  // Limpiar estado local por si onAuthStateChange no se dispara
  currentUser    = null;
  currentProfile = null;
  document.dispatchEvent(new CustomEvent('auth-change', {
    detail: { event: 'SIGNED_OUT', user: null, profile: null }
  }));
}

// ── Helpers de rol ──────────────────────────────────────────
export function isSuperAdmin() { return currentProfile?.role === 'superadmin'; }
export function isAdmin()      { return ['superadmin','admin'].includes(currentProfile?.role); }
export function isOrganizador(){ return currentProfile?.role === 'organizador'; }
export function isLoggedIn()   { return !!currentUser; }

// ── Cambiar contraseña ──────────────────────────────────────
export async function changePassword(newPassword) {
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw new Error(traducirError(error.message));
}

// ── Errores en español ───────────────────────────────────────
function traducirError(msg) {
  if (msg.includes('Invalid login'))    return 'Correo o contraseña incorrectos';
  if (msg.includes('Email not confirmed')) return 'Confirma tu correo primero';
  if (msg.includes('already registered')) return 'Este correo ya está registrado';
  if (msg.includes('Password should'))  return 'La contraseña debe tener al menos 6 caracteres';
  if (msg.includes('rate limit'))       return 'Demasiados intentos. Espera un momento';
  return msg;
}
