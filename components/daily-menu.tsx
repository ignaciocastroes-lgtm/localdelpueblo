'use client'

import { useMemo, useState, useEffect } from 'react'
import { Sun, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getModifierGroupById, formatWeight, type Product } from '@/lib/store'
import { toast } from 'sonner'

// Carta y stock del día (sesión de administrador).
// El puesto no funciona como un minimarket: cada día cambia lo que hay. Aquí el dueño enciende o
// apaga lo que hay hoy (sandía, albahaca, jugo de piña...) y anota con cuánto parte cada producto
// (0 si no queda nada). Parte con lo que quedó contado la noche anterior.
// Un producto apagado sigue apareciendo en el POS (atenuado): el vendedor puede venderlo igual y anotarlo.

export interface DailyMenuChanges {
  stock: Record<string, number>          // productId → stock de apertura (gramos si es por peso)
  availability: Record<string, boolean>  // productId → hoy hay / no hay
  offModifiers: string[]                 // opciones apagadas hoy (ej. sabor de jugo)
}

interface DailyMenuProps {
  products: Product[]
  offModifiers: string[]
  openedToday: boolean
  onSave: (changes: DailyMenuChanges) => void
}

const isPeso = (p: Product) => p.saleType === 'peso'
const toText = (p: Product) => String(isPeso(p) ? Math.round(p.stock) / 1000 : p.stock)
const toStock = (p: Product, text: string) => {
  const n = Number(text.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return isPeso(p) ? Math.round(n * 1000) : Math.round(n)
}

export function DailyMenu({ products, offModifiers, openedToday, onSave }: DailyMenuProps) {
  const [query, setQuery] = useState('')
  const [draftStock, setDraftStock] = useState<Record<string, string>>({})
  const [draftOn, setDraftOn] = useState<Record<string, boolean>>({})
  const [draftOffMods, setDraftOffMods] = useState<string[]>(offModifiers)
  // Foto del estado al abrir el panel: solo se guardan las filas que el dueño TOCÓ, para no
  // pisar ventas hechas mientras tanto por otro vendedor.
  const [baseStock, setBaseStock] = useState<Record<string, string>>({})
  const [baseOn, setBaseOn] = useState<Record<string, boolean>>({})

  const productKey = products.map(p => p.id).join('|')
  useEffect(() => {
    const st: Record<string, string> = {}, on: Record<string, boolean> = {}
    products.forEach(p => { st[p.id] = toText(p); on[p.id] = p.availableToday !== false })
    setDraftStock(st); setBaseStock(st); setDraftOn(on); setBaseOn(on); setDraftOffMods(offModifiers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productKey])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...products].filter(p => !q || p.name.toLowerCase().includes(q))
  }, [products, query])

  const juiceOptions = getModifierGroupById('jugo-fruta')?.modifiers ?? []

  const save = () => {
    const stock: Record<string, number> = {}
    const availability: Record<string, boolean> = {}
    for (const p of products) {
      if (draftStock[p.id] !== undefined && draftStock[p.id] !== baseStock[p.id]) {
        const v = toStock(p, draftStock[p.id])
        if (v === null) { toast.error(`Stock inválido en "${p.name}".`); return }
        stock[p.id] = v
      }
      if (draftOn[p.id] !== undefined && draftOn[p.id] !== baseOn[p.id]) availability[p.id] = draftOn[p.id]
    }
    onSave({ stock, availability, offModifiers: draftOffMods })
    toast.success('Carta y stock del día guardados')
  }

  const setAll = (value: boolean) => setDraftOn(Object.fromEntries(products.map(p => [p.id, value])))
  const offZero = () => setDraftOn(prev => {
    const next = { ...prev }
    products.forEach(p => { if ((toStock(p, draftStock[p.id] ?? '0') ?? 0) <= 0) next[p.id] = false })
    return next
  })

  return (
    <Card className="bg-slate-900 border-emerald-600/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
          <Sun className="w-4 h-4 text-amber-400" /> Carta y stock del día
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-400">
          Cada día cambia lo que hay. Parte con lo que quedó contado ayer: ajusta el <strong className="text-slate-200">stock con el que parte hoy</strong> (0 si no hay)
          y enciende solo lo que <strong className="text-slate-200">hay hoy</strong>. Lo apagado se ve atenuado en la venta, pero el vendedor puede venderlo igual y anotarlo.
        </p>
        {!openedToday && (
          <p className="text-xs rounded-md bg-amber-500/10 text-amber-300 px-2 py-1">Aún no guardas la apertura de hoy.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto…" className="pl-8 h-9 bg-slate-800 border-slate-700 text-white" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setAll(true)} className="text-slate-300 border-slate-700">Encender todo</Button>
          <Button variant="outline" size="sm" onClick={offZero} className="text-slate-300 border-slate-700">Apagar los que están en 0</Button>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-800">
          {filtered.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2">
              <Switch checked={draftOn[p.id] ?? true} onCheckedChange={(v) => setDraftOn(prev => ({ ...prev, [p.id]: v }))} aria-label={`Hoy hay ${p.name}`} />
              <span className={`flex-1 text-sm truncate ${draftOn[p.id] === false ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{p.emoji ? `${p.emoji} ` : ''}{p.name}</span>
              <div className="w-32 shrink-0">
                <Input
                  type="number" inputMode="decimal" min="0" step={isPeso(p) ? '0.1' : '1'}
                  value={draftStock[p.id] ?? ''}
                  onChange={(e) => setDraftStock(prev => ({ ...prev, [p.id]: e.target.value }))}
                  className="h-9 bg-slate-800 border-slate-700 text-white text-right"
                  aria-label={`Stock de ${p.name}`}
                />
              </div>
              <span className="w-8 text-xs text-slate-500">{isPeso(p) ? 'kg' : 'un.'}</span>
            </div>
          ))}
        </div>

        {juiceOptions.length > 0 && (
          <div className="pt-2 border-t border-slate-800">
            <p className="text-sm text-slate-200 mb-2">Sabores de jugo de hoy</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {juiceOptions.map(m => (
                <label key={m.id} className="flex items-center gap-2 text-sm text-slate-300">
                  <Switch
                    checked={!draftOffMods.includes(m.id)}
                    onCheckedChange={(v) => setDraftOffMods(prev => v ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={save}>Guardar apertura del día</Button>
        <p className="text-[11px] text-slate-500">Stock en kilos para productos por peso (20 = 20 kg). Hoy total: {formatWeight(products.filter(isPeso).reduce((s, p) => s + p.stock, 0))} en productos por peso.</p>
      </CardContent>
    </Card>
  )
}
