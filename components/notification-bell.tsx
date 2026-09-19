'use client'

import { useState } from 'react'
import { Bell, AlertTriangle, Package, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { type Product, formatCLP } from '@/lib/store'

interface NotificationBellProps {
  products: Product[]
  onNavigateToInventory?: () => void
}

interface LowStockAlert {
  product: Product
  type: 'low' | 'out'
}

export function NotificationBell({ products, onNavigateToInventory }: NotificationBellProps) {
  const [open, setOpen] = useState(false)

  const alerts: LowStockAlert[] = products
    .filter(p => p.stock <= (p as any).minStock || p.stock <= 5)
    .map(p => ({
      product: p,
      type: (p.stock === 0 ? 'out' : 'low') as 'out' | 'low'
    }))
    .sort((a, b) => a.product.stock - b.product.stock)

  const outOfStockCount = alerts.filter(a => a.type === 'out').length
  const lowStockCount = alerts.filter(a => a.type === 'low').length
  const totalAlerts = alerts.length

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {totalAlerts > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground"
            >
              {totalAlerts > 9 ? '9+' : totalAlerts}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Alertas de Stock</span>
          {totalAlerts > 0 && (
            <div className="flex gap-2">
              {outOfStockCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {outOfStockCount} agotados
                </Badge>
              )}
              {lowStockCount > 0 && (
                <Badge className="text-xs bg-warning text-warning-foreground">
                  {lowStockCount} bajos
                </Badge>
              )}
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {alerts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin alertas de stock</p>
            <p className="text-xs">Todos los productos tienen stock suficiente</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="p-2 space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.product.id}
                  className={`p-3 rounded-lg border ${
                    alert.type === 'out' 
                      ? 'bg-destructive/5 border-destructive/20' 
                      : 'bg-warning/5 border-warning/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      alert.type === 'out' ? 'bg-destructive/10' : 'bg-warning/10'
                    }`}>
                      <AlertTriangle className={`w-4 h-4 ${
                        alert.type === 'out' ? 'text-destructive' : 'text-warning'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {alert.product.name}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">
                          {alert.product.category}
                        </p>
                        <Badge variant={alert.type === 'out' ? 'destructive' : 'outline'} className="text-xs">
                          {alert.product.stock} unidades
                        </Badge>
                      </div>
                      {(alert.product as any).minStock && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Mínimo recomendado: {(alert.product as any).minStock} unidades
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {alerts.length > 0 && onNavigateToInventory && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button 
                variant="outline" 
                className="w-full justify-between"
                onClick={() => {
                  setOpen(false)
                  onNavigateToInventory()
                }}
              >
                Ver Inventario Completo
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
