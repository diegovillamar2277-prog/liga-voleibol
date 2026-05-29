import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || 'https://placeholder.supabase.co';
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

// ── Diagnóstico de variables de entorno ──────────────────────
console.log('[Supabase] URL:', supabaseUrl);
console.log('[Supabase] ANON KEY presente:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
console.log('[Supabase] ANON KEY primeros 20 chars:', supabaseAnon?.slice(0, 20));
if (!import.meta.env.VITE_SUPABASE_URL) {
  console.error('[Supabase] ⚠️ VITE_SUPABASE_URL no está definida — usando placeholder');
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.error('[Supabase] ⚠️ VITE_SUPABASE_ANON_KEY no está definida — usando placeholder');
}

export const sb = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
  },
});

export async function getSupabase() {
  return sb;
}
