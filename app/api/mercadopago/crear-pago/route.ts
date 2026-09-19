import { NextRequest, NextResponse } from 'next/server'
import { rejectForeignOrigin } from '@/lib/api-guard'

// Crea una preferencia de pago real en Mercado Pago (Checkout Pro).
// El access token es secreto y solo vive en el servidor (Vercel env vars):
//
//   MP_ACCESS_TOKEN = APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//
// El tablet nunca ve este token: solo llama a esta ruta y recibe de vuelta
// un link de pago, que se transforma en QR para mostrar al cliente.

// Tope de seguridad por cobro: evita que un monto mal tipeado (o una llamada
// externa) genere un link de pago absurdo.
const MONTO_MAXIMO = 5_000_000

export async function POST(request: NextRequest) {
  const blocked = rejectForeignOrigin(request)
  if (blocked) return blocked

  const accessToken = process.env.MP_ACCESS_TOKEN

  if (!accessToken) {
    return NextResponse.json(
      {
        code: 'MP_NOT_CONFIGURED',
        error: 'MP_ACCESS_TOKEN no está configurado en las variables de entorno de Vercel.',
      },
      { status: 500 }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición inválido' }, { status: 400 })
  }

  const amount = Number(body?.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > MONTO_MAXIMO) {
    return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
  }

  const description = typeof body?.description === 'string' ? body.description.slice(0, 120) : ''
  const externalReference =
    typeof body?.externalReference === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.externalReference)
      ? body.externalReference
      : `venta-${Date.now()}`

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
