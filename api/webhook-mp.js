// api/webhook-mp.js
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // necesitamos service key aquí (no anon key)
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { type, data } = req.body;

  // Solo nos interesan los pagos aprobados
  if (type !== 'payment') {
    return res.status(200).json({ ok: true });
  }

  try {
    // Obtener detalles del pago desde MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
    });
    const pago = await mpRes.json();

    if (pago.status !== 'approved') {
      return res.status(200).json({ ok: true, status: pago.status });
    }

    // external_reference = "userId|mensual" o "userId|temporada"
    const [userId, tipoPlan] = (pago.external_reference || '').split('|');
    if (!userId) {
      return res.status(400).json({ error: 'Sin referencia de usuario' });
    }

    // Calcular fecha de expiración
    const ahora      = new Date();
    const esTemporada = tipoPlan === 'temporada';
    const expira     = new Date(ahora);
    if (esTemporada) {
      expira.setMonth(expira.getMonth() + 6);
    } else {
      expira.setMonth(expira.getMonth() + 1);
    }

    // Actualizar plan en Supabase
    const { error } = await sb
      .from('profiles')
      .update({
        plan:         'pro',
        plan_expira:  expira.toISOString(),
        plan_origen:  'mercadopago',
      })
      .eq('id', userId);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`✓ Plan Pro activado para usuario ${userId} hasta ${expira.toISOString()}`);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}