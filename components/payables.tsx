'use client'

import { useState, useMemo } from 'react'
import { Search, Truck, Banknote, AlertTriangle, CheckCircle, Receipt, Plus, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { formatCLP, type Payable, type PayablePayment } from '@/lib/store'
import { toast } from 'sonner'

interface PayablesProps {
  payables: Payable[]
  payments: PayablePayment[]
  onAddPayable: (p: Omit<Payable, 'id' | 'amountPaid' | 'status'>) => void
  onPayPayable: (payableId: string, amount: number, method: 'cash' | 'transfer' | 'card') => void
}

export function Payables({ payables, payments, onAddPayable, onPayPayable }: PayablesProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash')

  const [newForm, setNewForm] = useState({ supplierName: '', description: '', amount: '' })

  const pendingPayables = useMemo(() => {
    return payables
      .filter(p => p.status !== 'paid')
      .sort((a, b) => (b.amount - b.amountPaid) - (a.amount - a.amountPaid))
  }, [payables])

  const filteredPayables = useMemo(() => {
    if (!searchQuery) return pendingPayables
    return pendingPayables.filter(p =>
      p.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [pendingPayables, searchQuery])

  const stats = useMemo(() => {
    const totalOwed = payables.reduce((sum, p) => sum + Math.max(0, p.amount - p.amountPaid), 0)
    const suppliersCount = new Set(payables.filter(p => p.status !== 'paid').map(p => p.supplierName)).size
    const totalPaidThisMonth = payments
      .filter(p => new Date(p.date).getMonth() === new Date().getMonth())
      .reduce((sum, p) => sum + p.amount, 0)
    return { totalOwed, suppliersCount, totalPaidThisMonth }
  }, [payables, payments])

  const handleCreatePayable = () => {
    const amount = parseInt(newForm.amount)
    if (!newForm.supplierName.trim()) { toast.error('Ingresa el nombre del proveedor'); return }
    if (!amount || amount <= 0) { toast.error('Ingresa un monto válido'); return }
    onAddPayable({
      supplierName: newForm.supplierName.trim(),
      description: newForm.description.trim() || 'Sin descripción',
      amount,
      date: new Date().toISOString(),
    })
    toast.success('Deuda a proveedor registrada')
    setNewForm({ supplierName: '', description: '', amount: '' })
    setShowNewDialog(false)
  }

  const openPaymentDialog = (p: Payable) => {
    setSelectedPayable(p)
    setPaymentAmount((p.amount - p.amountPaid).toString())
    setShowPaymentDialog(true)
  }

  const handlePayment = () => {
    const amount = parseInt(paymentAmount)
    if (selectedPayable && amount > 0) {
      onPayPayable(selectedPayable.id, amount, paymentMethod)
      setShowPaymentDialog(false)
      setSelectedPayable(null)
      setPaymentAmount('')
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              Total por Pagar
            </div>
            <div className="text-2xl font-bold text-destructive">{formatCLP(stats.totalOwed)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Truck className="w-4 h-4" />
              Proveedores con Deuda
            </div>
            <div className="text-2xl font-bold">{stats.suppliersCount}</div>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CheckCircle className="w-4 h-4" />
              Pagado Este Mes
            </div>
            <div className="text-2xl font-bold text-success">{formatCLP(stats.totalPaidThisMonth)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Payables List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por proveedor o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setShowNewDialog(true)} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" /> Nueva Deuda
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Cuentas por Pagar
              </CardTitle>
              <CardDescription>Lo que el kiosko le debe a sus proveedores</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px]">
                <div className="space-y-3">
                  {filteredPayables.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No hay deudas pendientes con proveedores</p>
                    </div>
                  ) : (
                    filteredPayables.map(p => {
                      const remaining = p.amount - p.amountPaid
                      return (
                        <div key={p.id} className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold">{p.supplierName}</p>
                              <p className="text-sm text-muted-foreground">{p.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(p.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-destructive">{formatCLP(remaining)}</p>
                              {p.status === 'partial' && (
                                <Badge variant="secondary" className="bg-warning text-warning-foreground">
                                  Abonado {formatCLP(p.amountPaid)} de {formatCLP(p.amount)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button className="w-full gap-2" variant="outline" onClick={() => openPaymentDialog(p)}>
                            <Banknote className="w-4 h-4" />
                            Registrar Pago
                          </Button>
                        </div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Recent Payments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Pagos Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[450px]">
              <div className="space-y-3">
                {payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No hay pagos registrados</p>
                ) : (
                  payments.slice().reverse().map(payment => (
                    <div key={payment.id} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{payment.supplierName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(payment.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-destructive">{formatCLP(payment.amount)}</p>
                          <Badge variant="outline" className="text-xs">
                            {payment.method === 'cash' ? 'Efectivo' : payment.method === 'transfer' ? 'Transferencia' : 'Tarjeta'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* New Payable Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva Deuda a Proveedor</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Proveedor</FieldLabel>
              <Input value={newForm.supplierName} onChange={(e) => setNewForm(f => ({ ...f, supplierName: e.target.value }))} placeholder="Ej: Distribuidora de Bebidas" />
            </Field>
            <Field>
              <FieldLabel>Descripción</FieldLabel>
              <Input value={newForm.description} onChange={(e) => setNewForm(f => ({ ...f, description: e.target.value }))} placeholder="Ej: Pedido de bebidas de la semana" />
            </Field>
            <Field>
              <FieldLabel>Monto</FieldLabel>
              <Input type="number" value={newForm.amount} onChange={(e) => setNewForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreatePayable}>Registrar Deuda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pago a Proveedor</DialogTitle>
            {selectedPayable && (
              <DialogDescription>
                <strong>{selectedPayable.supplierName}</strong>
                <br />
                Saldo pendiente: <span className="text-destructive font-semibold">{formatCLP(selectedPayable.amount - selectedPayable.amountPaid)}</span>
              </DialogDescription>
            )}
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Monto a Pagar</FieldLabel>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field>
              <FieldLabel>Método de Pago</FieldLabel>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancelar</Button>
            <Button
              onClick={handlePayment}
              disabled={!paymentAmount || isNaN(parseInt(paymentAmount)) || parseInt(paymentAmount) <= 0}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
