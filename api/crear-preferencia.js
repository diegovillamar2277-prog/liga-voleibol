// api/crear-preferencia.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { userId, email, opcion } = req.body;

  if (!userId || !email || !opcion) {
    return res.status(400).json({ error: 'Faltan datos: userId, email, opcion' });
  }

  // ── Catálogo de opciones ────────────────────────────────────────────────
  const CATALOGO = {
    // Plan Medio
    medio_mensual:    { precio: 99,  titulo: 'Liga Voleibol — Plan Medio (1 mes)',     plan: 'medio', tipo: 'mensual'    },
    medio_temporada:  { precio: 450, titulo: 'Liga Voleibol — Plan Medio (6 meses)',   plan: 'medio', tipo: 'temporada'  },
    // Plan Top
    top_mensual:      { precio: 149, titulo: 'Liga Voleibol — Plan Top (1 mes)',       plan: 'top',   tipo: 'mensual'    },
    top_temporada:    { precio: 650, titulo: 'Liga Voleibol — Plan Top (6 meses)',     plan: 'top',   tipo: 'temporada'  },
    // Add-ons vista pública (solo para plan básico)
    addon_vp_unico:   { precio: 100, titulo: 'Liga Voleibol — Vista Pública (siempre)',plan: 'basico',tipo: 'addon_unico'     },
    addon_vp_temporada:{ precio: 70, titulo: 'Liga Voleibol — Vista Pública (6 meses)',plan: 'basico',tipo: 'addon_temporada' },
    // Retro-compatibilidad con el modal anterior (plan='mensual'|'temporada')
    mensual:          { precio: 99,  titulo: 'Liga Voleibol — Plan Medio (1 mes)',     plan: 'medio', tipo: 'mensual'    },
    temporada:        { precio: 450, titulo: 'Liga Voleibol — Plan Medio (6 meses)',   plan: 'medio', tipo: 'temporada'  },
  };

  const item = CATALOGO[opcion];
  if (!item) {
    return res.status(400).json({ error: `Opción desconocida: ${opcion}` });
  }

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
            title:       item.titulo,
            quantity:    1,
            unit_price:  item.precio,
            currency_id: 'MXN',
          },
        ],
        payer: { email },
        // external_reference: "userId|plan|tipo"
        // Ej: "abc123|medio|mensual"  ó  "abc123|basico|addon_unico"
        external_reference: `${userId}|${item.plan}|${item.tipo}`,
        back_urls: {
          success:  `${process.env.VITE_APP_URL || 'https://liga-voleibol.vercel.app'}/?pago=ok`,
          failure:  `${process.env.VITE_APP_URL || 'https://liga-voleibol.vercel.app'}/?pago=error`,
          pending:  `${process.env.VITE_APP_URL || 'https://liga-voleibol.vercel.app'}/?pago=pendiente`,
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
      init_point:  data.init_point,
      sandbox_url: data.sandbox_init_point,
    });

  } catch (err) {
    console.error('Error crear-preferencia:', err);
    return res.status(500).json({ error: err.message });
  }
}
