'use client'

import { useState, useMemo } from 'react'
import { User, Phone, Mail, Calendar, CreditCard, TrendingUp, Receipt, Banknote, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { 
  type Member, 
  type Product,
  type Transaction,
  formatCLP, 
  getMemberStatus, 
  getMemberPurchaseHistory, 
  getMostBoughtProducts,
  sendDebtWhatsApp,
} from '@/lib/store'
import { toast } from 'sonner'

interface MemberProfileProps {
  member: Member
  products: Product[]
  transactions: Transaction[]
  open: boolean
  onClose: () => void
  onPayment?: (memberId: string, amount: number, method: 'cash' | 'transfer' | 'card' | 'mercadopago') => void
}

export function MemberProfile({ member, products, transactions, open, onClose, onPayment }: MemberProfileProps) {
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card' | 'mercadopago'>('cash')
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)

  const status = getMemberStatus(member)
  const purchaseHistory = getMemberPurchaseHistory(member.id, transactions)
  const mostBought = getMostBoughtProducts(member.id, products, transactions)
  const creditUsed = Math.max(0, -member.balance)
  const creditPercentage = (creditUsed / member.creditLimit) * 100

  const handlePayment = () => {
    const amount = parseInt(paymentAmount)
    if (amount > 0) {
      onPayment?.(member.id, amount, paymentMethod)
      setShowPaymentDialog(false)
      setPaymentAmount('')
    }
  }

  const payFullDebt = () => {
    setPaymentAmount(Math.abs(member.balance).toString())
  }

  const handleCobrarWhatsApp = async () => {
    setSendingWhatsApp(true)
    const lastPurchase = purchaseHistory[0]
    const itemsDetail = lastPurchase
      ? lastPurchase.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')
      : undefined
    const result = await sendDebtWhatsApp(member, itemsDetail)
    if (!result.ok) toast.error(result.error || 'No se pudo enviar el mensaje')
    setSendingWhatsApp(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <User className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <SheetTitle className="text-xl">{member.name}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="font-mono">{member.rut}</span>
                  <Badge variant="outline">{member.category}</Badge>
                  {!member.isActive && (
                    <Badge variant="destructive">Inactivo</Badge>
                  )}
                  {!member.creditEnabled && member.isActive && (
                    <Badge variant="secondary">Crédito Deshabilitado</Badge>
                  )}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-6">
            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-3">
              {member.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{member.phone}</span>
                </div>
              )}
              {member.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate">{member.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>Desde {new Date(member.joinDate).toLocaleDateString('es-CL')}</span>
              </div>
            </div>

            {/* Balance Card */}
            <Card className={member.balance < 0 ? 'border-destructive/50 bg-destructive/5' : 'border-success/50 bg-success/5'}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    <span className="font-medium">Cuenta Corriente</span>
                  </div>
                  <Badge
                    className={
                      status === 'Pagado' ? 'bg-success text-success-foreground' :
                      status === 'Sobre Límite' ? 'bg-destructive text-destructive-foreground' :
                      'bg-warning text-warning-foreground'
                    }
                  >
                    {status}
                  </Badge>
                </div>
                <div className="text-3xl font-bold mb-2">
                  {formatCLP(member.balance)}
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
                {member.balance < 0 && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      className="flex-1 gap-2"
                      onClick={() => setShowPaymentDialog(true)}
                    >
                      <Banknote className="w-4 h-4" />
                      Registrar Pago
                    </Button>
                    {member.phone && (
                      <Button
                        variant="outline"
                        className="text-green-600 border-green-600/30 hover:bg-green-600/10 gap-2"
                        disabled={sendingWhatsApp}
                        onClick={handleCobrarWhatsApp}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Cobrar por WhatsApp
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Most Bought Products */}
            {mostBought.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Productos Más Comprados
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {mostBought.map(({ product, count }) => (
                      <div key={product.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.category}</p>
                        </div>
                        <Badge variant="secondary">{count}x</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Purchase History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  Historial de Compras
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {purchaseHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay compras registradas
                  </p>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {purchaseHistory.map(transaction => (
                        <div key={transaction.id} className="p-3 rounded-lg bg-secondary/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(transaction.date).toLocaleDateString('es-CL', { 
                                day: 'numeric', 
                                month: 'short', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <Badge variant={transaction.type === 'credit' ? 'secondary' : 'outline'}>
                              {transaction.type === 'credit' ? 'A Cuenta' : 'Efectivo'}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            {transaction.items.map((item, idx) => {
                              const product = products.find(p => p.id === item.productId)
                              return (
                                <div key={idx} className="flex justify-between text-sm">
                                  <span>{item.quantity}x {product?.name || 'Producto'}</span>
                                  <span>{formatCLP(item.price * item.quantity)}</span>
                                </div>
                              )
                            })}
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between font-semibold">
                            <span>Total</span>
                            <span>{formatCLP(transaction.total)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Deuda actual: <strong className="text-destructive">{formatCLP(Math.abs(member.balance))}</strong>
            </DialogDescription>
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
                <Button variant="outline" onClick={payFullDebt}>
                  Todo
                </Button>
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
          {paymentAmount && !isNaN(parseInt(paymentAmount)) && (
            <div className="p-3 bg-success/10 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Nuevo saldo:</span>
                <span className="font-semibold">
                  {formatCLP(member.balance + parseInt(paymentAmount))}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePayment} disabled={!paymentAmount || isNaN(parseInt(paymentAmount)) || parseInt(paymentAmount) <= 0}>
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
