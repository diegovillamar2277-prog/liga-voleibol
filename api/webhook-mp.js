// api/webhook-mp.js
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { type, data } = req.body;

  if (type !== 'payment') {
    return res.status(200).json({ ok: true });
  }

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const pago = await mpRes.json();

    if (pago.status !== 'approved') {
      return res.status(200).json({ ok: true, status: pago.status });
    }

    // external_reference = "userId|plan|tipo"
    // Ejemplos:
    //   "abc123|medio|mensual"
    //   "abc123|top|temporada"
    //   "abc123|basico|addon_unico"
    //   "abc123|basico|addon_temporada"
    // Retro-compatibilidad: "abc123|mensual" (2 partes, formato antiguo)
    const partes = (pago.external_reference || '').split('|');
    if (partes.length < 2) {
      return res.status(400).json({ error: 'Referencia externa inválida' });
    }

    const userId = partes[0];
    const plan   = partes[1]; // 'medio' | 'top' | 'basico' | (legacy) 'mensual' | 'temporada'
    const tipo   = partes[2]; // 'mensual' | 'temporada' | 'addon_unico' | 'addon_temporada'

    if (!userId) {
      return res.status(400).json({ error: 'Sin userId en referencia' });
    }

    const ahora   = new Date();
    const expira  = new Date(ahora);

    // ── Determinar el plan y la expiración ────────────────────────────────
    let planFinal  = 'basico';
    let expiraISO  = null;
    let addonUpdate = null;

    // Retro-compatibilidad: formato antiguo (2 partes)
    if (!tipo && (plan === 'mensual' || plan === 'temporada')) {
      planFinal = 'medio';
      if (plan === 'mensual')    expira.setMonth(expira.getMonth() + 1);
      if (plan === 'temporada')  expira.setMonth(expira.getMonth() + 6);
      expiraISO = expira.toISOString();
    }
    // Add-ons (plan básico, solo activan vista pública)
    else if (plan === 'basico' && tipo === 'addon_unico') {
      // Sin cambio de plan — solo marcamos el add-on como activo de por vida
      addonUpdate = { addon_vista_publica: true, addon_vp_expira: null };
    }
    else if (plan === 'basico' && tipo === 'addon_temporada') {
      const expiraAddon = new Date(ahora);
      expiraAddon.setMonth(expiraAddon.getMonth() + 6);
      addonUpdate = { addon_vista_publica: true, addon_vp_expira: expiraAddon.toISOString() };
    }
    // Planes de pago
    else if (plan === 'medio' || plan === 'top') {
      planFinal = plan;
      if (tipo === 'mensual')   expira.setMonth(expira.getMonth() + 1);
      if (tipo === 'temporada') expira.setMonth(expira.getMonth() + 6);
      expiraISO = expira.toISOString();
    }

    // ── Construir el update de Supabase ───────────────────────────────────
    const updateFields = {
      plan_origen: 'mercadopago',
    };

    if (addonUpdate) {
      // Solo actualizar add-on, no tocar el plan principal
      Object.assign(updateFields, addonUpdate);
    } else {
      updateFields.plan        = planFinal;
      updateFields.plan_expira = expiraISO;
    }

    const { error } = await sb
      .from('profiles')
      .update(updateFields)
      .eq('id', userId);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`✓ Plan actualizado para ${userId}: plan=${planFinal || 'addon'} tipo=${tipo} expira=${expiraISO}`);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
