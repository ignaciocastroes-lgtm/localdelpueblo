'use client'

import { useState, useEffect } from 'react'
import { 
  Calculator, 
  Banknote, 
  CreditCard, 
  Package, 
  User, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  FileText,
  X,
  Send,
  Loader2,
  Users
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCLP, computeCashSession, type Expense, type PayablePayment } from '@/lib/store'
import { ReceiptViewer } from '@/components/payment-details'
import { toast } from 'sonner'

interface SaleRecord {
  id: string
  items: { productId: string; productName: string; quantity: number; price: number; lineTotal?: number; listTotal?: number; discountLabel?: string; soldWithoutStock?: boolean }[]
  total: number
  type: 'cash' | 'credit' | 'mercadopago' | 'transfer'
  reference?: string
  receiptId?: string
  verified?: boolean
  date: string
  memberName?: string
  vendorId?: string
  vendorName?: string
  rounding?: number
}

interface DailyClosureProps {
  open: boolean
  onClose: () => void
  currentShift: string
  sales: SaleRecord[]
  cashFloatStart: number
  supplierPayments: PayablePayment[] // pagos a proveedores registrados durante el turno
  expenses: Expense[]                // gastos y retiros registrados durante el turno
  countedThisShift: boolean          // ¿ya se hizo el conteo de stock del cierre?
  onVerifyTransfer: (saleId: string) => void
  onResetSession: (cashData: { cashCounted: number | null; cashDifference: number | null; sentToMake: boolean }) => void
}

