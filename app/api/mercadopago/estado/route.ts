import { NextRequest, NextResponse } from 'next/server'

// El tablet consulta esta ruta cada pocos segundos mientras espera el pago.
// La verdad siempre se pregunta directamente a Mercado Pago (no guardamos
// estado propio), así que no hace falta base de datos para esto.

export async function GET(request: NextRequest) {
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    return NextResponse.json(
      { error: 'MP_ACCESS_TOKEN no está configurado en las variables de entorno de Vercel.' },
      { status: 500 }
    )
  }

  const ref = request.nextUrl.searchParams.get('ref')
  if (!ref) {
    return NextResponse.json({ error: 'Falta el parámetro ref' }, { status: 400 })
  }

  try {
    const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(ref)}&sort=date_created&criteria=desc`
    const mpResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!mpResponse.ok) {
      const detail = await mpResponse.text().catch(() => '')
      return NextResponse.json({ error: 'Mercado Pago rechazó la consulta', detail }, { status: 502 })
    }

    const data = await mpResponse.json()
    const lastPayment = data.results?.[0]

    return NextResponse.json({
      status: lastPayment?.status || 'pending', // pending | approved | rejected | cancelled
      paymentId: lastPayment?.id || null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'No se pudo contactar a Mercado Pago', detail: String(err) },
      { status: 502 }
    )
  }
}
