// Búsqueda de fotos en Wikimedia Commons (lógica pura, sin React: se puede probar aparte).
// Ver components/photo-finder.tsx para la pantalla y las notas de licencias.

export interface Candidate {
  id: string
  thumbUrl: string
  title: string
  license: string
  credit: string
}

const API = 'https://commons.wikimedia.org/w/api.php'

// "Lechuga Costina" → "lechuga costina"; quita paréntesis y palabras de formato
// que no ayudan a encontrar la foto ("Trozos de Sandía" → "sandía").
export function suggestPhotoQuery(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .replace(/\b(trozos? de|entera?|armada|surtida)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const stripHtml = (html?: string) =>
  (html || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

export async function searchCommons(query: string): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '18',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '640',
    iiextmetadatafilter: 'LicenseShortName|Artist',
  })
  const res = await fetch(`${API}?${params}`)
  if (!res.ok) throw new Error('Wikimedia respondió con error')
  const data = await res.json()
  const pages = (Object.values(data?.query?.pages ?? {}) as any[]).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

  return pages
    .map((p): Candidate | null => {
      const info = p.imageinfo?.[0]
      if (!info?.thumburl || !/^image\/(jpeg|png|webp)$/.test(info.mime || '')) return null
      const license = stripHtml(info.extmetadata?.LicenseShortName?.value) || 'Licencia libre'
      const artist = stripHtml(info.extmetadata?.Artist?.value).slice(0, 80) || 'Autor desconocido'
      return {
        id: String(p.pageid),
        thumbUrl: info.thumburl,
        title: String(p.title || '').replace(/^File:/, ''),
        license,
        credit: `${artist} · ${license} · Wikimedia Commons`,
      }
    })
    .filter((c): c is Candidate => c !== null)
}
