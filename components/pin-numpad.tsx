'use client'

import { useState, useEffect } from 'react'
import { Lock, Delete, X, ShieldCheck, ShieldAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface PinNumpadProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  title?: string
  description?: string
  correctPin?: string
}

export function PinNumpad({ 
  open, 
  onClose, 
  onSuccess, 
  title = 'Acceso Administrador',
  description = 'Ingrese el PIN de administrador para continuar',
  correctPin = '1234' 
}: PinNumpadProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) {
      setPin('')
      setError(false)
      setSuccess(false)
    }
  }, [open])

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit
      setPin(newPin)
      setError(false)

      if (newPin.length === 4) {
        if (newPin === correctPin) {
          setSuccess(true)
          setTimeout(() => {
            onSuccess()
            onClose()
          }, 500)
        } else {
          setError(true)
          setTimeout(() => {
            setPin('')
            setError(false)
          }, 800)
        }
      }
    }
  }

  const handleDelete = () => {
    setPin(pin.slice(0, -1))
    setError(false)
  }

  const handleClear = () => {
    setPin('')
    setError(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-center">
          <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
            success ? 'bg-green-500' : error ? 'bg-destructive' : 'bg-primary'
          }`}>
            {success ? (
              <ShieldCheck className="w-8 h-8 text-white" />
            ) : error ? (
              <ShieldAlert className="w-8 h-8 text-white" />
            ) : (
              <Lock className="w-8 h-8 text-primary-foreground" />
            )}
          </div>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* PIN Display */}
        <div className="flex justify-center gap-3 py-6">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                success ? 'border-green-500 bg-green-500/10' :
                error ? 'border-destructive bg-destructive/10 animate-shake' :
                pin.length > index ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              {pin.length > index ? '●' : ''}
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-center text-destructive text-sm font-medium animate-pulse">
            PIN incorrecto. Intente nuevamente.
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <Button
              key={digit}
              variant="outline"
              className="h-16 text-2xl font-semibold hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all"
              onClick={() => handleDigit(digit)}
              disabled={success}
            >
              {digit}
            </Button>
          ))}
          <Button
            variant="outline"
            className="h-16 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={handleClear}
            disabled={success}
          >
            <X className="w-6 h-6" />
          </Button>
          <Button
            variant="outline"
            className="h-16 text-2xl font-semibold hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all"
            onClick={() => handleDigit('0')}
            disabled={success}
          >
            0
          </Button>
          <Button
            variant="outline"
            className="h-16 hover:bg-muted"
            onClick={handleDelete}
            disabled={success}
          >
            <Delete className="w-6 h-6" />
          </Button>
        </div>

        <Button 
          variant="ghost" 
          className="mt-2"
          onClick={onClose}
          disabled={success}
        >
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  )
}
