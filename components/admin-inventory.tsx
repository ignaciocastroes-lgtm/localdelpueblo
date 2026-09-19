'use client'

import { useState, useMemo, useRef } from 'react'
import { Package, Edit, Plus, Download, Upload, Trash2, KeyRound, ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, DatabaseBackup, Images, MinusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCLP, formatWeight, parseCSVLine, downloadFullBackup, restoreFullBackup, getPhotoGallery, deleteFromPhotoGallery, saveToPhotoGallery, type Product, type GalleryEntry } from '@/lib/store'
import { ProductEditor } from '@/components/product-editor'
import { PinNumpad } from '@/components/pin-numpad'
import { toast } from 'sonner'
import * as ExcelUtils from '@/lib/excel-utils'
import { PhotoFinder } from '@/components/photo-finder'

// "Regalo" = producto que se regala (últimas ventas, productos feos): sale del stock y se anota como regalo.
const MERMA_MOTIVOS = ['Se echó a perder', 'Golpeado / machucado', 'Se secó', 'Sobra de fin de feria', 'Regalo', 'Otro']

export function AdminInventory({ products, adminPin = '1234', onUpdateProduct, onAddProduct, onDeleteProduct, onBulkUpdateProducts, onChangeAdminPin, onClearDemoData, onRegisterMerma, mermaLog = [] }: any) {
  const [mermaProduct, setMermaProduct] = useState<Product | null>(null)
  const [mermaCantidad, setMermaCantidad] = useState('')
  const [mermaMotivo, setMermaMotivo] = useState(MERMA_MOTIVOS[0])

  const confirmMerma = () => {
    if (!mermaProduct) return
    // Productos por peso: se escribe en kilos (0,5 = 500 g) y se descuenta en gramos.
    const raw = Number(mermaCantidad.replace(',', '.'))
    const cantidad = mermaProduct.saleType === 'peso' ? Math.round(raw * 1000) : Math.round(raw)
    if (cantidad <= 0) { toast.error('Ingresa una cantidad válida.'); return }
    onRegisterMerma?.(mermaProduct.id, cantidad, mermaMotivo)
    toast.success(`Merma registrada: ${mermaProduct.name}`)
    setMermaProduct(null)
    setMermaCantidad('')
    setMermaMotivo(MERMA_MOTIVOS[0])
  }

  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [showPinChange, setShowPinChange] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [pendingSave, setPendingSave] = useState<{ product: Product; reason: string } | null>(null)
  const [showClearDemoConfirm, setShowClearDemoConfirm] = useState(false)
  const [showGalleryManager, setShowGalleryManager] = useState(false)
  const [finderProduct, setFinderProduct] = useState<Product | null>(null)

  // "Revisar mi catálogo": recorre los productos uno por uno para ponerles precio, stock y foto real.
  const [setupQueue, setSetupQueue] = useState<string[]>([])
  const [setupPos, setSetupPos] = useState(0)
  const inSetup = setupQueue.length > 0
  const startSetup = () => {
    // Primero los que aún no tienen foto
    const ordered = [...products].sort((a: Product, b: Product) => Number(!!a.image) - Number(!!b.image))
    setSetupQueue(ordered.map((p: Product) => p.id))
    setSetupPos(0)
  }
  const advanceSetup = () => {
    if (setupPos + 1 >= setupQueue.length) {
      setSetupQueue([]); setSetupPos(0)
      toast.success('Catálogo revisado ✓')
    } else {
      setSetupPos(setupPos + 1)
    }
  }
  const setupProduct = inSetup ? products.find((p: Product) => p.id === setupQueue[setupPos]) || null : null
  const [galleryEntries, setGalleryEntries] = useState<GalleryEntry[]>([])

  const openGalleryManager = () => {
    setGalleryEntries(getPhotoGallery())
    setShowGalleryManager(true)
  }

  const handleDeleteGalleryEntry = (label: string) => {
    deleteFromPhotoGallery(label)
    setGalleryEntries(getPhotoGallery())
    toast.success('Foto eliminada de la galería')
  }
  const [diagnostico, setDiagnostico] = useState<any>(null)
  const [checkingDiagnostico, setCheckingDiagnostico] = useState(false)

  const runDiagnostico = async () => {
    setCheckingDiagnostico(true)
    try {
      const res = await fetch('/api/status')
      const data = await res.json()
      setDiagnostico(data)
    } catch {
      toast.error('No se pudo consultar el diagnóstico')
    } finally {
      setCheckingDiagnostico(false)
    }
  }

  // Modificado para manejar borrar, exportar e importar
  const [action, setAction] = useState<{ type: 'export' | 'import' | 'delete' | 'change-pin' | 'restore-backup' | 'clear-demo', id?: string }>()
  const fileRef = useRef<HTMLInputElement>(null)
  const backupFileRef = useRef<HTMLInputElement>(null)
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null)

  const handleRestoreFileSelected = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingRestoreFile(file)
    setAction({ type: 'restore-backup' })
    setShowPin(true)
    if (backupFileRef.current) backupFileRef.current.value = ''
  }

  const applyRestore = async () => {
    if (!pendingRestoreFile) return
    try {
      const text = await pendingRestoreFile.text()
      const parsed = JSON.parse(text)
      const result = restoreFullBackup(parsed)
      if (result.ok) {
        toast.success('Respaldo restaurado. La app se va a recargar para aplicar los cambios.')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        toast.error(result.error || 'No se pudo restaurar el respaldo')
      }
    } catch {
      toast.error('El archivo no es un respaldo JSON válido')
    }
    setPendingRestoreFile(null)
  }

  const handleAdminSuccess = () => {
    setShowPin(false)
    if (action?.type === 'export') {
      // Stock: en GRAMOS para productos por peso; en unidades/atados para el resto.
      const headers = ['ID', 'Nombre', 'Categoria', 'Precio Costo', 'Precio Venta', 'Stock', 'TipoVenta', 'PrecioKg']
      const escapeCsv = (v: any) => `"${String(v).replace(/"/g, '""')}"`
      const rows = products.map((p: any) => [p.id, escapeCsv(p.name), escapeCsv(p.category), p.costPrice || 0, p.price, p.stock, p.saleType || 'unidad', p.pricePerKg || 0].join(','))
      const csv = [headers.join(','), ...rows].join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `inventario.csv`
      link.click()
      toast.success('Inventario descargado')
    } else if (action?.type === 'import') {
      fileRef.current?.click()
    } else if (action?.type === 'delete' && action.id) {
      // Borrado de producto tras colocar el PIN
      if (onDeleteProduct) {
        onDeleteProduct(action.id)
        toast.success('Producto eliminado del inventario')
      } else {
        toast.error('No se pudo eliminar: falta conectar onDeleteProduct')
      }
    } else if (action?.type === 'change-pin') {
      setShowPinChange(true)
    } else if (action?.type === 'restore-backup') {
      applyRestore()
    } else if (action?.type === 'clear-demo') {
      setShowClearDemoConfirm(true)
    }
    setAction(undefined)
  }

  const handleSavePinChange = () => {
    if (!/^\d{4}$/.test(newPin)) { toast.error('El PIN debe ser de 4 dígitos'); return }
    if (onChangeAdminPin) onChangeAdminPin(newPin)
    toast.success('PIN de administrador actualizado')
    setNewPin('')
    setShowPinChange(false)
  }

  const handleImport = async (e: any) => {
    const file = e.target.files?.[0]; if (!file) return
    const text = await file.text()
    const lines = text.split('\n').filter((l: string) => l.trim().length > 0)

    // Se actualiza por ID contra el catálogo actual — así el CSV puede
    // usarse para actualizar precio/stock masivamente sin borrar fotos,
    // marca ni personalización de los productos que ya tenían esos datos.
    const updated = [...products]
    let creados = 0, actualizados = 0, omitidos = 0
    const CATEGORIAS = ['Frutas', 'Verduras', 'Ensaladas y Preparados', 'Jugos Naturales', 'Otros']
    const TIPOS = ['unidad', 'peso', 'atado', 'preparado']

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      if (cols.length < 6) { omitidos++; continue }

      const id = cols[0]
      const existingIdx = id ? updated.findIndex((p: Product) => p.id === id) : -1
      const existing = existingIdx >= 0 ? updated[existingIdx] : undefined

      // Columnas 7 y 8 (TipoVenta, PrecioKg) son opcionales: un CSV viejo de 6
      // columnas sigue funcionando y conserva el tipo de venta del producto.
      const tipoRaw = (cols[6] ?? '').trim().toLowerCase()
      const saleType = (TIPOS.includes(tipoRaw) ? tipoRaw : (existing?.saleType || 'unidad')) as Product['saleType']
      const costPrice = Number(cols[3]) || 0
      const price = Number(cols[4])
      const stock = Number(cols[5])
      const pricePerKg = (cols[7] ?? '') === '' ? (existing?.pricePerKg ?? 0) : Number(cols[7])

      // Fila inválida = se omite (antes entraba un producto a $0 o con decimales
      // tipo "1.500" leído como 1,5, que se vendía casi gratis).
      const precioOk = saleType === 'peso'
        ? Number.isInteger(pricePerKg) && pricePerKg > 0
        : Number.isInteger(price) && price > 0
      if (
        !cols[1]?.trim() || !precioOk ||
        !Number.isInteger(stock) || stock < 0 ||
        !Number.isInteger(costPrice) || costPrice < 0
      ) { omitidos++; continue }

      const parsed = {
        name: cols[1].trim(),
        category: (CATEGORIAS.includes(cols[2]) ? cols[2] : 'Otros') as Product['category'],
        costPrice,
        price: saleType === 'peso' ? (Number.isInteger(price) && price >= 0 ? price : 0) : price,
        stock,
        saleType,
        pricePerKg: saleType === 'peso' ? pricePerKg : (existing?.pricePerKg ?? 0),
      }

      if (existing) {
        // Producto ya existía: se actualizan solo estos campos, se conserva el resto (foto, emoji, etc.)
        updated[existingIdx] = { ...existing, ...parsed }
        actualizados++
      } else {
        updated.push({
          id: id || `prod-${Date.now()}-${i}`,
          ...parsed,
          visibleInPOS: true,
          customizable: false,
          image: '',
        })
        creados++
      }
    }
    if ((creados + actualizados) > 0 && onBulkUpdateProducts) {
      onBulkUpdateProducts(updated)
      toast.success(`Stock sincronizado: ${actualizados} actualizados, ${creados} nuevos${omitidos ? `, ${omitidos} filas omitidas por datos inválidos` : ''}`)
    } else if (omitidos > 0) {
      toast.error(`Ninguna fila válida (${omitidos} omitidas). Revisa que precio y stock sean números enteros sin puntos ni signos (el stock por peso va en gramos).`)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const filtered = useMemo(() => products.filter((p: Product) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(search.toLowerCase())
  ), [products, search])

  const brands = useMemo(() => {
    const set = new Set(products.map((p: Product) => p.brand).filter(Boolean))
    return Array.from(set) as string[]
  }, [products])

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
            <ShieldQuestion className="w-4 h-4" /> Cumplimiento — Régimen de Feriantes (Ley 21.745)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-slate-400">
          <p>
            La <span className="text-slate-200 font-medium">Ley 21.745</span> creó un régimen especial para feriantes: un impuesto sustitutivo del IVA
            de <span className="text-slate-200 font-medium">1,5 %</span> sobre las ventas pagadas por medios electrónicos de un operador autorizado por el SII.
            Lo retiene y declara el operador de pago, y quienes se acogen quedan liberados de declarar IVA y de llevar contabilidad (Circular SII N° 64).
          </p>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              Para acogerse hay que ser persona natural, tener patente municipal de feria libre vigente e inscribirse en el Registro de Feriantes del SII
              (sii.cl/destacados/ferias_libres). Si usas un operador de pago que no está en el listado de autorizados, quedas fuera del régimen.
              Cómo tributan el efectivo y las transferencias directas, y si esta app cumple lo que necesitas, confírmalo con el SII o un contador:
              esta pantalla es informativa.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
            <ShieldQuestion className="w-4 h-4" /> Diagnóstico de Pagos y Libro
          </CardTitle>
          <Button variant="outline" size="sm" onClick={runDiagnostico} disabled={checkingDiagnostico} className="text-slate-300 border-slate-700 hover:bg-slate-800">
            {checkingDiagnostico ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verificar'}
          </Button>
        </CardHeader>
        {diagnostico && (
          <CardContent className="space-y-2 text-sm">
            <div className={`flex items-start gap-2 p-2 rounded-lg ${diagnostico.mercadoPago.valido ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {diagnostico.mercadoPago.valido ? <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              <div>
                <p className="font-semibold">Mercado Pago {diagnostico.mercadoPago.valido ? '— OK' : '— Revisar'}</p>
                <p className="text-xs opacity-80">{diagnostico.mercadoPago.detalle}</p>
              </div>
            </div>
            <div className={`flex items-start gap-2 p-2 rounded-lg ${diagnostico.make.configurado ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {diagnostico.make.configurado ? <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              <div>
                <p className="font-semibold">Make (Libro) {diagnostico.make.configurado ? '— OK' : '— Revisar'}</p>
                <p className="text-xs opacity-80">{diagnostico.make.detalle}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
            <DatabaseBackup className="w-4 h-4" /> Respaldo Completo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-400">
            Todo el inventario y las ventas viven solo en esta tablet. Descarga un respaldo
            todos los días antes de cerrar, y guárdalo en Drive o donde no se pierda con la tablet.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { downloadFullBackup(); toast.success('Respaldo descargado') }}
              className="text-slate-300 border-slate-700 hover:bg-slate-800 flex-1"
            >
              <Download className="w-4 h-4 mr-2" /> Descargar Respaldo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => backupFileRef.current?.click()}
              className="text-red-400 border-red-900 hover:bg-red-950 flex-1"
            >
              <Upload className="w-4 h-4 mr-2" /> Restaurar Respaldo
            </Button>
          </div>
          <input ref={backupFileRef} type="file" accept="application/json" className="hidden" onChange={handleRestoreFileSelected} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setAction({ type: 'clear-demo' }); setShowPin(true); }}
            className="text-red-400 border-red-900 hover:bg-red-950 w-full"
          >
            Vaciar Catálogo de Demostración
          </Button>
        </CardContent>
      </Card>

      {mermaLog.length > 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
              <MinusCircle className="w-4 h-4 text-amber-500" /> Merma Registrada (últimas 10)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {mermaLog.slice(-10).reverse().map((m: any) => (
              <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-800 last:border-0">
                <span className="text-slate-300">{m.productName} — {m.motivo}</span>
                <span className="text-amber-400 font-medium">
                  {products.find((p: Product) => p.id === m.productId)?.saleType === 'peso' ? formatWeight(m.cantidad) : `${m.cantidad} un.`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Fotos reales del catálogo: productos que todavía muestran solo el emoji */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
            <Images className="w-4 h-4" /> Fotos del catálogo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded-lg bg-emerald-600/10 border border-emerald-600/30 p-3 space-y-2">
            <p className="text-xs text-slate-300">
              <strong>Para partir:</strong> revisa tus productos uno por uno: ajusta el precio y el stock, y ponles una foto real
              (búscala en internet o tómala con la cámara). Los productos nuevos que agregues después: siempre foto con la cámara.
            </p>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={startSetup} disabled={products.length === 0}>
              Revisar mi catálogo ({products.length} productos)
            </Button>
          </div>
          {products.filter((p: Product) => !p.image).length === 0 ? (
            <p className="text-xs text-slate-400">Todos los productos tienen foto.</p>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                Estos productos aún muestran solo el emoji. Busca una foto real en internet (necesita conexión) o tómala desde ✏️ Editar.
              </p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {products.filter((p: Product) => !p.image).map((p: Product) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-1 border-b border-slate-800 last:border-0">
                    <span className="text-sm text-slate-200 truncate">{p.emoji ? `${p.emoji} ` : ''}{p.name}</span>
                    <Button variant="outline" size="sm" onClick={() => setFinderProduct(p)} className="shrink-0 text-slate-300 border-slate-700 hover:bg-slate-800">
                      Buscar foto
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
          {products.some((p: Product) => p.imageCredit) && (
            <details className="pt-2">
              <summary className="text-xs text-slate-300 cursor-pointer">Créditos de fotos</summary>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
                {products.filter((p: Product) => p.imageCredit).map((p: Product) => (
                  <li key={p.id}><span className="text-slate-300">{p.name}:</span> {p.imageCredit}</li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      <PhotoFinder
        open={!!finderProduct}
        productName={finderProduct?.name || ''}
        onClose={() => setFinderProduct(null)}
        onPick={(dataUrl, credit) => {
          if (!finderProduct) return
          onUpdateProduct?.({ ...finderProduct, image: dataUrl, imageCredit: credit })
          saveToPhotoGallery(finderProduct.name, dataUrl, credit)
          toast.success(`Foto guardada para ${finderProduct.name}`)
        }}
      />

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
            <Images className="w-4 h-4" /> Galería de Fotos
          </CardTitle>
          <Button variant="outline" size="sm" onClick={openGalleryManager} className="text-slate-300 border-slate-700 hover:bg-slate-800">
            Ver Galería
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400">
            Cada foto que tomas al cargar un producto queda guardada acá y se puede reutilizar para
            el próximo producto igual, sin volver a fotografiar.
          </p>
        </CardContent>
      </Card>

      <Dialog open={showGalleryManager} onOpenChange={setShowGalleryManager}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Galería de Fotos</DialogTitle>
          </DialogHeader>
          {galleryEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Todavía no hay fotos guardadas. Se van agregando solas cuando cargan un producto con foto nueva.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {galleryEntries.map((entry) => (
                <div key={entry.label} className="flex flex-col items-center gap-1">
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden border group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entry.image} alt={entry.label} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleDeleteGalleryEntry(entry.label)}
                      aria-label={`Eliminar foto ${entry.label}`}
                      className="absolute top-1 right-1 h-8 w-8 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                  <span className="text-[10px] text-center line-clamp-2 text-slate-300">{entry.label}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Registrar Merma: lo que se pierde SIN vender, distinto de lo vendido con descuento */}
      <Dialog open={!!mermaProduct} onOpenChange={(o) => !o && setMermaProduct(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar merma o regalo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{mermaProduct?.name}</p>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              {mermaProduct?.saleType === 'peso' ? 'Cantidad perdida (kilos)' : 'Cantidad perdida (unidades/atados)'}
            </label>
            <Input
              type="number"
              inputMode="numeric"
              autoFocus
              value={mermaCantidad}
              onChange={(e) => setMermaCantidad(e.target.value)}
              placeholder={mermaProduct?.saleType === 'peso' ? 'Ej: 0.5 (medio kilo)' : 'Ej: 3'}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Motivo</label>
            <div className="flex flex-wrap gap-2">
              {MERMA_MOTIVOS.map(m => (
                <button
                  key={m}
                  onClick={() => setMermaMotivo(m)}
                  className={`text-xs px-2 py-1 rounded-full border ${mermaMotivo === m ? 'bg-amber-500 text-white border-amber-500' : 'text-slate-400 border-slate-700'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setMermaProduct(null)}>Cancelar</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={confirmMerma}>Registrar y descontar stock</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearDemoConfirm} onOpenChange={(o) => !o && setShowClearDemoConfirm(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">¿Vaciar catálogo de demostración?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esto borra TODOS los productos de ejemplo para que puedas cargar tu catálogo real
            desde cero. No se puede deshacer con un clic — si quieres conservar algo, descarga
            un respaldo antes.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowClearDemoConfirm(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => { onClearDemoData?.(); setShowClearDemoConfirm(false) }}
            >
              Sí, vaciar todo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="bg-slate-900 border-emerald-600/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-emerald-600 flex items-center gap-2"><Package /> STOCK</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAction({ type: 'export' }); setShowPin(true); }} className="text-slate-300 border-slate-700 hover:bg-slate-800"><Download className="w-4 h-4 mr-2" /> Exportar</Button>
            <Button variant="outline" size="sm" onClick={() => { setAction({ type: 'import' }); setShowPin(true); }} className="text-slate-300 border-slate-700 hover:bg-slate-800"><Upload className="w-4 h-4 mr-2" /> Importar</Button>
            <Button variant="outline" size="sm" onClick={() => { setAction({ type: 'change-pin' }); setShowPin(true); }} className="text-slate-300 border-slate-700 hover:bg-slate-800"><KeyRound className="w-4 h-4 mr-2" /> PIN Admin</Button>
            <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { setEditingProduct(null); setShowEditor(true); }}><Plus className="w-4 h-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Filtrar por producto o marca..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
          {brands.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {brands.map((b) => (
                <button
                  key={b}
                  onClick={() => setSearch(search === b ? '' : b)}
                  className={`text-xs px-2 py-1 rounded-full border ${search === b ? 'bg-emerald-600 text-white border-emerald-600' : 'text-slate-400 border-slate-700 hover:border-emerald-400'}`}
                >
                  {b}
                </button>
              ))}
            </div>
          )}
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader><TableRow className="border-slate-800"><TableHead>Producto</TableHead><TableHead className="text-center">Stock</TableHead><TableHead className="text-right">Precio</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((p: Product) => (
                  <TableRow key={p.id} className="border-slate-800">
                    <TableCell className="font-bold text-white uppercase">
                      {p.name}
                      {p.brand && <span className="block text-[10px] font-normal normal-case text-slate-400">{p.brand}</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={(p.saleType === 'peso' ? p.stock <= (p.minStock || 1000) : p.stock <= 5) ? "destructive" : "outline"}>
                        {p.saleType === 'peso' ? formatWeight(p.stock) : p.stock}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-400">
                      {p.saleType === 'peso' ? `${formatCLP(p.pricePerKg || 0)}/kg` : formatCLP(p.price)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="text-amber-500 hover:bg-amber-500/20 h-8 w-8" title="Registrar merma" onClick={(e) => { e.stopPropagation(); setMermaProduct(p); setMermaCantidad(''); }}><MinusCircle className="w-4 h-4" /></Button>
                        {/* NUEVO BOTÓN ELIMINAR */}
                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-500/20 h-8 w-8" onClick={(e) => { e.stopPropagation(); setAction({ type: 'delete', id: p.id }); setShowPin(true); }}><Trash2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-emerald-400 hover:bg-emerald-400/20 h-8 w-8" onClick={() => { setEditingProduct(p); setShowEditor(true); }}><Edit className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      <ProductEditor
        open={showEditor || (inSetup && !!setupProduct)}
        onClose={() => { setShowEditor(false); setSetupQueue([]); setSetupPos(0) }}
        product={inSetup ? setupProduct : editingProduct}
        setup={inSetup ? { index: setupPos, total: setupQueue.length, onSkip: advanceSetup } : undefined}
        onSave={(p: any, requiresOverride: boolean, reason?: string) => {
          if (requiresOverride) {
            setPendingSave({ product: p, reason: reason || '' })
            return
          }
          if (products.some((x: Product) => x.id === p.id)) onUpdateProduct(p); else onAddProduct(p)
          if (inSetup) advanceSetup(); else setShowEditor(false)
        }}
      />

      {/* Confirmación obligatoria para cambios de precio/costo mayores a 20% */}
      <Dialog open={!!pendingSave} onOpenChange={(o) => !o && setPendingSave(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirmar cambio de precio</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{pendingSave?.reason}</p>
          <p className="text-sm">¿Confirmas este cambio? No se puede deshacer con un clic.</p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setPendingSave(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingSave) {
                  if (products.some((x: Product) => x.id === pendingSave.product.id)) onUpdateProduct(pendingSave.product); else onAddProduct(pendingSave.product)
                }
                setPendingSave(null)
                if (inSetup) advanceSetup(); else setShowEditor(false)
              }}
            >
              Confirmar de todos modos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CANDADO DE PIN PARA BORRAR PRODUCTO / CAMBIAR PIN */}
      <PinNumpad
        open={showPin}
        correctPin={adminPin}
        onClose={() => { setShowPin(false); setAction(undefined); }}
        onSuccess={handleAdminSuccess}
        title={action?.type === 'delete' ? 'PIN PARA ELIMINAR' : action?.type === 'change-pin' ? 'PIN Actual' : action?.type === 'restore-backup' ? 'PIN PARA RESTAURAR RESPALDO' : action?.type === 'clear-demo' ? 'PIN PARA VACIAR DEMO' : 'Acceso Admin'}
      />

      <Dialog open={showPinChange} onOpenChange={(o) => !o && setShowPinChange(false)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Nuevo PIN de Administrador</DialogTitle>
          </DialogHeader>
          <Input
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="****"
            className="text-center text-2xl tracking-widest"
          />
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSavePinChange}>Guardar PIN</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}