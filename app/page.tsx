'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { ShoppingCart, Package, Calculator, Lock, Truck, ShoppingBasket, ClipboardCheck } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { Header } from '@/components/header'
import { POSTerminal } from '@/components/pos-terminal'
import { AdminInventory } from '@/components/admin-inventory'
import { DailyClosure } from '@/components/daily-closure'
import { ShiftSelector } from '@/components/shift-selector'
import { PinNumpad } from '@/components/pin-numpad'
import { Payables } from '@/components/payables'
import { Purchases, type PurchaseInput } from '@/components/purchases'
import { deleteReceipt } from '@/lib/receipt-store'
import { DailyMenu, type DailyMenuChanges } from '@/components/daily-menu'
import { StockCount } from '@/components/stock-count'
import { Accounting, type ExpenseInput } from '@/components/accounting'
import type { TransferMeta } from '@/components/transfer-dialog'
import { loadFromStorage, saveToStorage, StorageKeys, defaultProducts, defaultSellers, formatCLP, cartLineTotal, applyPurchaseToProducts, revertPurchaseFromProducts, computeStockBreakdown, applyStockCount, lossValue, type Expense, type Purchase, type Seller, type Transaction, type CartItem, type Payable, type PayablePayment, computeCashSession, paymentsSince, type ClosureLogEntry, type MermaEntry } from '@/lib/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { PaymentExtra } from '@/components/payment-details'

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

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
  const [shiftStartedAt, setShiftStartedAt] = useState<string | null>(null)   // cuándo se abrió la caja del turno
  const [showCashFloatDialog, setShowCashFloatDialog] = useState(false)
  const [cashFloatInput, setCashFloatInput] = useState('')

  // Pasivos (cuentas por pagar a proveedores)
  const [payables, setPayables] = useState<Payable[]>([])
  const [payablePayments, setPayablePayments] = useState<PayablePayment[]>([])

  // Gastos del puesto y retiros del dueño (lo que sale en efectivo baja el arqueo)
  const [expenses, setExpenses] = useState<Expense[]>([])

  // Apertura del día: con qué stock partió el turno, y si el dueño ya revisó la carta de hoy
  const [dayOpening, setDayOpening] = useState<{ date: string; stock: Record<string, number>; menuSaved: boolean } | null>(null)
  // Opciones apagadas hoy (ej. sabor de jugo que no hay)
  const [offModifiers, setOffModifiers] = useState<string[]>([])
  const [countedThisShift, setCountedThisShift] = useState(false)
  const [showStockCount, setShowStockCount] = useState(false)
  const [showAccounting, setShowAccounting] = useState(false)

  // Compras del dueño (en volumen): suman stock y quedan en Pasivos
  const [purchases, setPurchases] = useState<Purchase[]>([])

  // Merma: lo que se pierde sin vender (distinto del descuento manual, que sí vende)
  const [mermaLog, setMermaLog] = useState<MermaEntry[]>([])

  // Historial real, persistente entre turnos (no se resetea al hacer cierre de caja)
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])

  // Estructura de ventas idéntica a tu Backup
  const [sessionSales, setSessionSales] = useState<{
    id: string
    items: any[]
    total: number
    type: 'cash' | 'transfer' | 'mercadopago' | string
    date: string
    reference?: string
    receiptId?: string
    verified?: boolean
    vendorId?: string
    vendorName?: string
    rounding?: number
  }[]>([])

  useEffect(() => {
    try {
      const p = loadFromStorage(StorageKeys.PRODUCTS, defaultProducts)
      const sellersLoaded = loadFromStorage(StorageKeys.SELLERS, defaultSellers)
      const pin = loadFromStorage(StorageKeys.ADMIN_PIN, '1234')
      const adminPinLoaded = pin || '1234'
      const startedAtLoaded = loadFromStorage<string | null>(StorageKeys.SHIFT_STARTED_AT, null)
      const s = loadFromStorage<Seller | null>(StorageKeys.CURRENT_SELLER, null)
      const sales = loadFromStorage(StorageKeys.SESSION_SALES, [])
      const txs = loadFromStorage<Transaction[]>(StorageKeys.ALL_TRANSACTIONS, [])
      const floatStart = loadFromStorage<number | null>(StorageKeys.CASH_FLOAT, null)
      const payablesLoaded = loadFromStorage<Payable[]>(StorageKeys.PAYABLES, [])
      const payablePaymentsLoaded = loadFromStorage<PayablePayment[]>(StorageKeys.PAYABLE_PAYMENTS, [])
      const mermaLoaded = loadFromStorage<MermaEntry[]>(StorageKeys.MERMA_LOG, [])
      const purchasesLoaded = loadFromStorage<Purchase[]>(StorageKeys.PURCHASES, [])
      const expensesLoaded = loadFromStorage<Expense[]>(StorageKeys.EXPENSES, [])
      const openingLoaded = loadFromStorage<any>(StorageKeys.DAY_OPENING, null)
      const offModsLoaded = loadFromStorage<string[]>(StorageKeys.OFF_MODIFIERS, [])

      setProducts(Array.isArray(p) ? p : defaultProducts)
      // El vendedor "Administrador" entra con el mismo PIN que el candado de
      // admin. Antes eran dos PIN distintos: al cambiar el PIN admin en Stock,
      // el usuario "Administrador" seguía entrando con 1234 y abría todo.
      const sellersList = Array.isArray(sellersLoaded) && sellersLoaded.length > 0 ? sellersLoaded : defaultSellers
      setSellers(sellersList.map(sl => sl.role === 'admin' ? { ...sl, pin: adminPinLoaded } : sl))
      setAdminPin(adminPinLoaded)
      setSessionSales(Array.isArray(sales) ? sales : [])
      setAllTransactions(Array.isArray(txs) ? txs : [])
      setCashFloatStart(typeof floatStart === 'number' ? floatStart : null)
      // Turno abierto antes de esta versión (sin hora de apertura): se toma la
      // primera venta del turno, o el inicio del día si aún no hay ventas.
      if (typeof floatStart === 'number') {
        const firstSale = Array.isArray(sales) && sales.length > 0 ? (sales as any[])[0]?.date : null
        const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
        setShiftStartedAt(typeof startedAtLoaded === 'string' ? startedAtLoaded : (firstSale || startOfToday.toISOString()))
      } else {
        setShiftStartedAt(null)
      }
      setPayables(Array.isArray(payablesLoaded) ? payablesLoaded : [])
      setPayablePayments(Array.isArray(payablePaymentsLoaded) ? payablePaymentsLoaded : [])
      setMermaLog(Array.isArray(mermaLoaded) ? mermaLoaded : [])
      setPurchases(Array.isArray(purchasesLoaded) ? purchasesLoaded : [])
      setExpenses(Array.isArray(expensesLoaded) ? expensesLoaded : [])
      setDayOpening(openingLoaded && typeof openingLoaded === 'object' && openingLoaded.stock ? openingLoaded : null)
      setOffModifiers(Array.isArray(offModsLoaded) ? offModsLoaded : [])
      setCurrentSeller(s)
      if (!s) setShowShiftSelector(true)
    } catch (e) { console.error(e) }
    setMounted(true)
  }, [])

  // Cada dato se guarda solo cuando cambia él (antes cualquier venta reescribía
  // todo el catálogo con sus fotos: lento y más riesgo de llenar la memoria).
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.PRODUCTS, products) }, [mounted, products])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.SESSION_SALES, sessionSales) }, [mounted, sessionSales])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.SELLERS, sellers) }, [mounted, sellers])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.ADMIN_PIN, adminPin) }, [mounted, adminPin])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.CURRENT_SELLER, currentSeller) }, [mounted, currentSeller])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.ALL_TRANSACTIONS, allTransactions) }, [mounted, allTransactions])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.CASH_FLOAT, cashFloatStart) }, [mounted, cashFloatStart])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.SHIFT_STARTED_AT, shiftStartedAt) }, [mounted, shiftStartedAt])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.PAYABLES, payables) }, [mounted, payables])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.PAYABLE_PAYMENTS, payablePayments) }, [mounted, payablePayments])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.MERMA_LOG, mermaLog) }, [mounted, mermaLog])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.PURCHASES, purchases) }, [mounted, purchases])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.EXPENSES, expenses) }, [mounted, expenses])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.DAY_OPENING, dayOpening) }, [mounted, dayOpening])
  useEffect(() => { if (mounted) saveToStorage(StorageKeys.OFF_MODIFIERS, offModifiers) }, [mounted, offModifiers])

  // Si la memoria de la tablet se llena, el guardado falla. Antes era en
  // silencio y los datos se perdían al recargar; ahora se avisa fuerte.
  useEffect(() => {
    let lastWarning = 0
    const onStorageError = () => {
      const now = Date.now()
      if (now - lastWarning < 20000) return
      lastWarning = now
      toast.error(
        'No se pudo GUARDAR en la tablet (memoria llena). Descarga un respaldo ahora (Stock → Descargar Respaldo) y borra fotos de la Galería.',
        { duration: 20000 }
      )
    }
    window.addEventListener('kiosko:storage-error', onStorageError)
    return () => window.removeEventListener('kiosko:storage-error', onStorageError)
  }, [])

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
    if (['stock', 'reports', 'pasivos', 'compras'].includes(v) && !isAdminUnlocked) {
      setPendingTab(v); setShowPin(true)
    } else if (v === 'venta' && cashFloatStart === null && sessionSales.length === 0) {
      setShowCashFloatDialog(true)
    } else {
      setSeccion(v)
    }
  }

  const confirmCashFloat = (e?: FormEvent) => {
    e?.preventDefault()
    const amount = parseInt(cashFloatInput, 10) || 0
    setCashFloatStart(amount)
    setShiftStartedAt(new Date().toISOString())
    // El turno parte con lo que hay registrado (lo contado anoche o lo que el dueño ajuste).
    const todayKey = new Date().toDateString()
    const stockNow: Record<string, number> = {}
    products.forEach((p: any) => { stockNow[p.id] = p.stock })
    const menuAlreadySaved = dayOpening?.date === todayKey && dayOpening.menuSaved
    setDayOpening({ date: todayKey, stock: stockNow, menuSaved: !!menuAlreadySaved })
    setCountedThisShift(false)
    if (!menuAlreadySaved) {
      toast.info('El stock parte con lo que quedó contado ayer. El administrador puede ajustar la carta y el stock de hoy en STOCK → Carta y stock del día.', { duration: 9000 })
    }
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
      id: uid('merma'),
      productId,
      productName: product.name,
      cantidad,
      motivo,
      date: new Date().toISOString(),
      kind: motivo === 'Regalo' ? 'regalo' : 'merma',
      costValue: lossValue(product, cantidad),
    }])
  }

  // === CARTA Y STOCK DEL DÍA (administrador) ===
  const saveDayMenu = (changes: DailyMenuChanges) => {
    const nextProducts = (products as any[]).map(p => ({
      ...p,
      ...(changes.stock[p.id] !== undefined ? { stock: changes.stock[p.id] } : {}),
      ...(changes.availability[p.id] !== undefined ? { availableToday: changes.availability[p.id] } : {}),
    }))
    setProducts(nextProducts)
    setOffModifiers(changes.offModifiers)
    const stockNow: Record<string, number> = {}
    nextProducts.forEach(p => { stockNow[p.id] = p.stock })
    setDayOpening({ date: new Date().toDateString(), stock: stockNow, menuSaved: true })
  }

  // === CONTEO DE CIERRE: lo contado pasa a ser el stock de mañana ===
  const applyCount = (counts: Record<string, number>) => {
    const result = applyStockCount(products as any[], counts)
    setProducts(result.products)
    const now = new Date().toISOString()
    if (result.entries.length > 0) {
      setMermaLog(prev => [...prev, ...result.entries.map(e => ({ ...e, id: uid('merma'), date: now }))])
    }
    const faltante = result.entries.filter(e => e.kind === 'conteo').reduce((s, e) => s + (e.costValue || 0), 0)
    setCountedThisShift(true)
    setShowStockCount(false)
    toast.success(faltante > 0
      ? `Conteo guardado. Faltantes a costo: ${formatCLP(faltante)}. Mañana parte con lo contado.`
      : 'Conteo guardado. Mañana parte con lo contado.')
  }

  // === GASTOS Y RETIROS ===
  const addExpense = (input: ExpenseInput) => {
    setExpenses(prev => [...prev, { ...input, id: uid('expense'), date: new Date().toISOString() }])
    toast.success(`${input.kind === 'retiro' ? 'Retiro' : 'Gasto'} de ${formatCLP(input.amount)} registrado`)
  }
  const voidExpense = (id: string) => {
    const e = expenses.find(x => x.id === id)
    if (e?.receiptId) deleteReceipt(e.receiptId)
    setExpenses(prev => prev.filter(x => x.id !== id))
    toast.success('Anulado')
  }

  // === TRANSFERENCIAS: confirmar en el banco una venta que quedó "por verificar" ===
  const verifyTransfer = (saleId: string) => {
    setSessionSales(prev => prev.map(sl => sl.id === saleId ? { ...sl, verified: true } : sl))
    setAllTransactions(prev => prev.map(t => t.id === saleId ? { ...t, verified: true } : t))
  }

  // === VENDEDORES ===
  const addSeller = (s: Seller) => setSellers(prev => [...prev, s])
  const changeAdminPin = (pin: string) => {
    setAdminPin(pin)
    setSellers(prev => prev.map(sl => sl.role === 'admin' ? { ...sl, pin } : sl))
  }

  // === PASIVOS (cuentas por pagar a proveedores) ===
  const addPayable = (p: Omit<Payable, 'id' | 'amountPaid' | 'status'>) => {
    setPayables(prev => [...prev, { ...p, id: uid('payable'), amountPaid: 0, status: 'pending' }])
  }
  const payPayable = (payableId: string, amount: number, method: 'cash' | 'transfer' | 'card', extra?: PaymentExtra) => {
    const payable = payables.find(p => p.id === payableId)
    if (!payable) return
    const newAmountPaid = payable.amountPaid + amount
    setPayables(prev => prev.map(p => p.id === payableId
      ? { ...p, amountPaid: newAmountPaid, status: newAmountPaid >= p.amount ? 'paid' : 'partial' }
      : p
    ))
    setPayablePayments(prev => [...prev, {
      id: uid('payable-payment'),
      payableId,
      supplierName: payable.supplierName,
      amount,
      date: new Date().toISOString(),
      method,
      cashSource: extra?.cashSource,
      reference: extra?.reference,
      receiptId: extra?.receiptId,
    }])
    toast.success(`Pago de ${formatCLP(amount)} a ${payable.supplierName} registrado`)
  }

  // === COMPRAS (el dueño compra en volumen) ===
  // Una compra hace TODO junto: suma stock (kg → gramos en productos por peso),
  // actualiza el costo por kilo/unidad si se pidió, y deja la deuda y el pago en
  // Pasivos (lo pagado en efectivo sale del cajón en el arqueo del turno).
  const registerPurchase = (input: PurchaseInput, opts: { updateCost: boolean }) => {
    const now = new Date().toISOString()
    const payableId = uid('payable')
    const purchaseId = uid('purchase')

    setProducts((prev: any[]) => applyPurchaseToProducts(prev, input.lines, opts.updateCost))

    const summary = input.lines.map(l => `${l.productName} ${l.unit === 'kg' ? `${l.quantity} kg` : `${l.quantity} un.`}`).join(', ')
    setPayables(prev => [...prev, {
      id: payableId,
      supplierName: input.supplierName,
      description: `Compra: ${summary}`.slice(0, 140),
      amount: input.total,
      amountPaid: input.paidNow,
      date: now,
      status: input.paidNow >= input.total ? 'paid' : input.paidNow > 0 ? 'partial' : 'pending',
    }])
    if (input.paidNow > 0 && input.method) {
      setPayablePayments(prev => [...prev, {
        id: uid('payable-payment'),
        payableId,
        supplierName: input.supplierName,
        amount: input.paidNow,
        date: now,
        method: input.method!,
        cashSource: input.cashSource,
        reference: input.reference,
        receiptId: input.receiptId,
      }])
    }
    setPurchases(prev => [...prev, { ...input, id: purchaseId, date: now, payableId }])
    toast.success(`Compra registrada: ${formatCLP(input.total)} en ${input.lines.length} producto(s). Stock actualizado.`)
  }

  const voidPurchase = (purchaseId: string) => {
    const purchase = purchases.find(p => p.id === purchaseId)
    if (!purchase) return
    const payable = payables.find(p => p.id === purchase.payableId)
    if (payable && payable.amountPaid > purchase.paidNow) {
      toast.error('Esta compra ya tiene pagos posteriores en PASIVOS; no se puede anular desde aquí.')
      return
    }
    setProducts((prev: any[]) => revertPurchaseFromProducts(prev, purchase.lines))
    payablePayments.filter(x => x.payableId === purchase.payableId && x.receiptId).forEach(x => deleteReceipt(x.receiptId!))
    setPayables(prev => prev.filter(p => p.id !== purchase.payableId))
    setPayablePayments(prev => prev.filter(x => x.payableId !== purchase.payableId))
    setPurchases(prev => prev.filter(p => p.id !== purchaseId))
    toast.success('Compra anulada: stock y pagos revertidos.')
  }

  // === LÓGICA DE VENTA ===
  // `total` viene calculado desde el POS (ya incluye redondeo a $10 en
  // efectivo y los descuentos manuales aplicados por ítem) — no se recalcula
  // acá para no duplicar esa lógica en dos lugares.
  const handleSaleComplete = (items: CartItem[], type: 'cash' | 'transfer' | 'mercadopago', total: number, meta?: TransferMeta) => {
    try {
      // 1. Crear el registro para Cierre de Caja
      const saleRecord = {
        id: uid('sale'),
        items: items.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          // Total REAL de la línea (con su descuento: 3x2, %, etc.). El cierre suma esto;
          // `price` queda como precio unitario promedio solo de referencia.
          lineTotal: cartLineTotal(item),
          price: Math.round(cartLineTotal(item) / Math.max(1, item.quantity)),
          saleMode: item.saleMode,
          // Para ventas "por monto" es el peso ESTIMADO (monto ÷ precio por kilo).
          weightGrams: item.weightGrams,
          // Lo que valía sin descuento: sirve para medir regalos y remates.
          listTotal: item.itemTotal * item.quantity,
          discountLabel: item.discount ? (item.discount.label || (item.discount.type === 'percent' ? `-${item.discount.value}%` : 'Descuento')) : undefined,
          // Vendido estando apagado o sin stock registrado: se corrige en el conteo del cierre.
          soldWithoutStock: (() => {
            const prod = (products as any[]).find(p => p.id === item.product.id)
            if (!prod) return false
            const needed = prod.saleType === 'peso' ? (item.weightGrams || 0) : item.quantity
            return prod.availableToday === false || prod.stock < needed
          })(),
        })),
        total,
        // Diferencia por el redondeo a $10 en efectivo (total cobrado − suma de las líneas)
        rounding: total - items.reduce((sum, item) => sum + cartLineTotal(item), 0),
        type,
        date: new Date().toISOString(),
        vendorId: currentSeller?.id,
        vendorName: currentSeller?.name,
        // Transferencia: voucher, n° de operación y si ya se confirmó en el banco
        ...(type === 'transfer' ? { reference: meta?.reference, receiptId: meta?.receiptId, verified: !!meta?.verified } : {}),
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
        ...(type === 'transfer' ? { reference: meta?.reference, receiptId: meta?.receiptId, verified: !!meta?.verified } : {}),
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
          // Sin tope en 0: si se vendió algo que figuraba sin stock, queda en negativo y el conteo del cierre lo corrige.
          updated[idx] = { ...updated[idx], stock: updated[idx].stock - cantidadDescontar }
        })
        return updated
      })

    } catch (e) {
      console.error(e)
      toast.error("Ocurrió un error al procesar los datos de la venta.")
    }
  }

  // Pagos a proveedores registrados desde que se abrió la caja del turno
  // (alimentan el arqueo: lo pagado en efectivo sale del cajón).
  const sessionSupplierPayments = paymentsSince<PayablePayment>(payablePayments, shiftStartedAt)
  const sessionExpenses = paymentsSince<Expense>(expenses, shiftStartedAt)

  // Stock del turno: inicio + compras − ventas − merma/regalos = lo que debería haber (para el conteo)
  const stockRows = computeStockBreakdown({
    products: products as any[],
    opening: dayOpening?.stock ?? null,
    sales: sessionSales,
    purchases: paymentsSince<Purchase>(purchases, shiftStartedAt),
    mermaLog: paymentsSince<MermaEntry>(mermaLog, shiftStartedAt),
  })

  // === FINALIZAR TURNO: archiva el cierre y limpia el fondo de caja ===
  const handleFinalizeShift = (cashData: { cashCounted: number | null; cashDifference: number | null; sentToMake: boolean }) => {
    const totalVentas = sessionSales.reduce((sum, s) => sum + s.total, 0)
    const cash = computeCashSession({
      cashFloatStart: cashFloatStart || 0,
      sales: sessionSales,
      supplierPayments: sessionSupplierPayments,
      expenses: sessionExpenses,
    })
    const entry: ClosureLogEntry = {
      id: `closure-${Date.now()}`,
      date: new Date().toISOString(),
      shift: currentSeller?.name || '',
      totalSales: totalVentas,
      cashFloatStart: cashFloatStart || 0,
      cashExpected: cash.cashExpected,
      cashCounted: cashData.cashCounted,
      cashDifference: cashData.cashDifference,
      sentToMake: cashData.sentToMake,
      supplierCashPayments: cash.supplierCashOut,
      expenseCashPayments: cash.expenseCashOut,
    }
    const log = loadFromStorage<ClosureLogEntry[]>(StorageKeys.CLOSURES_LOG, [])
    saveToStorage(StorageKeys.CLOSURES_LOG, [...log, entry].slice(-90)) // guarda los últimos 90 cierres

    setSessionSales([])
    setCashFloatStart(null)
    setShiftStartedAt(null)
    setCountedThisShift(false)
  }

  const navButtons = [
    { key: 'venta', label: 'VENTA', icon: ShoppingCart, admin: false },
    { key: 'stock', label: 'STOCK', icon: Package, admin: true },
    { key: 'compras', label: 'COMPRAS', icon: ShoppingBasket, admin: true },
    { key: 'pasivos', label: 'PASIVOS', icon: Truck, admin: true },
    { key: 'reports', label: 'CIERRE', icon: Calculator, admin: false },
  ]

  return (
    <div className="h-dvh overflow-hidden bg-slate-950 flex flex-col notranslate">
      <Header currentShift={currentSeller?.name} products={products} onNavigateToInventory={() => navegar('stock')} onEndShift={() => { setCurrentSeller(null); setShowShiftSelector(true); setIsAdminUnlocked(false); }} />

      <div className="bg-[#0a1f16] p-3 flex justify-center gap-2 border-b border-emerald-600/20 shrink-0">
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

      <main className="flex-1 min-h-0 p-4 overflow-hidden">
        <div className={seccion === 'venta' ? 'h-full overflow-y-auto lg:overflow-hidden' : 'hidden'}>
          <POSTerminal products={products} onSaleComplete={handleSaleComplete} disabledModifierIds={offModifiers} />
        </div>
        <div className={seccion === 'stock' ? 'h-full overflow-y-auto space-y-4' : 'hidden'}>
          <DailyMenu products={products} offModifiers={offModifiers} openedToday={dayOpening?.date === new Date().toDateString() && !!dayOpening?.menuSaved} onSave={saveDayMenu} />
          <AdminInventory products={products} adminPin={adminPin} onUpdateProduct={updateProduct} onAddProduct={addProduct} onDeleteProduct={deleteProduct} onBulkUpdateProducts={(upd: any) => setProducts(upd)} onChangeAdminPin={changeAdminPin} onClearDemoData={clearDemoData} onRegisterMerma={registerMerma} mermaLog={mermaLog} />
        </div>
        <div className={seccion === 'compras' ? 'h-full overflow-y-auto' : 'hidden'}>
          <Purchases products={products} purchases={purchases} payables={payables} onRegister={registerPurchase} onVoid={voidPurchase} />
        </div>
        <div className={seccion === 'pasivos' ? 'h-full overflow-y-auto' : 'hidden'}>
          <Payables payables={payables} payments={payablePayments} onAddPayable={addPayable} onPayPayable={payPayable} />
        </div>
        <div className={seccion === 'reports' ? 'h-full overflow-y-auto' : 'hidden'}>
          <div className="flex items-center justify-center h-full">
            <Card className="bg-slate-900 border-emerald-600/30 p-8 text-center max-w-sm w-full">
              <Calculator className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">CIERRE DE CAJA</h2>
              <p className="text-slate-400 mb-6 font-mono text-lg">Operaciones hoy: {sessionSales.length}</p>
              <p className="text-emerald-400 mb-8 font-mono text-4xl font-bold">{formatCLP(sessionSales.reduce((sum, s) => sum + s.total, 0))}</p>
              <div className="space-y-3">
                <Button onClick={() => setShowStockCount(true)} variant="outline" className="w-full font-bold py-5 text-base border-emerald-600/50 text-emerald-300 hover:bg-emerald-600/10">
                  <ClipboardCheck className="w-5 h-5 mr-2" /> CONTEO DE STOCK {countedThisShift ? '✓' : ''}
                </Button>
                <Button onClick={() => setShowAccounting(true)} variant="outline" className="w-full font-bold py-5 text-base border-slate-600 text-slate-200 hover:bg-slate-800">
                  <Calculator className="w-5 h-5 mr-2" /> CONTABILIDAD BÁSICA
                </Button>
                <Button onClick={() => setShowClosure(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold text-white py-6 text-lg shadow-lg shadow-emerald-600/20">GENERAR REPORTE</Button>
              </div>
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
      <DailyClosure open={showClosure} onClose={() => setShowClosure(false)} sales={sessionSales} cashFloatStart={cashFloatStart || 0} supplierPayments={sessionSupplierPayments} expenses={sessionExpenses} countedThisShift={countedThisShift} onVerifyTransfer={verifyTransfer} onResetSession={handleFinalizeShift} currentShift={currentSeller?.name || ''} />

      {/* Fondo de caja inicial: se pide una vez por turno, antes de la primera venta */}
      <Dialog open={showCashFloatDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-xs" showCloseButton={false}>
          <form onSubmit={confirmCashFloat} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Fondo de Caja Inicial</DialogTitle>
              <DialogDescription>¿Con cuánto efectivo estás partiendo la caja hoy?</DialogDescription>
            </DialogHeader>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="done"
              value={cashFloatInput}
              onChange={(e) => setCashFloatInput(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="0"
              autoFocus
              className="w-full h-12 rounded-md border border-input bg-background px-3 text-lg text-center"
            />
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">Confirmar</Button>
          </form>
        </DialogContent>
      </Dialog>

      <StockCount open={showStockCount} rows={stockRows} onClose={() => setShowStockCount(false)} onApply={applyCount} />
      <Accounting
        open={showAccounting}
        onClose={() => setShowAccounting(false)}
        onVerifyTransfer={verifyTransfer}
        transactions={allTransactions}
        purchases={purchases}
        expenses={expenses}
        mermaLog={mermaLog}
        onAddExpense={addExpense}
        onVoidExpense={voidExpense}
      />

      <Toaster position="top-right" richColors />
    </div>
  )
}