'use client'

import { useRef, useState } from 'react'
import { Camera, Image as ImageIcon, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldLabel, Field } from '@/components/ui/field'
import { compressImageFile } from '@/lib/image-utils'
import { getReceipt } from '@/lib/receipt-store'
import { toast } from 'sonner'

export interface PaymentExtra {
  reference?: string
  receiptId?: string
  cashSource?: 'caja' | 'dueno'
}

interface PaymentDetailsFieldsProps {
  method: string
  reference: string
  onReferenceChange: (v: string) => void
  receipt: string | null
  onReceiptChange: (dataUrl: string | null) => void
}

// Campos opcionales del pago: n° de operación y foto del comprobante.
// La foto se elige desde la cámara o la galería de la tablet.
export function PaymentDetailsFields({ method, reference, onReferenceChange, receipt, onReceiptChange }: PaymentDetailsFieldsProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const isCash = method === 'cash'

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Selecciona una imagen.'); return }
    setProcessing(true)
    try {
      // 1000 px: suficiente para leer el texto de un comprobante.
      onReceiptChange(await compressImageFile(file, 1000, 0.6))
    } catch {
      toast.error('No se pudo procesar la foto. Prueba con otra.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      {!isCash && (
        <Field>
          <FieldLabel>N° de operación / referencia (opcional)</FieldLabel>
          <Input
            value={reference}
            onChange={(e) => onReferenceChange(e.target.value.slice(0, 40))}
            placeholder="Ej: 12345678"
          />
        </Field>
      )}
      <Field>
        <FieldLabel>{isCash ? 'Foto de boleta o comprobante (opcional)' : 'Foto del comprobante (opcional)'}</FieldLabel>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        {receipt ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receipt} alt="Comprobante" className="w-16 h-16 object-cover rounded-md border" />
            <Button type="button" variant="outline" size="sm" onClick={() => onReceiptChange(null)}>
              <X className="w-4 h-4 mr-1" /> Quitar
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="w-full gap-2" disabled={processing} onClick={() => fileRef.current?.click()}>
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            Tomar o adjuntar foto
          </Button>
        )}
      </Field>
    </>
  )
}

// Botón "Comprobante" para las listas de pagos: abre la foto guardada.
export function ReceiptViewer({ receiptId }: { receiptId?: string }) {
  const [open, setOpen] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!receiptId) return null

  const show = async () => {
    setOpen(true)
    setLoading(true)
    setImage(await getReceipt(receiptId))
    setLoading(false)
  }

  return (
    <>
      <button type="button" onClick={show} className="inline-flex items-center gap-1 text-[10px] text-primary underline">
        <ImageIcon className="w-3 h-3" /> Comprobante
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Comprobante</DialogTitle></DialogHeader>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Comprobante" className="w-full rounded-md border" />
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              La foto no está disponible en esta tablet (se guardó en otro dispositivo o se borraron los datos del navegador).
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// Solo para pagos en EFECTIVO: ¿de dónde salió la plata? Sin respuesta por defecto a propósito:
// equivocarse en cualquier dirección deja un sobrante o faltante falso en el arqueo.
export function CashSourceField({ value, onChange }: { value: 'caja' | 'dueno' | null; onChange: (v: 'caja' | 'dueno') => void }) {
  return (
    <Field>
      <FieldLabel>¿De dónde salió el efectivo?</FieldLabel>
      <div className="grid grid-cols-2 gap-2">
        {([['caja', 'Del cajón del puesto', 'baja el arqueo de la caja'], ['dueno', 'De mi bolsillo', 'no toca el cajón']] as const).map(([v, label, hint]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`p-2 rounded-lg border text-left text-xs ${value === v ? 'border-primary bg-primary/10' : 'border-border'}`}
          >
            <span className="font-semibold block">{label}</span>
            <span className="text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>
    </Field>
  )
}
