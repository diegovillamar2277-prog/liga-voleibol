// api/crear-preferencia.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { userId, email, plan } = req.body;

  if (!userId || !email) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const precioMensual  = 99;
  const precioTemporada = 699;
  const esMensual = plan !== 'temporada';
  const precio    = esMensual ? precioMensual : precioTemporada;
  const titulo    = esMensual
    ? 'Liga Voleibol — Plan Pro (1 mes)'
    : 'Liga Voleibol — Plan Pro (Temporada 6 meses)';

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        items: [
          {
            title:      titulo,
            quantity:   1,
            unit_price: precio,
            currency_id: 'MXN',
          }
        ],
        payer: { email },
        external_reference: `${userId}|${esMensual ? 'mensual' : 'temporada'}`,
        back_urls: {
          success: `${process.env.VITE_APP_URL || 'https://liga-voleibol.vercel.app'}/?pago=ok`,
          failure: `${process.env.VITE_APP_URL || 'https://liga-voleibol.vercel.app'}/?pago=error`,
          pending: `${process.env.VITE_APP_URL || 'https://liga-voleibol.vercel.app'}/?pago=pendiente`,
        },
        auto_return: 'approved',
        notification_url: `${process.env.VITE_APP_URL || 'https://liga-voleibol.vercel.app'}/api/webhook-mp`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('MP error:', data);
      return res.status(500).json({ error: 'Error al crear preferencia', detail: data });
    }

    return res.status(200).json({
      id:          data.id,
      init_point:  data.init_point,       // producción
      sandbox_url: data.sandbox_init_point // pruebas
    });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
}