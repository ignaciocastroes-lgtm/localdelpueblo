'use client'

import { Printer, ChefHat, Clock, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { type CartItemModifier, type Product } from '@/lib/store'

interface KitchenItem {
  product: Product
  quantity: number
  modifiers: CartItemModifier[]
}

interface KitchenSlipProps {
  open: boolean
  onClose: () => void
  items: KitchenItem[]
  orderId: string
  memberName?: string
}

export function KitchenSlip({ open, onClose, items, orderId, memberName }: KitchenSlipProps) {
  const timestamp = new Date().toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  // Filter only food items that need kitchen preparation
  const kitchenItems = items.filter(item => item.product.customizable || item.product.category === 'Comida')

  const handlePrint = () => {
    window.print()
  }

  if (kitchenItems.length === 0) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm print:max-w-full print:shadow-none print:border-none">
        <div className="print:p-4">
          {/* Header */}
          <DialogHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2">
              <ChefHat className="w-6 h-6 text-primary" />
              <DialogTitle className="text-xl">COMANDA</DialogTitle>
            </div>
            <p className="text-3xl font-bold font-mono text-primary">#{orderId}</p>
          </DialogHeader>

          <div className="bg-secondary/50 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{timestamp}</span>
              </div>
              {memberName && (
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{memberName}</span>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-4 border-dashed" />

          {/* Items */}
          <div className="space-y-4">
            {kitchenItems.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-primary">{item.quantity}x</span>
                      <span className="text-lg font-semibold">{item.product.name}</span>
                    </div>
                  </div>
                </div>

                {/* Modifiers */}
                {item.modifiers.length > 0 && (
                  <div className="ml-10 space-y-1">
                    {item.modifiers.filter(m => m.type === 'addon').map((mod, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge className="bg-success text-success-foreground font-mono text-xs">
                          + EXTRA
                        </Badge>
                        <span className="font-medium uppercase">{mod.modifier.name}</span>
                      </div>
                    ))}
                    {item.modifiers.filter(m => m.type === 'exclusion').map((mod, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge variant="destructive" className="font-mono text-xs">
                          - SIN
                        </Badge>
                        <span className="font-medium uppercase">{mod.modifier.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {index < kitchenItems.length - 1 && (
                  <Separator className="mt-3 border-dashed" />
                )}
              </div>
            ))}
          </div>

          <Separator className="my-4 border-dashed" />

          {/* Footer */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Club de Hockey Internacional de Lo Espejo
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total items cocina: {kitchenItems.reduce((sum, item) => sum + item.quantity, 0)}
            </p>
          </div>
        </div>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir Comanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
