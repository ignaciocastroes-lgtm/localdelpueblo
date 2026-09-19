'use client'

import { useState, useEffect, useRef } from 'react'
import { QrCode, CheckCircle2, XCircle, Loader2, RefreshCw, Smartphone, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { formatCLP } from '@/lib/store'
import { toast } from 'sonner'

type PaymentState = 'generating' | 'waiting' | 'processing' | 'success' | 'failed'

interface MercadoPagoCheckoutProps {
  open: boolean
  onClose: () => void
  amount: number
  onPaymentComplete: (success: boolean) => void
}

export function MercadoPagoCheckout({ open, onClose, amount, onPaymentComplete }: MercadoPagoCheckoutProps) {
  const [paymentState, setPaymentState] = useState<PaymentState>('generating')
  const [countdown, setCountdown] = useState(120)
  const [simulateResult, setSimulateResult] = useState<'success' | 'failed' | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const externalRefRef = useRef<string>('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  // Al abrir (o al reintentar): intenta crear un cobro REAL contra Mercado Pago.
  //
  // Si el servidor dice que Mercado Pago no está configurado (falta MP_ACCESS_TOKEN) se muestra
  // un aviso y se cierra. Cualquier otro fallo (sin internet, MP caído, rechazo) termina en
  // "no se pudo generar el cobro". En ningún caso hay botones de simulación: si no, una venta
  // podría quedar como pagada sin que haya entrado un peso.
  useEffect(() => {
    if (!open) {
      setPaymentState('generating')
      setCountdown(120)
      setSimulateResult(null)
      setIsDemoMode(false)
      setQrImageUrl(null)
      setCheckoutUrl(null)
      setErrorMsg(null)
      setAttempt(0)
      stopPolling()
      return
    }

    let cancelled = false
    externalRefRef.current = `venta-${Date.now()}`

    // Estado limpio en cada intento (también en "Reintentar")
    setPaymentState('generating')
    setCountdown(120)
    setSimulateResult(null)
    setIsDemoMode(false)
    setQrImageUrl(null)
    setCheckoutUrl(null)
    setErrorMsg(null)
    stopPolling()

    const crearCobro = async () => {
      try {
        const res = await fetch('/api/mercadopago/crear-pago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            description: 'Venta Kiosko',
            externalReference: externalRefRef.current,
          }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (cancelled) return
          if (body?.code === 'MP_NOT_CONFIGURED') {
            // Sin credenciales NO hay "modo demo": se avisa y se cierra, para que nadie
            // registre como pagada una venta que no cobró Mercado Pago.
            toast.error('Mercado Pago no está configurado (falta MP_ACCESS_TOKEN en Vercel). Cobra en efectivo o por transferencia y avisa al administrador.', { duration: 10000 })
            onClose()
          } else {
            setErrorMsg('Mercado Pago rechazó la solicitud. Intenta de nuevo o cobra en efectivo.')
            setPaymentState('failed')
          }
          return
        }

        const data = await res.json()
        if (cancelled) return

        setCheckoutUrl(data.initPoint)
        setQrImageUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.initPoint)}`)
        setIsDemoMode(false)
        setPaymentState('waiting')
        startPolling()
      } catch {
        if (cancelled) return
        setErrorMsg('No hay conexión con Mercado Pago. Revisa el internet de la tablet o cobra en efectivo.')
        setPaymentState('failed')
      }
    }

    const startPolling = () => {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/mercadopago/estado?ref=${encodeURIComponent(externalRefRef.current)}`)
          if (!res.ok) return
          const data = await res.json()
          if (data.status === 'approved') {
            stopPolling()
            setPaymentState('processing')
            setTimeout(() => setPaymentState('success'), 800)
          } else if (data.status === 'rejected' || data.status === 'cancelled') {
            stopPolling()
            setPaymentState('failed')
          }
        } catch {
          // Silencioso: se reintenta en el próximo ciclo
        }
      }, 3000)
    }

    crearCobro()

    return () => { cancelled = true; stopPolling() }
  }, [open, amount, attempt])

  useEffect(() => {
    if (paymentState !== 'waiting') return

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          stopPolling()
          setPaymentState('failed')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [paymentState])

  // Solo aplica en Modo Demo: los botones de simulación
  useEffect(() => {
    if (simulateResult === null) return

    setPaymentState('processing')

    const processTimer = setTimeout(() => {
      setPaymentState(simulateResult)
    }, 2000)

    return () => clearTimeout(processTimer)
  }, [simulateResult])

  const handleClose = () => {
    stopPolling()
    if (paymentState === 'success') {
      onPaymentComplete(true)
    } else if (paymentState === 'failed') {
      onPaymentComplete(false)
    }
    onClose()
  }

  // Reintentar = generar un cobro NUEVO (el QR anterior ya expiró o falló).
  const handleRetry = () => {
    setAttempt(a => a + 1)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {/* Mercado Pago Header */}
        <div className="bg-[#009EE3] -mx-6 -mt-6 px-6 py-4 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-6 h-6">
                <circle cx="20" cy="20" r="18" fill="#009EE3"/>
                <path d="M12 20c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8-8-3.6-8-8z" fill="white"/>
                <path d="M15 18h10v4H15z" fill="#009EE3"/>
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Mercado Pago</h2>
              <p className="text-white/80 text-sm">Pago con QR</p>
            </div>
          </div>
        </div>

        <div className="py-6">
          {/* Generating State */}
          {paymentState === 'generating' && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-[#009EE3]/10 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-[#009EE3] animate-spin" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Generando código QR...</h3>
                <p className="text-muted-foreground text-sm mt-1">Espera un momento</p>
              </div>
            </div>
          )}

          {/* Waiting for Payment */}
          {paymentState === 'waiting' && (
            <div className="text-center space-y-6">
              {/* QR Code: real si hay integración, decorativo si es demo */}
              <div className="relative mx-auto w-64 h-64 bg-white rounded-xl border-4 border-[#009EE3] p-4 shadow-lg">
                {qrImageUrl ? (
                  <img src={qrImageUrl} alt="Código QR de pago" className="w-full h-full object-contain" />
                ) : (
                  <>
                    <div className="w-full h-full grid grid-cols-8 gap-0.5">
                      {Array.from({ length: 64 }).map((_, i) => (
                        <div
                          key={i}
                          className={`aspect-square ${
                            Math.random() > 0.5 ? 'bg-foreground' : 'bg-background'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <QrCode className="w-10 h-10 text-[#009EE3]" />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Amount */}
              <div className="bg-[#009EE3]/10 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total a pagar</p>
                <p className="text-3xl font-bold text-[#009EE3]">{formatCLP(amount)}</p>
              </div>

              {/* Instructions */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="w-4 h-4" />
                <span>Escanea con la app de Mercado Pago</span>
              </div>

              {/* Countdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tiempo restante</span>
                  <span className="font-mono font-bold">{formatTime(countdown)}</span>
                </div>
                <Progress value={(countdown / 120) * 100} className="h-2" />
              </div>

              <p className="text-xs text-muted-foreground pt-2 border-t">
                El cobro se confirma automáticamente apenas el cliente paga. No hace falta apretar nada.
              </p>
            </div>
          )}

          {/* Processing State */}
          {paymentState === 'processing' && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-[#009EE3]/10 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-[#009EE3] animate-spin" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Procesando pago...</h3>
                <p className="text-muted-foreground text-sm mt-1">Verificando con Mercado Pago</p>
              </div>
            </div>
          )}

          {/* Success State */}
          {paymentState === 'success' && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-14 h-14 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-2xl text-green-600">Pago Confirmado</h3>
                <p className="text-muted-foreground mt-2">
                  Se han cobrado {formatCLP(amount)} exitosamente
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-sm text-green-800">
                <p className="font-medium">Pago verificado en Mercado Pago</p>
                <p className="text-green-600 mt-1">Ref: {externalRefRef.current}</p>
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleClose}
              >
                Continuar
              </Button>
            </div>
          )}

          {/* Failed State */}
          {paymentState === 'failed' && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-14 h-14 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-2xl text-red-600">
                  {errorMsg ? 'No se pudo generar el cobro' : 'Pago no completado'}
                </h3>
                <p className="text-muted-foreground mt-2">
                  No se registró ninguna venta. Puedes reintentar o cobrar de otra forma.
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-sm text-red-800">
                <p>{errorMsg || 'El código QR expiró o el pago fue rechazado.'}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleRetry}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reintentar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
