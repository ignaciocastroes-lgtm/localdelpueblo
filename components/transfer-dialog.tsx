'use client'

import { useState, useEffect } from 'react'
import { Landmark, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { PaymentDetailsFields } from '@/components/payment-details'
import { saveReceipt } from '@/lib/receipt-store'
import { formatCLP } from '@/lib/store'
import { toast } from 'sonner'

export interface TransferMeta {
  reference?: string
  receiptId?: string
  verified: boolean
}

interface TransferDialogProps {
  open: boolean
  total: number
  onClose: () => void
  onConfirm: (meta: TransferMeta) => void
}

// Pago por transferencia: no entra al cajón. El vendedor fotografía el voucher que le muestra
// el cliente (con la cámara de la tablet, o lo sube desde la galería si lo sacó con su celular),
// revisa el banco y recién ahí anota la venta. Si aún no alcanza a revisar el banco, la venta
// queda "por verificar" y se confirma en el Cierre.
export function TransferDialog({ open, total, onClose, onConfirm }: TransferDialogProps) {
  const [reference, setReference] = useState('')
  const [receipt, setReceipt] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setReference(''); setReceipt(null); setVerified(false); setSaving(false) }
  }, [open])

  const confirm = async () => {
    setSaving(true)
    try {
      let receiptId: string | undefined
      if (receipt) {
        receiptId = await saveReceipt(receipt)
        if (!receiptId) toast.warning('No se pudo guardar la foto del voucher; la venta se registra sin ella.')
      }
      onConfirm({ reference: reference.trim() || undefined, receiptId, verified })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Landmark className="w-5 h-5" /> Pago por transferencia</DialogTitle>
          <DialogDescription>Total a recibir: <strong>{formatCLP(total)}</strong> (sin redondeo)</DialogDescription>
        </DialogHeader>

        <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
          <li>Pídele al cliente el voucher de la transferencia.</li>
          <li>Fotografíalo (cámara o galería) y anota el n° de operación.</li>
          <li>Revisa en el banco que el abono llegó.</li>
        </ol>

        <FieldGroup>
          <PaymentDetailsFields method="transfer" reference={reference} onReferenceChange={setReference} receipt={receipt} onReceiptChange={setReceipt} />
        </FieldGroup>

        <label className="flex items-start gap-2 text-sm rounded-lg border p-3">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="w-5 h-5 mt-0.5" />
          <span>
            <strong>Ya revisé el banco</strong>: el abono de {formatCLP(total)} está.
            {!verified && <span className="block text-xs text-amber-600 mt-1">Si no lo marcas, la venta queda POR VERIFICAR y la confirmas en el Cierre.</span>}
          </span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirm} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Registrar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
