// ============================================================
//  supabase.js — Cliente Supabase
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://xevzdswtsbmjzchgefox.supabase.co';
export const SUPABASE_ANON = 'sb_publishable_ks-bCTiUUmxtf-FJuiL1_g_hJhUlvQy';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true }
});
