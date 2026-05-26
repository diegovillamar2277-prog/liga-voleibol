// ============================================================
//  db.js — Capa de acceso a datos (Supabase)
// ============================================================
import { sb } from '../lib/supabase.js';
import { currentProfile } from '../auth/auth.js';

// ════════════════════════════════════════════════════════════
//  LIGAS
// ════════════════════════════════════════════════════════════

export async function getLigaByCodigo(codigo) {
  const { data, error } = await sb
    .from('leagues')
    .select('*')
    .eq('codigo', codigo.toUpperCase())
    .eq('activa', true)
    .single();
  if (error) throw new Error('Liga no encontrada');
  return data;
}

export async function getLigaById(id) {
  const { data, error } = await sb
    .from('leagues')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error('Liga no encontrada');
  return data;
}

export async function getMisLigas(userId) {
  const { data, error } = await sb
    .from('league_members')
    .select('role, leagues(*)')
    .eq('user_id', userId);
  if (error) return [];
  return data.map(r => ({ ...r.leagues, miRol: r.role }));
}

export async function getTodasLigas() {
  const { data, error } = await sb
    .from('leagues')
    .select('*, profiles!leagues_owner_id_fkey(email, nombre)')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

export async function crearLiga({ nombre, temporada, ownerId, config, reglas, playoffsCfg }) {
  // Generar código único
  const { data: codigoData } = await sb.rpc('generar_codigo_liga');
  const codigo = codigoData;

  const { data: liga, error } = await sb
    .from('leagues')
    .insert({
      nombre,
      temporada: temporada || '',
      codigo,
      owner_id: ownerId,
      config:       config       || {},
      reglas:       reglas       || [],
      playoffs_cfg: playoffsCfg  || {},
    })
    .select()
    .single();
  if (error) throw new Error('Error al crear liga: ' + error.message);

  // Agregar al owner como miembro
  await sb.from('league_members').insert({
    league_id: liga.id,
    user_id:   ownerId,
    role:      'owner'
  });

  return liga;
}

export async function actualizarLiga(id, campos) {
  const { error } = await sb
    .from('leagues')
    .update({ ...campos })
    .eq('id', id);
  if (error) throw new Error('Error al actualizar liga: ' + error.message);
}

export async function renovarCodigo(ligaId) {
  const { data: codigoData } = await sb.rpc('generar_codigo_liga');
  await actualizarLiga(ligaId, { codigo: codigoData });
  return codigoData;
}

export async function contarLigasDeUsuario(userId) {
  const { count } = await sb
    .from('league_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'owner');
  return count || 0;
}

// ════════════════════════════════════════════════════════════
//  MIEMBROS DE LIGA
// ════════════════════════════════════════════════════════════

export async function getMiembros(ligaId) {
  const { data, error } = await sb
    .from('league_members')
    .select('*, profiles(id, email, nombre, role)')
    .eq('league_id', ligaId);
  if (error) return [];
  return data;
}

export async function invitarCoAdmin(ligaId, email) {
  // Buscar perfil por email
  const { data: perfil, error: pErr } = await sb
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();
  if (pErr || !perfil) throw new Error('No existe un usuario con ese correo');

  const { error } = await sb.from('league_members').insert({
    league_id: ligaId,
    user_id:   perfil.id,
    role:      'co-admin'
  });
  if (error) {
    if (error.code === '23505') throw new Error('Ese usuario ya es miembro de la liga');
    throw new Error('Error al invitar: ' + error.message);
  }
}

export async function quitarMiembro(ligaId, userId) {
  await sb.from('league_members')
    .delete()
    .eq('league_id', ligaId)
    .eq('user_id', userId);
}

// ════════════════════════════════════════════════════════════
//  EQUIPOS
// ════════════════════════════════════════════════════════════

export async function getEquipos(ligaId) {
  const { data, error } = await sb
    .from('teams')
    .select('*')
    .eq('league_id', ligaId)
    .order('created_at');
  if (error) return [];
  return data;
}

export async function agregarEquipo(ligaId, nombre) {
  const { data, error } = await sb
    .from('teams')
    .insert({ league_id: ligaId, nombre })
    .select()
    .single();
  if (error) throw new Error('Error al agregar equipo: ' + error.message);
  return data;
}

export async function actualizarEquipo(id, campos) {
  const { error } = await sb.from('teams').update(campos).eq('id', id);
  if (error) throw new Error('Error al actualizar equipo');
}

export async function eliminarEquipo(id) {
  await sb.from('teams').delete().eq('id', id);
}

// ════════════════════════════════════════════════════════════
//  PARTIDOS
// ════════════════════════════════════════════════════════════

export async function getPartidos(ligaId) {
  const { data, error } = await sb
    .from('matches')
    .select('*')
    .eq('league_id', ligaId)
    .order('fecha', { ascending: true });
  if (error) return [];
  return data;
}

export async function guardarPartido(ligaId, partido) {
  const { data, error } = await sb
    .from('matches')
    .insert({ league_id: ligaId, ...partido })
    .select()
    .single();
  if (error) throw new Error('Error al guardar partido: ' + error.message);
  return data;
}

export async function actualizarPartido(id, campos) {
  const { error } = await sb.from('matches').update(campos).eq('id', id);
  if (error) throw new Error('Error al actualizar partido');
}

export async function eliminarPartido(id) {
  await sb.from('matches').delete().eq('id', id);
}

// ════════════════════════════════════════════════════════════
//  PLAYOFFS
// ════════════════════════════════════════════════════════════

export async function getPlayoffs(ligaId) {
  const { data } = await sb
    .from('playoffs')
    .select('*')
    .eq('league_id', ligaId)
    .single();
  return data?.data || null;
}

export async function guardarPlayoffs(ligaId, data) {
  // Upsert
  await sb.from('playoffs').upsert(
    { league_id: ligaId, data, updated_at: new Date().toISOString() },
    { onConflict: 'league_id' }
  );
}

// ════════════════════════════════════════════════════════════
//  USUARIOS — panel admin
// ════════════════════════════════════════════════════════════

export async function getTodosUsuarios() {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

export async function actualizarPerfil(id, campos) {
  const { error } = await sb.from('profiles').update(campos).eq('id', id);
  if (error) throw new Error('Error al actualizar perfil');
}

export async function cambiarRol(userId, nuevoRol) {
  await actualizarPerfil(userId, { role: nuevoRol });
}

export async function desactivarUsuario(userId) {
  await actualizarPerfil(userId, { activo: false });
}

export async function activarUsuario(userId) {
  await actualizarPerfil(userId, { activo: true });
}

// ════════════════════════════════════════════════════════════
//  PETICIONES (más de 2 ligas)
// ════════════════════════════════════════════════════════════

export async function enviarPeticion(userId, mensaje) {
  const { error } = await sb.from('join_requests').insert({ user_id: userId, mensaje });
  if (error) throw new Error('Error al enviar petición');
}

export async function getPeticiones() {
  const { data, error } = await sb
    .from('join_requests')
    .select('*, profiles(email, nombre)')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

export async function responderPeticion(id, estado) {
  await sb.from('join_requests').update({ estado }).eq('id', id);
}
