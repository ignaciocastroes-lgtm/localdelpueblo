'use client'

import { useState, useEffect } from 'react'
import { HardDrive, WifiOff, Wifi } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Este indicador es honesto sobre dónde vive la información:
// - Todo el inventario, socios y ventas del día se guardan SOLO en este
//   dispositivo (localStorage). No hay respaldo automático en la nube.
// - El cierre de caja sí se envía al libro (Make) cuando el vendedor
//   aprieta "Enviar cierre al libro" en la pantalla de Cierre de Caja.
// Por eso este ícono muestra conectividad a internet, no "todo respaldado".

type ConnState = 'online' | 'offline'

export function CloudSyncIndicator() {
  const [status, setStatus] = useState<ConnState>('online')

  useEffect(() => {
    const handleOnline = () => setStatus('online')
    const handleOffline = () => setStatus('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (!navigator.onLine) setStatus('offline')

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 h-8 px-2 text-xs">
            {status === 'online' ? (
              <Wifi className="w-4 h-4 text-success" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="hidden sm:inline">
              {status === 'online' ? 'En línea' : 'Sin conexión'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          <div className="text-sm max-w-[220px]">
            <p className="font-medium flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" /> Datos en este dispositivo
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Inventario, socios y ventas del turno se guardan solo en esta tablet.
              El cierre de caja se envía al libro (Make) al finalizar el turno.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
