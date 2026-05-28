import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const SUPABASE_URL  = 'https://xevzdswtsbmjzchgefox.supabase.co';
export const SUPABASE_ANON = 'sb_publishable_ks-bCTiUUmxtf-FJuiL1_g_hJhUlvQy';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:   true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export async function getSupabase() {
  return sb;
}