export function DailyClosure({ 
  open, 
  onClose, 
  currentShift, 
  sales, 
  cashFloatStart,
  supplierPayments,
  expenses,
  countedThisShift,
  onVerifyTransfer,
  onResetSession 
}: DailyClosureProps) {
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [closureComplete, setClosureComplete] = useState(false)
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [closureSnapshot, setClosureSnapshot] = useState<{ total: number; date: string; time: string; shift: string; cashDifference: number | null } | null>(null)
  const [cashCounted, setCashCounted] = useState('')

  useEffect(() => {
    if (open) { setSendState('idle'); setClosureSnapshot(null); setCashCounted('') }
  }, [open])

  // Calculate totals
  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0)
  const cashSales = sales.filter(s => s.type === 'cash').reduce((sum, sale) => sum + sale.total, 0)
  const creditSales = sales.filter(s => s.type === 'credit').reduce((sum, sale) => sum + sale.total, 0)
  const mercadopagoSales = sales.filter(s => s.type === 'mercadopago').reduce((sum, sale) => sum + sale.total, 0)
  
  // Count units sold per product
  const productsSold: Record<string, { name: string; quantity: number; total: number }> = {}
  sales.forEach(sale => {
    sale.items.forEach(item => {
      if (!productsSold[item.productId]) {
        productsSold[item.productId] = { name: item.productName, quantity: 0, total: 0 }
      }
      productsSold[item.productId].quantity += item.quantity
      productsSold[item.productId].total += (item as any).lineTotal ?? item.price * item.quantity
    })
  })
  
  const sortedProducts = Object.entries(productsSold)
    .sort((a, b) => b[1].quantity - a[1].quantity)

  const totalUnits = Object.values(productsSold).reduce((sum, p) => sum + p.quantity, 0)

  // Desglose por vendedor (útil para el libro real coordinado con Make)
  const salesByVendor: Record<string, { name: string; count: number; total: number }> = {}
  sales.forEach(sale => {
    const key = sale.vendorName || 'Sin asignar'
    if (!salesByVendor[key]) salesByVendor[key] = { name: key, count: 0, total: 0 }
    salesByVendor[key].count += 1
    salesByVendor[key].total += sale.total
  })
  const sortedVendors = Object.values(salesByVendor).sort((a, b) => b.total - a.total)

  // Arqueo de caja: lo que debería haber en efectivo vs lo que el
  // vendedor cuenta físicamente al cerrar.
  const session = computeCashSession({ cashFloatStart, sales, supplierPayments, expenses })
  const transferSales = sales.filter(s => s.type === 'transfer').reduce((sum, sale) => sum + sale.total, 0)
  const transfers = sales.filter(s => s.type === 'transfer')
  const unverifiedTransfers = transfers.filter(s => s.verified === false)
  // Regalos, remates y descuentos: lo que valían las líneas sin descuento menos lo cobrado
  const discountsByLabel: Record<string, number> = {}
  sales.forEach(sale => sale.items.forEach(i => {
    if (i.listTotal !== undefined && i.lineTotal !== undefined && i.listTotal > i.lineTotal) {
      const key = i.discountLabel || 'Descuento'
      discountsByLabel[key] = (discountsByLabel[key] || 0) + (i.listTotal - i.lineTotal)
    }
  }))
  const soldWithoutStock = Array.from(new Set(sales.flatMap(sale => sale.items.filter(i => i.soldWithoutStock).map(i => i.productName))))
  const cashExpected = session.cashExpected
  // Diferencia por el redondeo a $10 en efectivo (cobrado − suma de las líneas): explica por qué la suma por producto puede no calzar.
  const roundingTotal = sales.reduce((sum, sale) => sum + (sale.rounding || 0), 0)
  const methodLabel = (m: string) => m === 'cash' ? 'Efectivo' : m === 'transfer' ? 'Transferencia' : 'Tarjeta'
  const cashCountedNum = cashCounted === '' ? null : parseInt(cashCounted)
  const cashDifference = (cashCountedNum !== null && !isNaN(cashCountedNum)) ? cashCountedNum - cashExpected : null

  const buildClosurePayload = () => ({
    fecha: currentDate.toISOString(),
    turno: currentShift,
    totalVentas: totalSales,
    cantidadVentas: sales.length,
    unidadesVendidas: totalUnits,
    desglosePorMetodo: { efectivo: cashSales, transferencia: transferSales, mercadopago: mercadopagoSales },
    transferenciasPorVerificar: unverifiedTransfers.length,
    regalosRematesYDescuentos: discountsByLabel,
    ventasSinStockRegistrado: soldWithoutStock,
    gastosYRetiros: expenses.map(e => ({ fecha: e.date, tipo: e.kind, categoria: e.category, monto: e.amount, medio: e.method, origenEfectivo: e.method === 'cash' ? (e.cashSource === 'dueno' ? 'bolsillo' : 'cajon') : null })),
    conteoDeStockHecho: countedThisShift,
    desglosePorVendedor: sortedVendors,
    productosVendidos: sortedProducts.map(([productId, data]) => ({ productId, ...data })),
    arqueoDeCaja: {
      fondoInicial: cashFloatStart,
      ventasEfectivo: session.cashSales,
      pagosProveedoresEfectivo: session.supplierCashOut,
      gastosYRetirosEfectivo: session.expenseCashOut,
      pagadoConBolsilloDelDueno: session.ownerCashOut,
      efectivoEsperado: cashExpected,
      efectivoContado: cashCountedNum,
      diferencia: cashDifference,
    },
    pagosProveedores: supplierPayments.map(p => ({ fecha: p.date, proveedor: p.supplierName, monto: p.amount, metodo: p.method, origenEfectivo: p.method === 'cash' ? (p.cashSource === 'dueno' ? 'bolsillo' : 'cajon') : null, referencia: p.reference || null, conComprobante: !!p.receiptId })),
    ventas: sales,
  })

  const handleSendToMake = async () => {
    setSendState('sending')
    try {
      const res = await fetch('/api/make/cierre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildClosurePayload()),
      })
      if (!res.ok) throw new Error('respuesta no ok')
      setSendState('sent')
      toast.success('Cierre enviado al libro (Make)')
    } catch (e) {
      setSendState('error')
      toast.error('No se pudo enviar a Make. Revisa MAKE_WEBHOOK_URL en Vercel.')
    }
  }

  const handleReset = () => {
    // Ojo: hay que "fotografiar" el total ANTES de resetear la sesión,
    // porque onResetSession() vacía `sales` y la pantalla de confirmación
    // se renderiza después, con sales=[] (mostraría $0 si no hiciéramos esto).
    setClosureSnapshot({
      total: totalSales,
      date: formattedDate,
      time: formattedTime,
      shift: currentShift,
      cashDifference,
    })
    onResetSession({ cashCounted: cashCountedNum, cashDifference, sentToMake: sendState === 'sent' })
    setClosureComplete(true)
    setShowConfirmReset(false)
  }

  const handleClose = () => {
    setClosureComplete(false)
    setShowConfirmReset(false)
    onClose()
  }

  const currentDate = new Date()
  const formattedDate = currentDate.toLocaleDateString('es-CL', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  const formattedTime = currentDate.toLocaleTimeString('es-CL', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })

  if (closureComplete) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-bold mb-2">Cierre Completado</h2>
            <p className="text-muted-foreground mb-4">
              El cierre de caja ha sido registrado exitosamente.
            </p>
            <div className="bg-muted rounded-lg p-4 w-full text-left text-sm space-y-1">
              <p><strong>Fecha:</strong> {closureSnapshot?.date || formattedDate}</p>
              <p><strong>Hora:</strong> {closureSnapshot?.time || formattedTime}</p>
              <p><strong>Turno:</strong> {closureSnapshot?.shift || currentShift}</p>
              <p><strong>Total Vendido:</strong> {formatCLP(closureSnapshot?.total ?? totalSales)}</p>
              {closureSnapshot?.cashDifference !== null && closureSnapshot?.cashDifference !== undefined && (
                <p>
                  <strong>Arqueo de caja:</strong>{' '}
                  <span className={closureSnapshot.cashDifference === 0 ? 'text-success' : closureSnapshot.cashDifference > 0 ? 'text-sky-600' : 'text-destructive'}>
                    {closureSnapshot.cashDifference === 0 ? 'Cuadrada' : closureSnapshot.cashDifference > 0 ? `Sobrante ${formatCLP(closureSnapshot.cashDifference)}` : `Faltante ${formatCLP(Math.abs(closureSnapshot.cashDifference))}`}
                  </span>
                </p>
              )}
            </div>
            <Button onClick={handleClose} className="mt-6 w-full">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Calculator className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-xl">Cierre de Caja</DialogTitle>
              <DialogDescription>
                Resumen de ventas del turno actual
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6">
          {/* Shift Info */}
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Cajero:</span>
                  <Badge variant="secondary" className="font-semibold">
                    {currentShift}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {formattedDate} - {formattedTime}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Sales Card */}
          <Card className="mb-4 border-2 border-success/30 bg-success/5">
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Total Ventas del Turno</p>
                <p className="text-4xl font-bold text-success">
                  {formatCLP(totalSales)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {sales.length} ventas | {totalUnits} unidades vendidas
                </p>
                {roundingTotal !== 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Incluye {roundingTotal > 0 ? '+' : '−'}{formatCLP(Math.abs(roundingTotal))} de redondeo a $10 en efectivo.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Breakdown */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Desglose por Método de Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Efectivo</p>
                    <p className="text-xs text-muted-foreground">
                      {sales.filter(s => s.type === 'cash').length} transacciones
                    </p>
                  </div>
                </div>
                <p className="text-lg font-bold text-green-600">{formatCLP(cashSales)}</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center text-emerald-700 text-lg">🏦</div>
                  <div>
                    <p className="font-medium">Transferencia</p>
                    <p className="text-xs text-muted-foreground">
                      {transfers.length} transacciones{unverifiedTransfers.length > 0 ? ` · ${unverifiedTransfers.length} por verificar` : ''}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-bold text-emerald-700">{formatCLP(transferSales)}</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-sky-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Mercado Pago</p>
                    <p className="text-xs text-muted-foreground">
                      {sales.filter(s => s.type === 'mercadopago').length} transacciones
                    </p>
                  </div>
                </div>
                <p className="text-lg font-bold text-sky-600">{formatCLP(mercadopagoSales)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Arqueo de Caja */}
          <Card className="mb-4 border-amber-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Arqueo de Caja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fondo inicial del turno</span>
                <span className="font-medium">{formatCLP(cashFloatStart)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">+ Ventas en efectivo</span>
                <span className="font-medium">{formatCLP(session.cashSales)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">− Pagos a proveedores en efectivo ({session.supplierCashCount})</span>
                <span className="font-medium text-destructive">-{formatCLP(session.supplierCashOut)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">− Gastos y retiros en efectivo ({session.expenseCashCount})</span>
                <span className="font-medium text-destructive">-{formatCLP(session.expenseCashOut)}</span>
              </div>
              {session.ownerCashCount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Pagado con tu bolsillo ({session.ownerCashCount}): no toca el cajón</span>
                  <span className="text-muted-foreground">{formatCLP(session.ownerCashOut)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-sm font-semibold">
                <span>Efectivo esperado en caja</span>
                <span>{formatCLP(cashExpected)}</span>
              </div>
              <div className="pt-1">
                <label className="text-sm text-muted-foreground mb-1 block">Efectivo contado físicamente</label>
                <input
                  type="number"
                  value={cashCounted}
                  onChange={(e) => setCashCounted(e.target.value)}
                  placeholder="Cuenta el efectivo y anota el total"
                  className="w-full h-11 rounded-md border border-input bg-background px-3 text-base"
                />
              </div>
              {cashDifference !== null && (
                <div className={`flex justify-between items-center p-3 rounded-lg font-semibold ${
                  cashDifference === 0 ? 'bg-success/10 text-success' : cashDifference > 0 ? 'bg-sky-500/10 text-sky-600' : 'bg-destructive/10 text-destructive'
                }`}>
                  <span>{cashDifference === 0 ? 'Caja cuadrada' : cashDifference > 0 ? 'Sobrante' : 'Faltante'}</span>
                  <span>{formatCLP(Math.abs(cashDifference))}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagos a proveedores del turno */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Compras y Pagos a Proveedores del Turno
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {supplierPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hubo compras ni pagos a proveedores en este turno.</p>
              ) : (
                <>
                  {supplierPayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5">
                      <div>
                        <p className="text-sm font-medium">{p.supplierName}</p>
                        <p className="text-xs text-muted-foreground">
                          {methodLabel(p.method)}{p.method === 'cash' && p.cashSource === 'dueno' ? ' (de tu bolsillo)' : ''}{p.reference ? ` · Op. ${p.reference}` : ''} <ReceiptViewer receiptId={p.receiptId} />
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-destructive">-{formatCLP(p.amount)}</span>
                    </div>
                  ))}
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Fuera del cajón (no afectan el arqueo): transferencias {formatCLP(session.supplierOtherOut.transfer)} · tarjeta {formatCLP(session.supplierOtherOut.card)}.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Transferencias: verificar en el banco */}
          {transfers.length > 0 && (
            <Card className="mb-4 border-emerald-600/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">🏦 Transferencias del turno</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {transfers.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-600/5">
                    <div>
                      <p className="text-sm font-medium">{formatCLP(t.total)}{t.reference ? ` · Op. ${t.reference}` : ''}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} <ReceiptViewer receiptId={t.receiptId} />
                      </p>
                    </div>
                    {t.verified === false ? (
                      <Button size="sm" variant="outline" className="border-amber-500 text-amber-700" onClick={() => onVerifyTransfer(t.id)}>Ya está en el banco</Button>
                    ) : (
                      <Badge variant="outline" className="text-emerald-700">Verificada ✓</Badge>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Las transferencias no entran al cajón: no afectan el arqueo.</p>
              </CardContent>
            </Card>
          )}

          {/* Gastos y retiros del turno */}
          {expenses.length > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Gastos y Retiros del Turno</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {expenses.map(e => (
                  <div key={e.id} className="flex justify-between text-sm">
                    <span>{e.category} <span className="text-xs text-muted-foreground">({e.kind === 'retiro' ? 'retiro' : 'gasto'} · {e.method === 'cash' ? (e.cashSource === 'dueno' ? 'efectivo de tu bolsillo' : 'efectivo') : 'transferencia'})</span></span>
                    <span className="text-destructive font-medium">-{formatCLP(e.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Regalos, remates y descuentos */}
          {Object.keys(discountsByLabel).length > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Regalos, Remates y Descuentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(discountsByLabel).map(([label, amount]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span>{label}</span><span className="font-medium">{formatCLP(amount)}</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Rebaja respecto del precio normal (no incluye el redondeo de efectivo).</p>
              </CardContent>
            </Card>
          )}

          {/* Vendido estando apagado o sin stock registrado */}
          {soldWithoutStock.length > 0 && (
            <Card className="mb-4 border-amber-500/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700"><AlertTriangle className="w-4 h-4" /> Vendido sin stock registrado</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{soldWithoutStock.join(', ')}</p>
                <p className="text-xs text-muted-foreground mt-1">Se anotó la venta igual. Corrige el stock en el conteo del cierre.</p>
              </CardContent>
            </Card>
          )}

          {/* Vendor Breakdown */}
          {sortedVendors.length > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Desglose por Vendedor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sortedVendors.map(v => (
                  <div key={v.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.count} ventas</p>
                    </div>
                    <span className="text-sm font-bold">{formatCLP(v.total)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Units Sold */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4" />
                Productos Vendidos ({totalUnits} unidades)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedProducts.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No hay ventas registradas en este turno
                </p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {sortedProducts.map(([productId, data]) => (
                    <div 
                      key={productId}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-8 h-8 p-0 flex items-center justify-center font-bold">
                          {data.quantity}
                        </Badge>
                        <span className="text-sm font-medium">{data.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatCLP(data.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        <Separator />

        <DialogFooter className="p-6 pt-4 gap-2 sm:gap-2">
          {!showConfirmReset ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                <X className="w-4 h-4 mr-2" />
                Cerrar
              </Button>
              <Button
                variant="outline"
                onClick={handleSendToMake}
                disabled={sales.length === 0 || sendState === 'sending'}
              >
                {sendState === 'sending' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {sendState === 'sent' ? 'Enviado al libro ✓' : 'Enviar cierre al libro (Make)'}
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => setShowConfirmReset(true)}
                disabled={sales.length === 0}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Finalizar Turno y Resetear
              </Button>
            </>
          ) : (
            <div className="w-full">
              {unverifiedTransfers.length > 0 && (
                <div className="bg-amber-100 border border-amber-300 text-amber-900 rounded-lg p-3 mb-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>Tienes <strong>{unverifiedTransfers.length} transferencia(s) sin verificar</strong> en el banco. Confírmalas antes de finalizar.</p>
                </div>
              )}
              {!countedThisShift && (
                <div className="bg-amber-100 border border-amber-300 text-amber-900 rounded-lg p-3 mb-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>Aún no hiciste el <strong>conteo de stock</strong>. Mañana el puesto parte con lo que quede registrado: cierra esta pantalla y usa CONTEO DE STOCK.</p>
                </div>
              )}
              {sendState !== 'sent' && (
                <div className="bg-amber-100 border border-amber-300 text-amber-900 rounded-lg p-3 mb-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>
                    Este cierre <strong>todavía no se envió al libro (Make)</strong>. Al finalizar, las ventas del turno
                    salen de esta pantalla. Cancela y usa &quot;Enviar cierre al libro&quot; antes de resetear.
                  </p>
                </div>
              )}
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-destructive">Confirmar Cierre de Caja</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Esta acción finalizará el turno actual y reseteará el contador de ventas a $0.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowConfirmReset(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleReset}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirmar Cierre
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
