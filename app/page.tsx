'use client'

import { useState, useEffect } from 'react'
import { ShoppingCart, Package, Calculator, Lock, Truck } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { Header } from '@/components/header'
import { POSTerminal } from '@/components/pos-terminal'
import { AdminInventory } from '@/components/admin-inventory'
import { DailyClosure } from '@/components/daily-closure'
import { ShiftSelector } from '@/components/shift-selector'
import { PinNumpad } from '@/components/pin-numpad'
import { Payables } from '@/components/payables'
import { loadFromStorage, saveToStorage, StorageKeys, defaultProducts, defaultSellers, formatCLP, applyItemDiscount, type Seller, type Transaction, type CartItem, type Payable, type PayablePayment, type ClosureLogEntry, type MermaEntry } from '@/lib/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [seccion, setSeccion] = useState('venta')

  const [sellers, setSellers] = useState<Seller[]>([])
  const [currentSeller, setCurrentSeller] = useState<Seller | null>(null)
  const [adminPin, setAdminPin] = useState('1234')
  const [showShiftSelector, setShowShiftSelector] = useState(false)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [pendingTab, setPendingTab] = useState<string | null>(null)
  const [showClosure, setShowClosure] = useState(false)

  // Arqueo de caja
  const [cashFloatStart, setCashFloatStart] = useState<number | null>(null)
  const [showCashFloatDialog, setShowCashFloatDialog] = useState(false)
  const [cashFloatInput, setCashFloatInput] = useState('')

  // Pasivos (cuentas por pagar a proveedores)
  const [payables, setPayables] = useState<Payable[]>([])
  const [payablePayments, setPayablePayments] = useState<PayablePayment[]>([])

  // Merma: lo que se pierde sin vender (distinto del descuento manual, que sí vende)
  const [mermaLog, setMermaLog] = useState<MermaEntry[]>([])

  // Historial real, persistente entre turnos (no se resetea al hacer cierre de caja)
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])

  // Estructura de ventas idéntica a tu Backup
  const [sessionSales, setSessionSales] = useState<{
    id: string
    items: any[]
    total: number
    type: 'cash' | 'mercadopago' | string
    date: string
    vendorId?: string
    vendorName?: string
  }[]>([])

  useEffect(() => {
    try {
      const p = loadFromStorage(StorageKeys.PRODUCTS, defaultProducts)
      const sellersLoaded = loadFromStorage(StorageKeys.SELLERS, defaultSellers)
      const pin = loadFromStorage(StorageKeys.ADMIN_PIN, '1234')
      const s = loadFromStorage<Seller | null>(StorageKeys.CURRENT_SELLER, null)
      const sales = loadFromStorage(StorageKeys.SESSION_SALES, [])
      const txs = loadFromStorage<Transaction[]>(StorageKeys.ALL_TRANSACTIONS, [])
      const floatStart = loadFromStorage<number | null>(StorageKeys.CASH_FLOAT, null)
      const payablesLoaded = loadFromStorage<Payable[]>(StorageKeys.PAYABLES, [])
      const payablePaymentsLoaded = loadFromStorage<PayablePayment[]>(StorageKeys.PAYABLE_PAYMENTS, [])
      const mermaLoaded = loadFromStorage<MermaEntry[]>(StorageKeys.MERMA_LOG, [])

      setProducts(Array.isArray(p) ? p : defaultProducts)
      setSellers(Array.isArray(sellersLoaded) && sellersLoaded.length > 0 ? sellersLoaded : defaultSellers)
      setAdminPin(pin || '1234')
      setSessionSales(Array.isArray(sales) ? sales : [])
      setAllTransactions(Array.isArray(txs) ? txs : [])
      setCashFloatStart(typeof floatStart === 'number' ? floatStart : null)
      setPayables(Array.isArray(payablesLoaded) ? payablesLoaded : [])
      setPayablePayments(Array.isArray(payablePaymentsLoaded) ? payablePaymentsLoaded : [])
      setMermaLog(Array.isArray(mermaLoaded) ? mermaLoaded : [])
      setCurrentSeller(s)
      if (!s) setShowShiftSelector(true)
    } catch (e) { console.error(e) }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      saveToStorage(StorageKeys.PRODUCTS, products)
      saveToStorage(StorageKeys.SESSION_SALES, sessionSales)
      saveToStorage(StorageKeys.SELLERS, sellers)
      saveToStorage(StorageKeys.ADMIN_PIN, adminPin)
      saveToStorage(StorageKeys.CURRENT_SELLER, currentSeller)
      saveToStorage(StorageKeys.ALL_TRANSACTIONS, allTransactions)
      saveToStorage(StorageKeys.CASH_FLOAT, cashFloatStart)
      saveToStorage(StorageKeys.PAYABLES, payables)
      saveToStorage(StorageKeys.PAYABLE_PAYMENTS, payablePayments)
      saveToStorage(StorageKeys.MERMA_LOG, mermaLog)
    }
  }, [products, sessionSales, sellers, adminPin, currentSeller, allTransactions, cashFloatStart, payables, payablePayments, mermaLog, mounted])

  // Mantiene la pantalla encendida mientras el kiosko está abierto (tablet
  // compartida): sin esto, la tablet se apaga sola a mitad de una venta.
  useEffect(() => {
    let wakeLock: any = null
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen')
        }
      } catch {
        // Algunos navegadores/tablets no lo soportan; no es crítico.
      }
    }
    requestWakeLock()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') requestWakeLock()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      wakeLock?.release?.().catch(() => {})
    }
  }, [])

  // Pide el fondo de caja inicial apenas se puede vender, si todavía no se
  // registró para este turno (sessionSales vacío = turno nuevo).
  useEffect(() => {
    if (mounted && !showShiftSelector && currentSeller && seccion === 'venta' && cashFloatStart === null && sessionSales.length === 0) {
      setShowCashFloatDialog(true)
    }
  }, [mounted, showShiftSelector, currentSeller, seccion, cashFloatStart, sessionSales.length])

  if (!mounted) return <div className="h-screen bg-[#0a1f16]" />

  const navegar = (v: string) => {
    if (['stock', 'reports', 'pasivos'].includes(v) && !isAdminUnlocked) {
      setPendingTab(v); setShowPin(true)
    } else if (v === 'venta' && cashFloatStart === null && sessionSales.length === 0) {
      setShowCashFloatDialog(true)
    } else {
      setSeccion(v)
    }
  }

  const confirmCashFloat = () => {
    const amount = parseInt(cashFloatInput) || 0
    setCashFloatStart(amount)
    setShowCashFloatDialog(false)
    setCashFloatInput('')
    setSeccion('venta')
  }

  // === FUNCIONES DE STOCK ===
  const updateProduct = (p: any) => setProducts(prev => prev.map(o => o.id === p.id ? p : o))
  const addProduct = (p: any) => { if (p) setProducts(prev => [...prev, p]) }
  const deleteProduct = (id: string) => setProducts(prev => prev.filter(p => p.id !== id))
  const clearDemoData = () => {
    setProducts([])
    toast.success('Catálogo de demostración vaciado. Ya puedes cargar tu producto real.')
  }

  // === MERMA: descuenta stock y deja registro trazable con motivo ===
  const registerMerma = (productId: string, cantidad: number, motivo: string) => {
    const product = products.find((p: any) => p.id === productId)
    if (!product) return
    setProducts((prev: any[]) => prev.map(p => p.id === productId ? { ...p, stock: Math.max(0, p.stock - cantidad) } : p))
    setMermaLog(prev => [...prev, {
      id: `merma-${Date.now()}`,
      productId,
      productName: product.name,
      cantidad,
      motivo,
      date: new Date().toISOString(),
    }])
  }

  // === VENDEDORES ===
  const addSeller = (s: Seller) => setSellers(prev => [...prev, s])
  const changeAdminPin = (pin: string) => setAdminPin(pin)

  // === PASIVOS (cuentas por pagar a proveedores) ===
  const addPayable = (p: Omit<Payable, 'id' | 'amountPaid' | 'status'>) => {
    setPayables(prev => [...prev, { ...p, id: `payable-${Date.now()}`, amountPaid: 0, status: 'pending' }])
  }
  const payPayable = (payableId: string, amount: number, method: 'cash' | 'transfer' | 'card') => {
    const payable = payables.find(p => p.id === payableId)
    if (!payable) return
    const newAmountPaid = payable.amountPaid + amount
    setPayables(prev => prev.map(p => p.id === payableId
      ? { ...p, amountPaid: newAmountPaid, status: newAmountPaid >= p.amount ? 'paid' : 'partial' }
      : p
    ))
    setPayablePayments(prev => [...prev, {
      id: `payable-payment-${Date.now()}`,
      payableId,
      supplierName: payable.supplierName,
      amount,
      date: new Date().toISOString(),
      method,
    }])
    toast.success(`Pago de ${formatCLP(amount)} a ${payable.supplierName} registrado`)
  }

  // === LÓGICA DE VENTA ===
  // `total` viene calculado desde el POS (ya incluye redondeo a $10 en
  // efectivo y los descuentos manuales aplicados por ítem) — no se recalcula
  // acá para no duplicar esa lógica en dos lugares.
  const handleSaleComplete = (items: CartItem[], type: 'cash' | 'mercadopago', total: number) => {
    try {
      // 1. Crear el registro para Cierre de Caja
      const saleRecord = {
        id: `sale-${Date.now()}`,
        items: items.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          // Precio final de esta línea (ya con descuento manual aplicado, si tenía).
          // Para productos por peso, esto ES el total de esa pesada, no un precio unitario.
          price: applyItemDiscount(item.itemTotal, item.discount),
          weightGrams: item.weightGrams,
        })),
        total,
        type,
        date: new Date().toISOString(),
        vendorId: currentSeller?.id,
        vendorName: currentSeller?.name,
      }
      setSessionSales(prev => [...prev, saleRecord])

      // 1b. Registrar también en el historial permanente
      const transactionRecord: Transaction = {
        id: saleRecord.id,
        memberId: null,
        items: saleRecord.items,
        total,
        type,
        date: saleRecord.date,
        shift: currentSeller?.name || '',
      }
      setAllTransactions(prev => [...prev, transactionRecord])

      toast.success(`Venta de ${formatCLP(total)} completada exitosamente`)

      // 2. Descontar Stock de los productos (en gramos para saleType 'peso')
      setProducts(prev => {
        const updated = [...prev]
        items.forEach(item => {
          const idx = updated.findIndex(p => p.id === item.product.id)
          if (idx < 0) return
          const cantidadDescontar = item.product.saleType === 'peso' ? (item.weightGrams || 0) : item.quantity
          updated[idx] = { ...updated[idx], stock: Math.max(0, updated[idx].stock - cantidadDescontar) }
        })
        return updated
      })

    } catch (e) {
      console.error(e)
      toast.error("Ocurrió un error al procesar los datos de la venta.")
    }
  }

  // === FINALIZAR TURNO: archiva el cierre y limpia el fondo de caja ===
  const handleFinalizeShift = (cashData: { cashCounted: number | null; cashDifference: number | null }) => {
    const totalVentas = sessionSales.reduce((sum, s) => sum + s.total, 0)
    const cashSales = sessionSales.filter(s => s.type === 'cash').reduce((sum, s) => sum + s.total, 0)
    const entry: ClosureLogEntry = {
      id: `closure-${Date.now()}`,
      date: new Date().toISOString(),
      shift: currentSeller?.name || '',
      totalSales: totalVentas,
      cashFloatStart: cashFloatStart || 0,
      cashExpected: (cashFloatStart || 0) + cashSales,
      cashCounted: cashData.cashCounted,
      cashDifference: cashData.cashDifference,
      sentToMake: false,
    }
    const log = loadFromStorage<ClosureLogEntry[]>(StorageKeys.CLOSURES_LOG, [])
    saveToStorage(StorageKeys.CLOSURES_LOG, [...log, entry].slice(-90)) // guarda los últimos 90 cierres

    setSessionSales([])
    setCashFloatStart(null)
  }

  const navButtons = [
    { key: 'venta', label: 'VENTA', icon: ShoppingCart, admin: false },
    { key: 'stock', label: 'STOCK', icon: Package, admin: true },
    { key: 'pasivos', label: 'PASIVOS', icon: Truck, admin: true },
    { key: 'reports', label: 'CIERRE', icon: Calculator, admin: false },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col notranslate">
      <Header currentShift={currentSeller?.name} products={products} onNavigateToInventory={() => navegar('stock')} onEndShift={() => { setCurrentSeller(null); setShowShiftSelector(true); setIsAdminUnlocked(false); }} />

      <div className="bg-[#0a1f16] p-3 flex justify-center gap-2 border-b border-emerald-600/20">
        {navButtons.map(({ key, label, icon: Icon, admin }) => (
          <button
            key={key}
            onClick={() => navegar(key)}
            className={`flex-1 max-w-[110px] py-3 rounded-xl font-bold text-[11px] flex flex-col items-center gap-1 transition-all relative ${seccion === key ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-slate-900 text-slate-500'}`}
          >
            <Icon className="w-4 h-4" /> {label}
            {admin && !isAdminUnlocked && <Lock className="w-2 h-2 absolute top-2 right-2 opacity-50 text-red-500" />}
          </button>
        ))}
      </div>

      <main className="flex-1 p-4 overflow-hidden">
        <div className={seccion === 'venta' ? 'h-full block' : 'hidden'}>
          <POSTerminal products={products} onSaleComplete={handleSaleComplete} />
        </div>
        <div className={seccion === 'stock' ? 'block' : 'hidden'}>
          <AdminInventory products={products} adminPin={adminPin} onUpdateProduct={updateProduct} onAddProduct={addProduct} onDeleteProduct={deleteProduct} onBulkUpdateProducts={(upd: any) => setProducts(upd)} onChangeAdminPin={changeAdminPin} onClearDemoData={clearDemoData} onRegisterMerma={registerMerma} mermaLog={mermaLog} />
        </div>
        <div className={seccion === 'pasivos' ? 'block' : 'hidden'}>
          <Payables payables={payables} payments={payablePayments} onAddPayable={addPayable} onPayPayable={payPayable} />
        </div>
        <div className={seccion === 'reports' ? 'block' : 'hidden'}>
          <div className="flex items-center justify-center h-full">
            <Card className="bg-slate-900 border-emerald-600/30 p-8 text-center max-w-sm w-full">
              <Calculator className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">CIERRE DE CAJA</h2>
              <p className="text-slate-400 mb-6 font-mono text-lg">Operaciones hoy: {sessionSales.length}</p>
              <p className="text-emerald-400 mb-8 font-mono text-4xl font-bold">{formatCLP(sessionSales.reduce((sum, s) => sum + s.total, 0))}</p>
              <Button onClick={() => setShowClosure(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold text-white py-6 text-lg shadow-lg shadow-emerald-600/20">GENERAR REPORTE</Button>
            </Card>
          </div>
        </div>
      </main>

      <ShiftSelector
        open={showShiftSelector}
        sellers={sellers}
        adminPin={adminPin}
        onSelect={(s: Seller) => {
          setCurrentSeller(s)
          setShowShiftSelector(false)
          if (s.role === 'admin') {
            setIsAdminUnlocked(true)
            if (adminPin === '1234') {
              toast.warning('El PIN de administrador sigue siendo el de fábrica (1234). Cámbialo en Stock → PIN Admin antes de operar con clientes reales.', { duration: 8000 })
            }
          }
        }}
        onAddSeller={addSeller}
      />
      <PinNumpad open={showPin} correctPin={adminPin} onClose={() => setShowPin(false)} onSuccess={() => { setIsAdminUnlocked(true); if (pendingTab) { setSeccion(pendingTab); setPendingTab(null); } }} />
      <DailyClosure open={showClosure} onClose={() => setShowClosure(false)} sales={sessionSales} cashFloatStart={cashFloatStart || 0} onResetSession={handleFinalizeShift} currentShift={currentSeller?.name || ''} />

      {/* Fondo de caja inicial: se pide una vez por turno, antes de la primera venta */}
      <Dialog open={showCashFloatDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-xs [&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Fondo de Caja Inicial</DialogTitle>
            <DialogDescription>¿Con cuánto efectivo estás partiendo la caja hoy?</DialogDescription>
          </DialogHeader>
          <input
            type="number"
            inputMode="numeric"
            value={cashFloatInput}
            onChange={(e) => setCashFloatInput(e.target.value)}
            placeholder="0"
            autoFocus
            className="w-full h-12 rounded-md border border-input bg-background px-3 text-lg text-center"
          />
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={confirmCashFloat}>Confirmar</Button>
        </DialogContent>
      </Dialog>

      <Toaster position="top-right" richColors />
    </div>
  )
}