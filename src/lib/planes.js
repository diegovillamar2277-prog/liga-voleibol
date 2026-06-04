// ============================================================
//  planes.js — Lógica de planes free/pro
// ============================================================

export const PLANES = {
  free: {
    nombre:     'Gratuito',
    maxLigas:   1,
    maxEquipos: 8,
    playoffs:   false,
    finanzas:   false,
    alias:      false,
    coAdmins:   false,
  },
  pro: {
    nombre:     'Pro',
    maxLigas:   Infinity,
    maxEquipos: Infinity,
    playoffs:   true,
    finanzas:   true,
    alias:      true,
    coAdmins:   true,
  }
};

export function getPlan(profile) {
  if (!profile) return PLANES.free;
  if (profile.plan === 'pro') {
    if (!profile.plan_expira) return PLANES.pro;
    if (new Date(profile.plan_expira) > new Date()) return PLANES.pro;
  }
  return PLANES.free;
}

export function isPro(profile) {
  return getPlan(profile) === PLANES.pro;
}

export function diasRestantes(profile) {
  if (!profile?.plan_expira) return null;
  const diff = new Date(profile.plan_expira) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}