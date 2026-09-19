'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Loader2, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { compressImageFile } from '@/lib/image-utils'
import { searchCommons, suggestPhotoQuery, type Candidate } from '@/lib/photo-search'
import { toast } from 'sonner'

// Buscador de fotos reales de frutas y verduras en Wikimedia Commons.
//
// - La búsqueda se hace desde la tablet (necesita internet) y la persona ELIGE
//   la foto: la búsqueda automática puede traer cosas raras, así que nada se
//   asigna solo.
// - La foto elegida se DESCARGA y se guarda reducida en la tablet (~50 KB): después
//   funciona sin internet y no depende de que la página de origen siga arriba.
// - Se guarda el crédito (autor + licencia), porque las fotos de Commons son
//   libres pero varias exigen nombrar al autor. Stock → "Créditos de fotos".

interface PhotoFinderProps {
  open: boolean
  productName: string
  onClose: () => void
  onPick: (dataUrl: string, credit: string) => void
}

export function PhotoFinder({ open, productName, onClose, onPick }: PhotoFinderProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const run = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setMessage(null)
    try {
      const found = await searchCommons(q.trim())
      setResults(found)
      if (found.length === 0) setMessage('No se encontraron fotos. Prueba con otro nombre (por ejemplo, el nombre en singular).')
    } catch {
      setResults([])
      setMessage('No se pudo buscar. Revisa el internet de la tablet e intenta de nuevo, o toma la foto con la cámara.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const q = suggestPhotoQuery(productName)
    setQuery(q)
    setResults([])
    setPicking(null)
    run(q)
  }, [open, productName, run])

  const pick = async (c: Candidate) => {
    setPicking(c.id)
    try {
      const res = await fetch(c.thumbUrl)
      if (!res.ok) throw new Error('descarga')
      const blob = await res.blob()
      const dataUrl = await compressImageFile(new File([blob], 'foto.jpg', { type: blob.type || 'image/jpeg' }), 640, 0.7)
      onPick(dataUrl, c.credit)
      onClose()
    } catch {
      toast.error('No se pudo descargar esa foto. Prueba con otra.')
    } finally {
      setPicking(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar foto de {productName || 'producto'}</DialogTitle>
          <DialogDescription>
            Fotos libres de Wikimedia Commons. Toca la que mejor se vea: se guarda en la tablet junto con el crédito del autor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); run(query) }} className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej: tomate, palta, lechuga costina" className="h-11" />
          <Button type="submit" disabled={loading} className="h-11 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
          </Button>
        </form>

        {message && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center text-center">
            <ImageOff className="w-4 h-4 shrink-0" /> {message}
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c)}
              disabled={picking !== null}
              className="text-left rounded-lg border overflow-hidden hover:border-primary focus:border-primary disabled:opacity-60"
            >
              <div className="relative aspect-[4/3] bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbUrl} alt={c.title} loading="lazy" className="w-full h-full object-cover" />
                {picking === c.id && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </div>
              <p className="px-2 py-1 text-[10px] text-muted-foreground line-clamp-2">{c.license}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
