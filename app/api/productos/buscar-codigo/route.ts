import { NextRequest, NextResponse } from 'next/server'

// Busca un producto real por su código de barras en Open Food Facts:
// base de datos abierta y gratuita (sin API key), con cobertura mundial de
// marcas de supermercado (Coca-Cola, Nestlé, PepsiCo, etc.) contribuida por
// la propia comunidad — incluye bastantes productos que se venden en Chile,
// aunque no es 100% de todo lo que existe acá.
//
// Referencia: https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/
//
// No es una simulación: si el código no está en la base, se responde
// found:false explícitamente — nunca se inventa un producto para "rellenar".

const CATEGORY_KEYWORDS: { category: string; keywords: string[] }[] = [
  { category: 'Bebidas', keywords: ['beverage', 'soda', 'juice', 'water', 'drink', 'coffee', 'tea', 'milk'] },
  { category: 'Snacks', keywords: ['snack', 'chip', 'candy', 'chocolate', 'biscuit', 'cookie', 'nuts', 'cereal-bar'] },
  { category: 'Comida', keywords: ['meal', 'sandwich', 'bread', 'pizza', 'pasta', 'frozen', 'canned', 'soup'] },
]

function guessCategory(categoriesTags: string[] = []): string {
  const joined = categoriesTags.join(' ').toLowerCase()
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => joined.includes(k))) return category
  }
  return 'Otros'
}

export async function GET(request: NextRequest) {
  const barcode = request.nextUrl.searchParams.get('barcode')?.trim()

  if (!barcode || !/^\d{6,14}$/.test(barcode)) {
    return NextResponse.json({ found: false, error: 'Código de barras inválido' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
      headers: {
        // Open Food Facts pide un User-Agent descriptivo para no limitar el acceso.
        'User-Agent': 'MinimarketInternacionalKiosko/1.0 (contacto: soporte@minimarket-kiosko.cl)',
      },
    })

    if (!res.ok) {
      return NextResponse.json({ found: false, error: 'No se pudo contactar la base de datos de productos' }, { status: 502 })
    }

    const data = await res.json()

    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ found: false })
    }

    const p = data.product

    return NextResponse.json({
      found: true,
      name: p.product_name_es || p.product_name || '',
      brand: p.brands || '',
      quantity: p.quantity || '',
      image: p.image_front_url || p.image_url || '',
      categorySuggestion: guessCategory(p.categories_tags),
      source: 'Open Food Facts',
    })
  } catch (err) {
    return NextResponse.json({ found: false, error: 'No se pudo contactar la base de datos de productos' }, { status: 502 })
  }
}
