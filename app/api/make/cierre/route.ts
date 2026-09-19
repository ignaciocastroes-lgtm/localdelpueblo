import { NextRequest, NextResponse } from 'next/server'

// Esta ruta corre en el servidor de Vercel, nunca en la tablet.
// La URL del webhook de Make es secreta: se configura como variable de
// entorno en Vercel (Project Settings → Environment Variables) y jamás
// se expone al cliente (por eso NO lleva el prefijo NEXT_PUBLIC_).
//
//   MAKE_WEBHOOK_URL = https://hook.us1.make.com/xxxxxxxxxxxxxxxxxxxx
//
// Make recibe este JSON y lo escribe en el libro real (Google Sheet,
// sistema contable, etc.), que es donde vive la fuente de verdad.

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL

  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'MAKE_WEBHOOK_URL no está configurada en las variables de entorno de Vercel.' },
      { status: 500 }
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición inválido' }, { status: 400 })
  }

  try {
    const makeResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!makeResponse.ok) {
      const text = await makeResponse.text().catch(() => '')
      return NextResponse.json(
        { error: 'Make respondió con error', detail: text },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'No se pudo contactar a Make', detail: String(err) },
      { status: 502 }
    )
  }
}
