'use client'

import { useState, useMemo } from 'react'
import { Search, CreditCard, Banknote, AlertTriangle, CheckCircle, Clock, TrendingDown, ArrowUpRight, ArrowDownRight, Receipt, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { formatCLP, getMemberStatus, sendDebtWhatsApp, type Member, type Payment } from '@/lib/store'
import { toast } from 'sonner'
import { PinNumpad } from '@/components/pin-numpad'

interface CreditSystemProps {
  members: Member[]
  payments: Payment[]
  adminPin?: string
  onPayment?: (memberId: string, amount: number, method: 'cash' | 'transfer' | 'card' | 'mercadopago') => void
  onVoidPayment?: (paymentId: string) => void
  onSelectMember?: (member: Member) => void
}

export function CreditSystem({ members, payments, adminPin = '1234', onPayment, onVoidPayment, onSelectMember }: CreditSystemProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card' | 'mercadopago'>('cash')
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null)

  const handleCobrarWhatsApp = async (m: Member) => {
    if (!m.phone) { toast.error('Este socio no tiene WhatsApp cargado en su ficha.'); return }
    setSendingWhatsApp(m.id)
    const result = await sendDebtWhatsApp(m)
    if (!result.ok) toast.error(result.error || 'No se pudo enviar el mensaje')
    setSendingWhatsApp(null)
  }

  const [showVoidPin, setShowVoidPin] = useState(false)
  const [pendingVoidId, setPendingVoidId] = useState<string | null>(null)

  const requestVoidPayment = (paymentId: string) => {
    setPendingVoidId(paymentId)
    setShowVoidPin(true)
  }

  const confirmVoidPayment = () => {
    if (pendingVoidId && onVoidPayment) {
      onVoidPayment(pendingVoidId)
      toast.success('Pago anulado — el monto vuelve a sumarse a la deuda del socio')
    }
    setPendingVoidId(null)
  }

  const membersWithDebt = useMemo(() => {
    return members
      .filter(m => m.balance < 0)
      .sort((a, b) => a.balance - b.balance) // Most debt first
  }, [members])

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return membersWithDebt
    return membersWithDebt.filter(member =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.rut.includes(searchQuery)
    )
  }, [membersWithDebt, searchQuery])

  const stats = useMemo(() => {
    const totalDebt = members.reduce((sum, m) => sum + Math.max(0, -m.balance), 0)
    const membersOverLimit = members.filter(m => getMemberStatus(m) === 'Sobre Límite').length
    const recentPayments = payments.slice(-5)
    const totalPaymentsThisMonth = payments
      .filter(p => new Date(p.date).getMonth() === new Date().getMonth())
      .reduce((sum, p) => sum + p.amount, 0)
    return { totalDebt, membersOverLimit, recentPayments, totalPaymentsThisMonth }
  }, [members, payments])

  const openPaymentDialog = (member: Member) => {
    setSelectedMember(member)
    setPaymentAmount('')
    setShowPaymentDialog(true)
  }

  const handlePayment = () => {
    if (selectedMember && parseInt(paymentAmount) > 0) {
      onPayment?.(selectedMember.id, parseInt(paymentAmount), paymentMethod)
      setShowPaymentDialog(false)
      setSelectedMember(null)
      setPaymentAmount('')
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="w-4 h-4" />
              Deuda Total Club
            </div>
            <div className="text-2xl font-bold text-destructive">{formatCLP(stats.totalDebt)}</div>
          </CardContent>
        </Card>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertTriangle className="w-4 h-4" />
              Sobre Límite
            </div>
            <div className="text-2xl font-bold text-warning">{stats.membersOverLimit} socios</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              Con Deuda
            </div>
            <div className="text-2xl font-bold">{membersWithDebt.length} socios</div>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CheckCircle className="w-4 h-4" />
              Pagos del Mes
            </div>
            <div className="text-2xl font-bold text-success">{formatCLP(stats.totalPaymentsThisMonth)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Debtors List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar socio con deuda..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Cuentas Corrientes
              </CardTitle>
              <CardDescription>Socios con saldo pendiente ordenados por deuda</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {filteredMembers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No hay socios con deuda</p>
                    </div>
                  ) : (
                    filteredMembers.map(member => {
                      const status = getMemberStatus(member)
                      const creditUsed = Math.abs(member.balance)
                      const creditPercentage = (creditUsed / member.creditLimit) * 100
                      
                      return (
                        <div
                          key={member.id}
                          className={`p-4 rounded-lg border transition-colors hover:bg-muted/50 ${
                            status === 'Sobre Límite' ? 'border-destructive/50 bg-destructive/5' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div 
                              className="flex-1 cursor-pointer"
                              onClick={() => onSelectMember?.(member)}
                            >
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{member.name}</p>
                                {status === 'Sobre Límite' && (
                                  <AlertTriangle className="w-4 h-4 text-destructive" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {member.rut} • {member.category}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-destructive">
                                {formatCLP(member.balance)}
                              </p>
                              <Badge
                                variant={status === 'Sobre Límite' ? 'destructive' : 'secondary'}
                                className={status === 'Deuda Pendiente' ? 'bg-warning text-warning-foreground' : ''}
                              >
                                {status}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Crédito usado</span>
                              <span>{formatCLP(creditUsed)} / {formatCLP(member.creditLimit)}</span>
                            </div>
                            <Progress 
                              value={Math.min(100, creditPercentage)} 
                              className={creditPercentage > 100 ? '[&>div]:bg-destructive' : creditPercentage > 80 ? '[&>div]:bg-warning' : ''}
                            />
                          </div>

                          <div className="flex gap-2 mt-3">
                            <Button
                              className="flex-1 gap-2"
                              variant={status === 'Sobre Límite' ? 'default' : 'outline'}
                              onClick={() => openPaymentDialog(member)}
                            >
                              <Banknote className="w-4 h-4" />
                              Registrar Pago
                            </Button>
                            {member.phone && (
                              <Button
                                variant="outline"
                                className="text-green-600 border-green-600/30 hover:bg-green-600/10"
                                disabled={sendingWhatsApp === member.id}
                                onClick={() => handleCobrarWhatsApp(member)}
                                title="Cobrar por WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
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
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No hay pagos registrados
                  </p>
                ) : (
                  payments.slice().reverse().map(payment => {
                    const member = members.find(m => m.id === payment.memberId)
                    return (
                      <div key={payment.id} className="p-3 rounded-lg bg-success/5 border border-success/20">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{member?.name || 'Socio'}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(payment.date).toLocaleDateString('es-CL', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-success flex items-center gap-1">
                              <ArrowUpRight className="w-4 h-4" />
                              {formatCLP(payment.amount)}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {payment.method === 'cash' ? 'Efectivo' : 
                               payment.method === 'transfer' ? 'Transferencia' : 
                               payment.method === 'mercadopago' ? 'Mercado Pago' : 'Tarjeta'}
                            </Badge>
                            {onVoidPayment && (
                              <button
                                onClick={() => requestVoidPayment(payment.id)}
                                className="block text-[10px] text-destructive/70 hover:text-destructive underline mt-1 ml-auto"
                              >
                                Anular
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            {selectedMember && (
              <DialogDescription>
                <strong>{selectedMember.name}</strong>
                <br />
                Deuda actual: <span className="text-destructive font-semibold">{formatCLP(Math.abs(selectedMember.balance))}</span>
              </DialogDescription>
            )}
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Monto a Pagar</FieldLabel>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0"
                />
                {selectedMember && (
                  <Button
                    variant="outline"
                    onClick={() => setPaymentAmount(Math.abs(selectedMember.balance).toString())}
                  >
                    Todo
                  </Button>
                )}
              </div>
            </Field>
            <Field>
              <FieldLabel>Método de Pago</FieldLabel>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          {selectedMember && paymentAmount && !isNaN(parseInt(paymentAmount)) && (
            <div className="p-3 bg-success/10 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Nuevo saldo:</span>
                <span className="font-semibold">
                  {formatCLP(selectedMember.balance + parseInt(paymentAmount))}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handlePayment} 
              disabled={!paymentAmount || isNaN(parseInt(paymentAmount)) || parseInt(paymentAmount) <= 0}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PinNumpad
        open={showVoidPin}
        correctPin={adminPin}
        onClose={() => { setShowVoidPin(false); setPendingVoidId(null) }}
        onSuccess={() => { setShowVoidPin(false); confirmVoidPayment() }}
        title="PIN para anular pago"
        description="Esto revierte el pago y vuelve a sumarlo a la deuda del socio"
      />
    </div>
  )
}
