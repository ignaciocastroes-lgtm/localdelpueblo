'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Clock, Plus, ShieldCheck } from 'lucide-react'
import { PinNumpad } from '@/components/pin-numpad'
import type { Seller } from '@/lib/store'
import { toast } from 'sonner'

interface ShiftSelectorProps {
  open: boolean
  sellers: Seller[]
  adminPin: string
  onSelect: (seller: Seller) => void
  onAddSeller: (seller: Seller) => void
}

export function ShiftSelector({ open, sellers, adminPin, onSelect, onAddSeller }: ShiftSelectorProps) {
  const [time, setTime] = useState(new Date())
  const [pendingSeller, setPendingSeller] = useState<Seller | null>(null)
  const [showAdminGate, setShowAdminGate] = useState(false)
  const [showNewSeller, setShowNewSeller] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')

  useEffect(() => {
    if (open) {
      const timer = setInterval(() => setTime(new Date()), 1000)
      return () => clearInterval(timer)
    }
  }, [open])

  const dateStr = time.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = time.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })

  const activeSellers = sellers.filter(s => s.active)

  const handleCreateSeller = () => {
    const cleanPin = newPin.trim()
    if (!newName.trim()) { toast.error('Ingresa el nombre del vendedor'); return }
    if (!/^\d{4}$/.test(cleanPin)) { toast.error('El PIN debe ser de 4 dígitos'); return }
    if (sellers.some(s => s.pin === cleanPin)) { toast.error('Ese PIN ya lo usa otro vendedor, elige otro'); return }

    onAddSeller({
      id: `seller-${Date.now()}`,
      name: newName.trim(),
      pin: cleanPin,
      role: 'vendedor',
      active: true,
    })
    toast.success(`Vendedor "${newName.trim()}" agregado`)
    setNewName('')
    setNewPin('')
    setShowNewSeller(false)
  }

  return (
    <Dialog open={open} onOpenChange={() => { }}>
      <DialogContent showCloseButton={false} className="sm:max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl">
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#0a1f16] rounded-full flex items-center justify-center mb-2 shadow-lg shadow-blue-900/20">
            <Clock className="w-8 h-8 text-emerald-600" />
          </div>
          <DialogTitle className="text-3xl font-bold text-[#0a1f16] dark:text-white">
            {showNewSeller ? 'Nuevo Vendedor' : '¿Quién vende hoy?'}
          </DialogTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 capitalize">{dateStr}</p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-200 font-mono">{timeStr}</p>
        </DialogHeader>

        {!showNewSeller ? (
          <>
            <div className="grid grid-cols-2 gap-3 py-4">
              {activeSellers.map((seller) => (
                <button
                  key={seller.id}
                  onClick={() => setPendingSeller(seller)}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {seller.role === 'admin' ? <ShieldCheck className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{seller.name}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 mt-1 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
                    {seller.role === 'admin' ? 'Admin' : 'Vendedor'}
                  </span>
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setShowAdminGate(true)}
            >
              <Plus className="w-4 h-4" /> Agregar vendedor
            </Button>
          </>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="seller-name">Nombre</Label>
              <Input id="seller-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: María Pérez" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seller-pin">PIN de 4 dígitos</Label>
              <Input
                id="seller-pin"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="****"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowNewSeller(false); setNewName(''); setNewPin('') }}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateSeller}>
                Crear vendedor
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* PIN del vendedor seleccionado para confirmar identidad */}
      <PinNumpad
        open={!!pendingSeller}
        onClose={() => setPendingSeller(null)}
        correctPin={pendingSeller?.pin}
        title={`PIN de ${pendingSeller?.name || ''}`}
        description="Ingresa tu PIN personal para iniciar tu turno"
        onSuccess={() => { if (pendingSeller) onSelect(pendingSeller); setPendingSeller(null) }}
      />

      {/* Solo un admin puede habilitar el alta de un nuevo vendedor */}
      <PinNumpad
        open={showAdminGate}
        onClose={() => setShowAdminGate(false)}
        correctPin={adminPin}
        title="PIN de Administrador"
        description="Se requiere autorización para agregar un vendedor"
        onSuccess={() => { setShowAdminGate(false); setShowNewSeller(true) }}
      />
    </Dialog>
  )
}
