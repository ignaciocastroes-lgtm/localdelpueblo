'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2, ShoppingBasket, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { PaymentDetailsFields, ReceiptViewer, CashSourceField } from '@/components/payment-details'
import { saveReceipt } from '@/lib/receipt-store'
import { formatCLP, formatWeight, type Product, type Purchase, type PurchaseLine, type Payable } from '@/lib/store'
import { toast } from 'sonner'

// Compras del dueño: compra para el día (o la semana) en volumen — cajones, sacos,
// mallas — y las registra aquí. Cada compra:
//   - SUMA al stock (kg → gramos en los productos por peso),
//   - actualiza el costo por kilo/unidad (opcional),
//   - queda en Pasivos: lo pagado ahora sale del arqueo si fue en efectivo, y lo que
//     queda debiendo aparece como deuda al proveedor.

export interface PurchaseInput {
  supplierName: string
  lines: PurchaseLine[]
  total: number
  paidNow: number
  method?: 'cash' | 'transfer' | 'card'
  cashSource?: 'caja' | 'dueno'
  reference?: string
  receiptId?: string
  note?: string
}

interface PurchasesProps {
  products: Product[]
  purchases: Purchase[]
  payables: Payable[]
  onRegister: (input: PurchaseInput, opts: { updateCost: boolean }) => void
  onVoid: (purchaseId: string) => void
}

interface DraftLine { productId: string; qty: string; cost: string }

const num = (v: string) => Number(String(v).replace(',', '.'))
const emptyLine = (): DraftLine => ({ productId: '', qty: '', cost: '' })

