'use client'

import { useMemo, useState, useEffect } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { formatWeight, type StockRow } from '@/lib/store'
import { toast } from 'sonner'

// Conteo de cierre: al terminar el día el vendedor cuenta lo que quedó de cada producto.
// Lo contado pasa a ser el stock de mañana. Si faltan productos (se echaron a perder, se
// regalaron sin anotar...) queda como "Diferencia de conteo", valorizada a costo.

interface StockCountProps {
  open: boolean
  rows: StockRow[]
  onClose: () => void
  onApply: (counts: Record<string, number>) => void
}

const isPeso = (r: StockRow) => r.saleType === 'peso'
const fmt = (r: StockRow, v: number) => isPeso(r) ? formatWeight(v) : String(v)
const toBase = (r: StockRow, text: string): number | null => {
  const n = Number(text.replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(n) || n < 0) return null
  return isPeso(r) ? Math.round(n * 1000) : Math.round(n)
}

export function StockCount({ open, rows, onClose, onApply }: StockCountProps) {
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [showAll, setShowAll] = useState(false)

  useEffect(() => { if (open) { setCounts({}); setShowAll(false) } }, [open])

  const visible = useMemo(
    () => rows.filter(r => showAll || r.current !== 0 || r.sold > 0 || r.purchased > 0 || r.opening > 0),
    [rows, showAll]
  )

  const fill = (mode: 'ok' | 'zero') => {
    const next: Record<string, string> = {}
    visible.forEach(r => {
      const base = mode === 'zero' ? 0 : r.current
      next[r.productId] = String(isPeso(r) ? base / 1000 : base)
    })
    setCounts(next)
  }

  const apply = () => {
    const out: Record<string, number> = {}
    for (const r of rows) {
      const text = counts[r.productId]
      if (text === undefined || text.trim() === '') continue
      const v = toBase(r, text)
      if (v === null) { toast.error(`Conteo inválido en "${r.name}".`); return }
      out[r.productId] = v
    }
    if (Object.keys(out).length === 0) { toast.error('No anotaste ningún conteo.'); return }
    onApply(out)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> Conteo de stock del cierre</DialogTitle>
          <DialogDescription>
            Cuenta lo que quedó y anótalo. Mañana el puesto parte con esto. Deja en blanco lo que no quieras tocar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => fill('ok')}>Todo cuadra</Button>
          <Button variant="outline" size="sm" onClick={() => fill('zero')}>Contar todo en 0</Button>
          <label className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Mostrar también productos sin movimiento
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-1 pr-2">Producto</th>
                <th className="px-1 text-right">Inicio</th>
                <th className="px-1 text-right">+Compra</th>
                <th className="px-1 text-right">−Venta</th>
                <th className="px-1 text-right">−Merma/regalo</th>
                <th className="px-1 text-right">Esperado</th>
                <th className="px-1 text-right w-28">Contado</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const text = counts[r.productId]
                const counted = text !== undefined ? toBase(r, text) : null
                const diff = counted !== null ? counted - r.current : null
                return (
                  <tr key={r.productId} className="border-b border-border/50">
                    <td className="py-1.5 pr-2 font-medium">{r.name}{r.other !== 0 && <span className="block text-[10px] text-amber-600">ajuste manual: {fmt(r, r.other)}</span>}</td>
                    <td className="px-1 text-right">{fmt(r, r.opening)}</td>
                    <td className="px-1 text-right">{r.purchased ? `+${fmt(r, r.purchased)}` : '–'}</td>
                    <td className="px-1 text-right">{r.sold ? `−${fmt(r, r.sold)}` : '–'}</td>
                    <td className="px-1 text-right">{r.lost ? `−${fmt(r, r.lost)}` : '–'}</td>
                    <td className="px-1 text-right font-semibold">{fmt(r, r.current)}</td>
                    <td className="px-1 text-right">
                      <Input
                        type="number" inputMode="decimal" min="0" step={isPeso(r) ? '0.1' : '1'}
                        value={text ?? ''} placeholder={isPeso(r) ? 'kg' : 'un.'}
                        onChange={(e) => setCounts(prev => ({ ...prev, [r.productId]: e.target.value }))}
                        className="h-8 text-right"
                      />
                      {diff !== null && diff !== 0 && (
                        <span className={`text-[10px] ${diff < 0 ? 'text-destructive' : 'text-sky-600'}`}>
                          {diff < 0 ? `falta ${fmt(r, -diff)}` : `sobra ${fmt(r, diff)}`}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={apply}>Guardar conteo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
