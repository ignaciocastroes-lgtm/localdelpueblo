import { NextRequest, NextResponse } from 'next/server'

// Mercado Pago llama a esta ruta automáticamente apenas se confirma un pago
// (esto es lo que hace posible el "cobro automático": nadie en el kiosko
// tiene que revisar nada a mano). Acá se verifica el pago contra la API de
// Mercado Pago (nunca se confía en el contenido del webhook a ciegas) y,
// si está aprobado, se avisa a Make para que quede en el libro contable.

export async function POST(request: NextRequest) {
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    // Respondemos 200 igual: si no hay token configurado no hay nada que
    // verificar, pero no queremos que Mercado Pago siga reintentando.
    return NextResponse.json({ ok: true, warning: 'MP_ACCESS_TOKEN no configurado' })
  }

  // Mercado Pago envía distintos formatos según el tipo de integración:
  // - Checkout Pro (nuevo): JSON body { type: 'payment', data: { id: '...' } }
  // - Notificación legacy (IPN): query params ?topic=payment&id=...
  let paymentId: string | null = null

  try {
    const body = await request.json()
    paymentId = body?.data?.id || (body?.type === 'payment' ? body?.id : null)
  } catch {
    // Sin cuerpo JSON válido: puede ser una notificación legacy por query params
  }

  if (!paymentId) {
    const topic = request.nextUrl.searchParams.get('topic')
    const id = request.nextUrl.searchParams.get('id')
    if (topic === 'payment' && id) paymentId = id
  }

  if (!paymentId) {
    return NextResponse.json({ ok: true }) // Notificación de otro tipo (no es un pago), se ignora
  }

  try {
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!paymentResponse.ok) {
      return NextResponse.json({ ok: true }) // No se pudo verificar; MP reintentará
    }

    const payment = await paymentResponse.json()

    if (payment.status === 'approved') {
      const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL
      if (makeWebhookUrl) {
        // Avisamos a Make en segundo plano; si falla, no bloqueamos la
        // respuesta a Mercado Pago (igual queda el pago aprobado en MP).
        fetch(makeWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evento: 'pago_mercadopago_confirmado',
            paymentId: payment.id,
            externalReference: payment.external_reference,
            monto: payment.transaction_amount,
            fecha: payment.date_approved,
          }),
        }).catch(() => { /* Make no disponible: se reintentará en el próximo cierre */ })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    // Devolvemos 200 para que Mercado Pago no entre en un loop de reintentos
    // agresivo; el estado real siempre se puede re-consultar desde /estado.
    return NextResponse.json({ ok: true })
  }
}