export function Purchases({ products, purchases, payables, onRegister, onVoid }: PurchasesProps) {
  const [open, setOpen] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const [paidText, setPaidText] = useState('')
  const [paidTouched, setPaidTouched] = useState(false)
  const [method, setMethod] = useState<'cash' | 'transfer' | 'card'>('cash')
  const [cashSource, setCashSource] = useState<'caja' | 'dueno' | null>(null)
  const [reference, setReference] = useState('')
  const [receipt, setReceipt] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [updateCost, setUpdateCost] = useState(true)
  const [saving, setSaving] = useState(false)
  const [voidTarget, setVoidTarget] = useState<Purchase | null>(null)

  const productById = (id: string) => products.find(p => p.id === id)
  const isWeight = (p?: Product) => p?.saleType === 'peso'

  const sortedProducts = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name, 'es')), [products])
  const suppliers = useMemo(() => Array.from(new Set([...purchases.map(p => p.supplierName), ...payables.map(p => p.supplierName)].filter(Boolean))), [purchases, payables])

  const lineTotalNum = (l: DraftLine) => { const c = Math.round(num(l.cost)); return Number.isFinite(c) && c > 0 ? c : 0 }
  const total = lines.reduce((sum, l) => sum + lineTotalNum(l), 0)
  const paidNow = paidTouched ? Math.round(num(paidText) || 0) : total

  const reset = () => {
    setSupplier(''); setLines([emptyLine()]); setPaidText(''); setPaidTouched(false)
    setMethod('cash'); setCashSource(null); setReference(''); setReceipt(null); setNote(''); setUpdateCost(true)
  }

  const setLine = (i: number, patch: Partial<DraftLine>) => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))

  const save = async () => {
    const built: PurchaseLine[] = []
    for (const [i, l] of lines.entries()) {
      const p = productById(l.productId)
      if (!p) { toast.error(`Línea ${i + 1}: elige el producto.`); return }
      const q = num(l.qty)
      if (!Number.isFinite(q) || q <= 0) { toast.error(`Línea ${i + 1}: ingresa la cantidad.`); return }
      if (!isWeight(p) && !Number.isInteger(q)) { toast.error(`Línea ${i + 1}: "${p.name}" se cuenta en unidades enteras.`); return }
      const cost = lineTotalNum(l)
      if (cost <= 0) { toast.error(`Línea ${i + 1}: ingresa cuánto pagaste por esta línea.`); return }
      built.push({ productId: p.id, productName: p.name, quantity: isWeight(p) ? Math.round(q * 1000) / 1000 : q, unit: isWeight(p) ? 'kg' : 'un', cost })
    }
    if (paidNow < 0 || paidNow > total) { toast.error(`Lo pagado ahora debe estar entre $0 y ${formatCLP(total)}.`); return }
    if (paidNow > 0 && method === 'cash' && !cashSource) { toast.error('Indica de dónde salió el efectivo: del cajón o de tu bolsillo.'); return }

    setSaving(true)
    try {
      let receiptId: string | undefined
      if (receipt) {
        receiptId = await saveReceipt(receipt)
        if (!receiptId) toast.warning('No se pudo guardar la foto; la compra se registró sin ella.')
      }
      onRegister({
        supplierName: supplier.trim() || 'Proveedor sin nombre',
        lines: built,
        total,
        paidNow,
        method: paidNow > 0 ? method : undefined,
        cashSource: paidNow > 0 && method === 'cash' ? (cashSource ?? undefined) : undefined,
        reference: reference.trim() || undefined,
        receiptId,
        note: note.trim() || undefined,
      }, { updateCost })
      setOpen(false)
      reset()
    } finally {
      setSaving(false)
    }
  }

  const today = new Date().toDateString()
  const todays = purchases.filter(p => new Date(p.date).toDateString() === today)
  const todayTotal = todays.reduce((s, p) => s + p.total, 0)
  const todayPending = todays.reduce((s, p) => s + (p.total - p.paidNow), 0)

  const canVoid = (p: Purchase) => {
    const payable = payables.find(x => x.id === p.payableId)
    return !payable || payable.amountPaid <= p.paidNow // sin pagos posteriores
  }

  const qtyLabel = (l: PurchaseLine) => l.unit === 'kg' ? formatWeight(l.quantity * 1000) : `${l.quantity} un.`

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Compras de hoy</div>
            <div className="text-2xl font-bold">{formatCLP(todayTotal)}</div>
            <div className="text-xs text-muted-foreground">{todays.length} compra(s)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Quedó por pagar hoy</div>
            <div className="text-2xl font-bold text-destructive">{formatCLP(todayPending)}</div>
            <div className="text-xs text-muted-foreground">se ve en PASIVOS</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><ShoppingBasket className="w-5 h-5" /> Compras</CardTitle>
          <Button onClick={() => { reset(); setOpen(true) }} className="gap-2"><Plus className="w-4 h-4" /> Registrar compra</Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[450px]">
            <div className="space-y-3">
              {purchases.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aún no hay compras. Registra lo que compras (cajones, sacos, mallas): suma al stock y actualiza el costo.
                </p>
              ) : purchases.slice().reverse().map(p => (
                <div key={p.id} className="p-3 rounded-lg border bg-secondary/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{p.supplierName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{formatCLP(p.total)}</p>
                      {p.total - p.paidNow > 0
                        ? <Badge variant="destructive" className="text-[10px]">Debe {formatCLP(p.total - p.paidNow)}</Badge>
                        : <Badge variant="outline" className="text-[10px]">Pagada</Badge>}
                    </div>
                  </div>
                  <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    {p.lines.map((l, i) => (
                      <li key={i}>{l.productName}: {qtyLabel(l)} · {formatCLP(l.cost)}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    {p.paidNow > 0 && <span className="text-muted-foreground">Pagó {formatCLP(p.paidNow)} ({p.method === 'cash' ? 'efectivo' : p.method === 'transfer' ? 'transferencia' : 'tarjeta'}{p.reference ? ` · Op. ${p.reference}` : ''})</span>}
                    <ReceiptViewer receiptId={p.receiptId} />
                    {canVoid(p) && (
                      <button className="ml-auto text-destructive underline" onClick={() => setVoidTarget(p)}>Anular</button>
                    )}
                  </div>
                  {p.note && <p className="mt-1 text-xs italic text-muted-foreground">{p.note}</p>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Registrar compra */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false) }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar compra</DialogTitle>
            <DialogDescription>Lo que compraste para vender. Suma al stock y actualiza el costo.</DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel>Proveedor (opcional)</FieldLabel>
              <Input list="proveedores" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ej: La Vega, don Manuel" />
              <datalist id="proveedores">{suppliers.map(s => <option key={s} value={s} />)}</datalist>
            </Field>
          </FieldGroup>

          <div className="space-y-2">
            <p className="text-sm font-medium">Productos comprados</p>
            {lines.map((l, i) => {
              const p = productById(l.productId)
              const q = num(l.qty)
              const c = lineTotalNum(l)
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg border">
                  <div className="col-span-12 sm:col-span-5">
                    <label className="text-xs text-muted-foreground">Producto</label>
                    <select
                      value={l.productId}
                      onChange={(e) => setLine(i, { productId: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Elegir…</option>
                      {sortedProducts.map(pr => <option key={pr.id} value={pr.id}>{pr.emoji ? `${pr.emoji} ` : ''}{pr.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <label className="text-xs text-muted-foreground">Cantidad ({p ? (isWeight(p) ? 'kg' : 'un.') : '—'})</label>
                    <Input type="number" inputMode="decimal" step={isWeight(p) ? '0.1' : '1'} min="0" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} placeholder={isWeight(p) ? 'Ej: 20' : 'Ej: 12'} className="h-10" />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <label className="text-xs text-muted-foreground">Costo total ($)</label>
                    <Input type="number" inputMode="numeric" min="0" value={l.cost} onChange={(e) => setLine(i, { cost: e.target.value })} placeholder="Ej: 18000" className="h-10" />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    {lines.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))} aria-label="Quitar línea">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {p && Number.isFinite(q) && q > 0 && c > 0 && (
                    <p className="col-span-12 text-xs text-muted-foreground">
                      Costo: {formatCLP(Math.round(c / q))} {isWeight(p) ? 'por kg' : 'por unidad'}
                      {p.pricePerKg && isWeight(p) ? ` · vendes a ${formatCLP(p.pricePerKg)}/kg` : (!isWeight(p) && p.price ? ` · vendes a ${formatCLP(p.price)}` : '')}
                    </p>
                  )}
                </div>
              )
            })}
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setLines(prev => [...prev, emptyLine()])}>
              <Plus className="w-4 h-4" /> Agregar otro producto
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} className="w-4 h-4" />
            Actualizar el costo de estos productos con esta compra
          </label>

          <div className="rounded-lg bg-secondary/40 p-3 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total de la compra</span>
              <span className="text-xl font-bold">{formatCLP(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Pagado ahora ($)</label>
                <Input
                  type="number" inputMode="numeric" min="0"
                  value={paidTouched ? paidText : String(total || '')}
                  onChange={(e) => { setPaidTouched(true); setPaidText(e.target.value) }}
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Medio de pago</label>
                <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                </select>
              </div>
            </div>
            {total > 0 && total - paidNow > 0 && (
              <p className="text-xs text-destructive">Quedan {formatCLP(total - paidNow)} por pagar: se registran como deuda al proveedor en PASIVOS.</p>
            )}
            {paidNow > 0 && method === 'cash' && (
              <CashSourceField value={cashSource} onChange={setCashSource} />
            )}
          </div>

          <FieldGroup>
            <PaymentDetailsFields method={method} reference={reference} onReferenceChange={setReference} receipt={receipt} onReceiptChange={setReceipt} />
            <Field>
              <FieldLabel>Nota (opcional)</FieldLabel>
              <Input value={note} onChange={(e) => setNote(e.target.value.slice(0, 120))} placeholder="Ej: cajón de tomate de segunda" />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || total <= 0}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Registrar compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anular compra */}
      <Dialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">¿Anular esta compra?</DialogTitle>
            <DialogDescription>
              {voidTarget?.supplierName} · {voidTarget ? formatCLP(voidTarget.total) : ''}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se resta del stock lo que se había sumado y se borra su deuda y su pago en PASIVOS. Si el costo de los productos se había
            actualizado con esta compra, el costo NO vuelve al anterior: corrígelo en Stock si hace falta.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { if (voidTarget) onVoid(voidTarget.id); setVoidTarget(null) }}>Sí, anular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
