'use client'

import { useMemo, useState } from 'react'
import { Calculator, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { PaymentDetailsFields, ReceiptViewer, CashSourceField } from '@/components/payment-details'
import { saveReceipt } from '@/lib/receipt-store'
import { computeAccounting, formatCLP, type Expense, type MermaEntry, type Purchase, type Transaction } from '@/lib/store'
import { toast } from 'sonner'

// Contabilidad básica: control interno del dueño (ventas, compras, gastos, retiros y pérdidas).
// NO es contabilidad tributaria ni reemplaza lo que exige el SII.

export interface ExpenseInput {
  kind: 'gasto' | 'retiro'
  category: string
  amount: number
  method: 'cash' | 'transfer'
  cashSource?: 'caja' | 'dueno'
  note?: string
  receiptId?: string
}

interface AccountingProps {
  open: boolean
  onClose: () => void
  transactions: Transaction[]
  purchases: Purchase[]
  expenses: Expense[]
  mermaLog: MermaEntry[]
  onAddExpense: (input: ExpenseInput) => void
  onVoidExpense: (id: string) => void
  onVerifyTransfer: (saleId: string) => void
}

type Period = 'hoy' | '7d' | 'mes'
const CATEGORIES: Record<'gasto' | 'retiro', string[]> = {
  gasto: ['Bolsas y embalaje', 'Flete / bencina', 'Comida y bebida del puesto', 'Patente y permisos', 'Arriendo / puesto', 'Otros gastos'],
  retiro: ['Retiro personal', 'Retiro para gastos de la casa', 'Otro retiro'],
}

function range(period: Period): { from: Date; to: Date; label: string } {
  const now = new Date()
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  if (period === '7d') { from.setDate(from.getDate() - 6); return { from, to: now, label: 'Últimos 7 días' } }
  if (period === 'mes') { from.setDate(1); return { from, to: now, label: 'Este mes' } }
  return { from, to: now, label: 'Hoy' }
}

const Row = ({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'neg' | 'pos' | 'muted' }) => (
  <div className={`flex justify-between text-sm py-0.5 ${strong ? 'font-semibold' : ''}`}>
    <span className={tone === 'muted' ? 'text-muted-foreground' : ''}>{label}</span>
    <span className={tone === 'neg' ? 'text-destructive' : tone === 'pos' ? 'text-green-600' : ''}>{value}</span>
  </div>
)

export function Accounting({ open, onClose, transactions, purchases, expenses, mermaLog, onAddExpense, onVoidExpense, onVerifyTransfer }: AccountingProps) {
  const [period, setPeriod] = useState<Period>('hoy')
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<'gasto' | 'retiro'>('gasto')
  const [category, setCategory] = useState(CATEGORIES.gasto[0])
  const [amountText, setAmountText] = useState('')
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash')
  const [cashSource, setCashSource] = useState<'caja' | 'dueno' | null>(null)
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { from, to, label } = range(period)
  const acc = useMemo(
    () => computeAccounting({ transactions, purchases, expenses, mermaLog, from, to }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, purchases, expenses, mermaLog, period]
  )
  // Transferencias que quedaron "por verificar" de CUALQUIER día: después de cerrar el turno ya no se pueden confirmar en el Cierre.
  const pendingTransfers = transactions.filter(t => t.type === 'transfer' && t.verified === false)
  const periodExpenses = expenses.filter(e => { const t = new Date(e.date).getTime(); return t >= from.getTime() && t <= to.getTime() })

  const reset = () => { setAmountText(''); setNote(''); setReceipt(null); setMethod('cash'); setCashSource(null) }

  const save = async () => {
    const amount = Math.round(Number(amountText))
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Ingresa un monto mayor a $0.'); return }
    // Un retiro siempre sale del cajón; un gasto en efectivo puede haber salido del cajón o del bolsillo del dueño.
    if (kind === 'gasto' && method === 'cash' && !cashSource) { toast.error('Indica de dónde salió el efectivo: del cajón o de tu bolsillo.'); return }
    setSaving(true)
    try {
      let receiptId: string | undefined
      if (receipt) {
        receiptId = await saveReceipt(receipt)
        if (!receiptId) toast.warning('No se pudo guardar la foto; se registró sin ella.')
      }
      onAddExpense({ kind, category, amount, method, cashSource: kind === 'gasto' && method === 'cash' ? (cashSource ?? undefined) : undefined, note: note.trim() || undefined, receiptId })
      reset()
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calculator className="w-5 h-5" /> Contabilidad básica</DialogTitle>
          <DialogDescription>
            Control interno del puesto: cuánto vendiste, compraste, gastaste y retiraste. Es un resumen de caja simple, no una contabilidad tributaria.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          {(['hoy', '7d', 'mes'] as Period[]).map(p => (
            <Button key={p} size="sm" variant={period === p ? 'default' : 'outline'} onClick={() => setPeriod(p)}>
              {p === 'hoy' ? 'Hoy' : p === '7d' ? '7 días' : 'Este mes'}
            </Button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground self-center">{label}</span>
        </div>

        <div className="rounded-lg border p-3">
          <p className="text-sm font-semibold mb-1">Ventas ({acc.sales.count})</p>
          <Row label="Efectivo (va al cajón)" value={formatCLP(acc.sales.cash)} />
          <Row label="Transferencia (voucher)" value={formatCLP(acc.sales.transfer)} />
          <Row label="Mercado Pago" value={formatCLP(acc.sales.mercadopago)} />
          <Row label="Total vendido" value={formatCLP(acc.sales.total)} strong />
          {acc.sales.transferUnverified > 0 && (
            <p className="text-xs text-amber-600 mt-1">⚠ {acc.sales.transferUnverified} transferencia(s) por verificar en el banco en este período.</p>
          )}
          {acc.discountsGiven > 0 && <Row label="Rebaja otorgada (regalos, remates, descuentos)" value={formatCLP(acc.discountsGiven)} tone="muted" />}
        </div>

        <div className="rounded-lg border p-3">
          <p className="text-sm font-semibold mb-1">Salidas</p>
          <Row label="Compras de mercadería" value={`-${formatCLP(acc.purchases.total)}`} tone="neg" />
          {acc.purchases.pending > 0 && <Row label="   de las cuales quedan por pagar" value={formatCLP(acc.purchases.pending)} tone="muted" />}
          <Row label="Gastos del puesto" value={`-${formatCLP(acc.expenses)}`} tone="neg" />
          <Row label="Resultado simple (ventas − compras − gastos; compras a su valor total)" value={formatCLP(acc.result)} strong tone={acc.result < 0 ? 'neg' : 'pos'} />
          <Row label="Retiros del dueño" value={`-${formatCLP(acc.withdrawals)}`} tone="neg" />
          <Row label="Queda después de retiros" value={formatCLP(acc.afterWithdrawals)} strong tone={acc.afterWithdrawals < 0 ? 'neg' : 'pos'} />
        </div>

        <div className="rounded-lg border p-3">
          <p className="text-sm font-semibold mb-1">Pérdidas (a costo)</p>
          <Row label="Merma (se echó a perder)" value={formatCLP(acc.losses.merma)} tone="muted" />
          <Row label="Regalos de stock" value={formatCLP(acc.losses.regalo)} tone="muted" />
          <Row label="Faltantes detectados al contar" value={formatCLP(acc.losses.conteo)} tone="muted" />
          <Row label="Total perdido" value={formatCLP(acc.losses.total)} strong />
          <p className="text-[11px] text-muted-foreground mt-1">Ya está incluido en tus compras: es lo que compraste y no se vendió.</p>
        </div>

        <div className="rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Impuesto de Ferias Libres (Ley 21.745) — referencial</p>
          <p>
            Si estás inscrito en el Registro de Feriantes del SII, tus ventas pagadas por medios electrónicos de un operador autorizado por el SII pagan un impuesto
            sustitutivo del IVA de 1,5 %, que retiene y declara el operador. Sobre tus ventas con Mercado Pago del período serían{' '}
            <strong className="text-foreground">{formatCLP(acc.electronicReference)}</strong> (solo si Mercado Pago figura como operador autorizado).
          </p>
          <p>Cómo tributan el efectivo y las transferencias directas, y si debes llevar contabilidad, consúltalo con el SII o un contador. Esta pantalla no lo determina.</p>
        </div>

        {pendingTransfers.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
            <p className="text-sm font-semibold text-amber-900">Transferencias por verificar en el banco ({pendingTransfers.length})</p>
            {pendingTransfers.slice().reverse().map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0 text-amber-900">
                  <p className="font-medium">{formatCLP(t.total)}</p>
                  <p className="text-xs">
                    {new Date(t.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {t.reference ? ` · Op. ${t.reference}` : ''} <ReceiptViewer receiptId={t.receiptId} />
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onVerifyTransfer(t.id)}>Ya llegó al banco</Button>
              </div>
            ))}
            <p className="text-[11px] text-amber-800">Si el abono nunca llegó, ese dinero no entró: habla con el cliente antes de contarlo como vendido.</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Gastos y retiros</p>
            <Button size="sm" onClick={() => setAdding(a => !a)} className="gap-1"><Plus className="w-4 h-4" /> Registrar</Button>
          </div>

          {adding && (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(['gasto', 'retiro'] as const).map(k => (
                  <Button key={k} type="button" variant={kind === k ? 'default' : 'outline'}
                    onClick={() => { setKind(k); setCategory(CATEGORIES[k][0]) }}>
                    {k === 'gasto' ? 'Gasto del puesto' : 'Retiro del dueño'}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Categoría</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm">
                    {CATEGORIES[kind].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Monto ($)</label>
                  <Input type="number" inputMode="numeric" min="0" value={amountText} onChange={(e) => setAmountText(e.target.value)} className="h-10" placeholder="Ej: 5000" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Salió de</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value as 'cash' | 'transfer')} className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm">
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia / banco</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Nota (opcional)</label>
                  <Input value={note} onChange={(e) => setNote(e.target.value.slice(0, 100))} className="h-10" />
                </div>
              </div>
              <FieldGroup>
                <PaymentDetailsFields method="cash" reference="" onReferenceChange={() => {}} receipt={receipt} onReceiptChange={setReceipt} />
              </FieldGroup>
              {kind === 'gasto' && method === 'cash' && <CashSourceField value={cashSource} onChange={setCashSource} />}
              {kind === 'retiro' && method === 'cash' && <p className="text-xs text-muted-foreground">Un retiro sale del cajón: se descuenta del efectivo esperado en el arqueo del turno.</p>}
              <Button onClick={save} disabled={saving} className="w-full">{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Guardar</Button>
            </div>
          )}

          {periodExpenses.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin gastos ni retiros en este período.</p>
          ) : periodExpenses.slice().reverse().map(e => (
            <div key={e.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-secondary/30 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{e.category} <Badge variant="outline" className="text-[10px] ml-1">{e.kind === 'retiro' ? 'Retiro' : 'Gasto'}</Badge></p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {e.method === 'cash' ? 'Efectivo' : 'Transferencia'}{e.note ? ` · ${e.note}` : ''} <ReceiptViewer receiptId={e.receiptId} />
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-destructive">-{formatCLP(e.amount)}</p>
                <button className="text-[10px] text-destructive underline" onClick={() => onVoidExpense(e.id)}>Anular</button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
