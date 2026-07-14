import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || 'https://placeholder.supabase.co';
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

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

// El refresco automático del token de sesión usa setTimeout internamente.
// Los navegadores (sobre todo en celular) suspenden esos timers cuando la
// pestaña queda en segundo plano — al volver de otra app, el token puede
// haber expirado sin refrescarse, y las peticiones a Supabase empiezan a
// fallar en silencio (los botones "no hacen nada": el clic dispara la
// función pero el request muere por auth inválida). Pausamos el refresco
// mientras la pestaña está oculta y forzamos uno inmediato al volver a
// primer plano, como recomienda Supabase para apps móviles/PWA.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sb.auth.startAutoRefresh();
    } else {
      sb.auth.stopAutoRefresh();
    }
  });
}

export async function getSupabase() {
  return sb;
}
