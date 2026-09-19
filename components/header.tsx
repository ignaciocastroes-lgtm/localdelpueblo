'use client'

import { User, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NotificationBell } from '@/components/notification-bell'
import { CloudSyncIndicator } from '@/components/cloud-sync-indicator'
import { type Product } from '@/lib/store'

interface HeaderProps {
  currentShift?: string
  products?: Product[]
  onNavigateToInventory?: () => void
  onEndShift?: () => void
}

export function Header({ currentShift, products = [], onNavigateToInventory, onEndShift }: HeaderProps) {
  const currentTime = new Date().toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <header className="bg-primary text-primary-foreground border-b border-primary/20">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded-full bg-primary-foreground/10 flex items-center justify-center text-2xl">
            🥬
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">El Puesto del Pueblo</h1>
            <p className="text-xs text-primary-foreground/70">Feria libre - Sistema de venta</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          {/* Shift Info */}
          {currentShift && (
            <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-primary-foreground/10 rounded-lg">
              <User className="w-4 h-4" />
              <div className="text-sm">
                <span className="font-medium">{currentShift}</span>
                <span className="mx-2 opacity-50">|</span>
                <span className="opacity-80">{currentTime}</span>
              </div>
            </div>
          )}

          {/* Mobile Shift Badge */}
          {currentShift && (
            <Badge variant="secondary" className="sm:hidden bg-primary-foreground/10 text-primary-foreground">
              <User className="w-3 h-3 mr-1" />
              {currentShift.split(' ')[0]}
            </Badge>
          )}

          {/* Notification Bell */}
          <div className="text-foreground">
            <NotificationBell 
              products={products}
              onNavigateToInventory={onNavigateToInventory}
            />
          </div>

          {/* Cloud Sync Status */}
          <div className="text-foreground">
            <CloudSyncIndicator />
          </div>

          {/* End Shift Button */}
          {onEndShift && (
            <Button 
              variant="ghost" 
              size="icon"
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={onEndShift}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
