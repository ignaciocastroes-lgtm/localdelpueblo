import { NextRequest, NextResponse } from 'next/server'

// Crea una preferencia de pago real en Mercado Pago (Checkout Pro).
// El access token es secreto y solo vive en el servidor (Vercel env vars):
//
//   MP_ACCESS_TOKEN = APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//
// El tablet nunca ve este token: solo llama a esta ruta y recibe de vuelta
// un link de pago, que se transforma en QR para mostrar al cliente.

export async function POST(request: NextRequest) {
  const accessToken = process.env.MP_ACCESS_TOKEN

  if (!accessToken) {
    return NextResponse.json(
      { error: 'MP_ACCESS_TOKEN no está configurado en las variables de entorno de Vercel.' },
      { status: 500 }
    )
  }

  const { amount, description, externalReference } = await request.json()

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
  }

  const montoRedondeado = Math.round(amount)

  const origin = request.nextUrl.origin

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: description || 'Venta Kiosko',
            quantity: 1,
            unit_price: montoRedondeado,
            currency_id: 'CLP',
          },
        ],
        external_reference: externalReference,
        notification_url: `${origin}/api/mercadopago/webhook`,
        back_urls: {
          success: `${origin}?pago=exitoso`,
          failure: `${origin}?pago=fallido`,
          pending: `${origin}?pago=pendiente`,
        },
      }),
    })

    if (!mpResponse.ok) {
      const detail = await mpResponse.text().catch(() => '')
      return NextResponse.json(
        { error: 'Mercado Pago rechazó la solicitud', detail },
        { status: 502 }
      )
    }

    const data = await mpResponse.json()

    return NextResponse.json({
      initPoint: data.init_point,
      preferenceId: data.id,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'No se pudo contactar a Mercado Pago', detail: String(err) },
      { status: 502 }
    )
  }
}
