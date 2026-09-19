import { NextRequest, NextResponse } from 'next/server'

// Freno básico para las rutas POST que llama la propia tablet
// (crear-pago, cierre a Make): exige que la petición venga de esta misma
// web. Los navegadores siempre envían la cabecera Origin en un POST, así que
// bloquea otros sitios y scripts ingenuos.
//
// OJO: NO es autenticación. Quien fabrique la cabecera a mano la pasa. La
// protección real es activar "Deployment Protection / Password Protection"
// en Vercel (ver docs/GUIA-DESPLIEGUE.md, sección Seguridad).
export function rejectForeignOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')

  if (!origin || !host) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  }

  try {
    if (new URL(origin).host !== host) {
      return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  }

  return null
}
