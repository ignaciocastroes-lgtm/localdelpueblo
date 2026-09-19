import { NextResponse } from 'next/server'

// Diagnóstico pensado para revisar ANTES de la primera venta real del día,
// desde la propia tablet (Stock → Diagnóstico de Pagos). No expone valores
// secretos, solo si están configurados y si Mercado Pago los acepta.

export async function GET() {
  const mpToken = process.env.MP_ACCESS_TOKEN
  const makeUrl = process.env.MAKE_WEBHOOK_URL

  const result = {
    mercadoPago: {
      configurado: !!mpToken,
      valido: false,
      detalle: '' as string,
    },
    make: {
      configurado: !!makeUrl,
      detalle: '' as string,
    },
  }

  if (!mpToken) {
    result.mercadoPago.detalle = 'Falta MP_ACCESS_TOKEN en las variables de entorno de Vercel.'
  } else {
    // Validación real: le preguntamos a Mercado Pago si el token identifica
    // una cuenta válida. Esto detecta un token mal copiado o vencido antes
    // de que un cliente intente pagar.
    try {
      const res = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${mpToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        result.mercadoPago.valido = true
        // Esta ruta es pública: no se devuelve el correo completo de la cuenta.
        const email: string | undefined = data.email
        const cuenta = email && email.includes('@')
          ? `${email[0]}***@${email.split('@')[1]}`
          : (data.nickname || 'cuenta verificada')
        result.mercadoPago.detalle = `Token válido. Cuenta: ${cuenta}`
      } else {
        result.mercadoPago.detalle = 'El token no fue aceptado por Mercado Pago (revisa que sea el de PRODUCCIÓN, no el de prueba).'
      }
    } catch {
      result.mercadoPago.detalle = 'No se pudo contactar a Mercado Pago para validar el token.'
    }
  }

  if (!makeUrl) {
    result.make.detalle = 'Falta MAKE_WEBHOOK_URL en las variables de entorno de Vercel.'
  } else {
    // No probamos el webhook con un POST real para no disparar el
    // escenario de Make sin que el usuario lo sepa. Solo confirmamos que
    // la URL tiene forma de webhook de Make.
    result.make.detalle = makeUrl.includes('make.com')
      ? 'URL configurada con formato válido de Make.'
      : 'La URL está configurada pero no parece ser de make.com — revísala.'
  }

  return NextResponse.json(result)
}
