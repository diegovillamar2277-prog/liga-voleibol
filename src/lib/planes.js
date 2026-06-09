// ============================================================
//  planes.js — Fuente única de verdad para los planes
//
//  ESTRUCTURA DE PLANES:
//
//  BASICO (gratis)
//    - 1 liga
//    - Tabla, fixture, partidos, equipos
//    - Sin vista pública (espectadores no pueden ver)
//    - Sin playoffs, sin finanzas, sin alias, sin co-admins
//    - Add-on vista pública: $100 MXN único ó $70 MXN/temporada
//
//  MEDIO ($99/mes · $450/6 meses)
//    - 2 ligas simultáneas
//    - Todo lo anterior + vista pública incluida + playoffs + finanzas
//    - Sin co-admins, sin alias, sin diseño personalizado
//    - Comentarios deshabilitados
//
//  TOP ($149/mes · $650/6 meses)
//    - 3 ligas simultáneas
//    - Todo desbloqueado: playoffs, finanzas, co-admins, alias,
//      diseño personalizado de vista pública
//    - Comentarios habilitados
// ============================================================

export const PLANES = {
  basico: {
    id:           'basico',
    nombre:       'Básico',
    emoji:        '🆓',
    maxLigas:     1,
    maxEquipos:   8,
    vistaPublica: false,   // requiere add-on
    playoffs:     false,
    finanzas:     false,
    alias:        false,
    coAdmins:     false,
    comentarios:  false,
    disenoPublico: false,
    precios: {
      mensual:    0,
      temporada:  0,
    },
    // Add-on vista pública (solo para plan basico)
    addonVistaPublica: {
      unico:      100,   // MXN, pago único para siempre
      temporada:  70,    // MXN, por temporada (6 meses)
    },
  },

  medio: {
    id:           'medio',
    nombre:       'Medio',
    emoji:        '⚡',
    maxLigas:     2,
    maxEquipos:   Infinity,
    vistaPublica: true,
    playoffs:     true,
    finanzas:     true,
    alias:        false,
    coAdmins:     false,
    comentarios:  false,
    disenoPublico: false,
    precios: {
      mensual:    99,
      temporada:  450,
    },
  },

  top: {
    id:           'top',
    nombre:       'Top',
    emoji:        '🏆',
    maxLigas:     3,
    maxEquipos:   Infinity,
    vistaPublica: true,
    playoffs:     true,
    finanzas:     true,
    alias:        true,
    coAdmins:     true,
    comentarios:  true,
    disenoPublico: true,
    precios: {
      mensual:    149,
      temporada:  650,
    },
  },
};

// ── Alias de compatibilidad (el código que usa isPro/plan = 'pro' sigue funcionando) ──
// "pro" ahora apunta al plan "top" para retro-compatibilidad con el webhook existente
export const PLAN_PRO_LEGACY = 'top';

// ── Obtener el objeto de plan dado un profile ─────────────────────────────
export function getPlan(profile) {
  if (!profile) return PLANES.basico;

  const planId = profile.plan;

  // retro-compatibilidad: plan = 'pro' (anterior) → top
  if (planId === 'pro') {
    if (!profile.plan_expira) return PLANES.top;
    if (new Date(profile.plan_expira) > new Date()) return PLANES.top;
    return PLANES.basico;
  }

  if (planId === 'medio' || planId === 'top') {
    if (!profile.plan_expira) return PLANES[planId];
    if (new Date(profile.plan_expira) > new Date()) return PLANES[planId];
    return PLANES.basico;
  }

  // plan = 'basico' o cualquier otro valor desconocido
  return PLANES.basico;
}

// ── Checks de conveniencia ────────────────────────────────────────────────
export function getPlanId(profile) {
  return getPlan(profile).id;
}

export function esPlanBasico(profile) {
  return getPlan(profile).id === 'basico';
}

export function esPlanMedio(profile) {
  return getPlan(profile).id === 'medio';
}

export function esPlanTop(profile) {
  return getPlan(profile).id === 'top';
}

// Retro-compatibilidad: isPro = medio o top
export function isPro(profile) {
  const id = getPlan(profile).id;
  return id === 'medio' || id === 'top';
}

// ── Verificar si un feature está disponible ───────────────────────────────
export function tieneFeature(profile, feature) {
  const plan = getPlan(profile);
  return !!plan[feature];
}

// ── Vista pública: considera plan + add-on ────────────────────────────────
export function tieneVistaPublica(profile) {
  const plan = getPlan(profile);
  if (plan.vistaPublica) return true;
  // Verificar add-on
  return !!(profile?.addon_vista_publica);
}

// ── Días restantes del plan ───────────────────────────────────────────────
export function diasRestantes(profile) {
  if (!profile?.plan_expira) return null;
  const diff = new Date(profile.plan_expira) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ── Máximo de ligas para el plan actual ──────────────────────────────────
export function maxLigas(profile) {
  return getPlan(profile).maxLigas;
}
