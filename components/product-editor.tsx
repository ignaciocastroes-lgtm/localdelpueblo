'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, Trash2, DollarSign, Package, Barcode, FileText, Search, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { type Product, type ProductCategory, type ProductTemplate, type SaleType, formatCLP, productTemplates, getPhotoGallery, saveToPhotoGallery, type GalleryEntry } from '@/lib/store'
import { toast } from 'sonner' // Añadido para notificaciones de error de imagen
import { compressImageFile } from '@/lib/image-utils'
import { PhotoFinder } from '@/components/photo-finder'

interface ExtendedProduct extends Product {
  costPrice?: number
  minStock?: number
  description?: string
  barcode?: string
}

interface ProductEditorProps {
  open: boolean
  onClose: () => void
  product?: ExtendedProduct | null
  onSave: (product: ExtendedProduct, requiresOverride: boolean, overrideReason?: string) => void
  onDelete?: (productId: string) => void
  // Modo "revisar mi catálogo": muestra el avance y permite saltar al siguiente producto
  setup?: { index: number; total: number; onSkip: () => void }
}

const categories: ProductCategory[] = ['Frutas', 'Verduras', 'Ensaladas y Preparados', 'Jugos Naturales', 'Otros']

const saleTypes: { value: SaleType; label: string; hint: string }[] = [
  { value: 'unidad', label: 'Unidad', hint: 'Precio fijo por pieza (ej. lechuga, sandía entera)' },
  { value: 'peso', label: 'Peso (kg)', hint: 'Se pesa en el puesto; el precio es por kilo' },
  { value: 'atado', label: 'Atado', hint: 'Precio fijo por manojo/paquete (ej. cilantro, albahaca)' },
  { value: 'preparado', label: 'Preparado', hint: 'Se arma al momento con variantes (ej. jugo natural)' },
]

export function ProductEditor({ open, onClose, product, onSave, onDelete, setup }: ProductEditorProps) {
  const [formData, setFormData] = useState<ExtendedProduct>({
    id: '',
    name: '',
    price: 0,
    pricePerKg: 0,
    saleType: 'unidad',
    costPrice: 0,
    category: 'Otros',
    stock: 0,
    minStock: 5,
    description: '',
    barcode: '',
    brand: '',
    image: '',
    visibleInPOS: true,
    customizable: false,
  })

  // === NUEVA REFERENCIA PARA LA CÁMARA NATIVA ===
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [buscandoProducto, setBuscandoProducto] = useState(false)
  const [fuenteEncontrada, setFuenteEncontrada] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showGalleryPicker, setShowGalleryPicker] = useState(false)
  const [showPhotoFinder, setShowPhotoFinder] = useState(false)
  const [stockText, setStockText] = useState('')
  const [minStockText, setMinStockText] = useState('')
  const [gallery, setGallery] = useState<GalleryEntry[]>([])
  const [saveNewPhotoToGallery, setSaveNewPhotoToGallery] = useState(true)
  const [imageIsFromGallery, setImageIsFromGallery] = useState(false)

  const applyTemplate = (tpl: ProductTemplate) => {
    setFormData(prev => ({
      ...prev,
      name: tpl.name,
      category: tpl.category,
      brand: tpl.brand || prev.brand,
      customizable: !!tpl.customizable,
      modifierGroups: tpl.modifierGroups,
    }))
    // Si ya existe una foto guardada para este nombre, se precarga sola
    const match = getPhotoGallery().find(g => g.label.trim().toLowerCase() === tpl.name.trim().toLowerCase())
    if (match) {
      setFormData(prev => ({ ...prev, image: match.image }))
      setImageIsFromGallery(true)
    }
    setShowTemplates(false)
    if (tpl.note) toast.info(tpl.note, { duration: 6000 })
  }

  const openGalleryPicker = () => {
    setGallery(getPhotoGallery())
    setShowGalleryPicker(true)
  }

  const pickFromGallery = (entry: GalleryEntry) => {
    setFormData(prev => ({ ...prev, image: entry.image, imageCredit: entry.credit }))
    setImageIsFromGallery(true)
    setShowGalleryPicker(false)
  }

  const buscarPorCodigoBarras = async () => {
    const codigo = formData.barcode?.trim()
    if (!codigo) {
      toast.error('Ingresa o escanea un código de barras primero')
      return
    }
    setBuscandoProducto(true)
    setFuenteEncontrada(null)
    try {
      const res = await fetch(`/api/productos/buscar-codigo?barcode=${encodeURIComponent(codigo)}`)
      const data = await res.json()
      if (data.found) {
        setFormData(prev => ({
          ...prev,
          name: data.name || prev.name,
          brand: data.brand || prev.brand,
          description: data.quantity || prev.description,
          image: data.image || prev.image,
          category: (data.categorySuggestion as ProductCategory) || prev.category,
        }))
        setFuenteEncontrada(data.source)
        toast.success(`Encontrado en ${data.source}. Revisa los datos antes de guardar.`)
      } else {
        toast.error('No se encontró ese código en la base de datos. Ingresa los datos manualmente.')
      }
    } catch {
      toast.error('No se pudo consultar la base de datos de productos. Ingresa los datos manualmente.')
    } finally {
      setBuscandoProducto(false)
    }
  }

  const isEditing = !!product
  const isPeso = formData.saleType === 'peso'

  // En productos por peso el stock se ESCRIBE en kilos (20 = 20 kg) y se guarda en gramos.
  // Antes el campo no tenía unidad: escribir "20" dejaba 20 g de stock.
  const stockToText = (value: number, peso: boolean) => String(peso ? Math.round(value) / 1000 : value)
  const textToStock = (text: string, peso: boolean) => {
    const n = Number(text.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return 0
    return peso ? Math.round(n * 1000) : Math.round(n)
  }

  useEffect(() => {
    if (product) {
      setFormData({
        ...product,
        saleType: product.saleType || 'unidad',
        pricePerKg: product.pricePerKg || 0,
        costPrice: product.costPrice || Math.floor(product.price * 0.6),
        minStock: product.minStock || 5,
        description: product.description || '',
        barcode: product.barcode || '',
      })
      setStockText(stockToText(product.stock, product.saleType === 'peso'))
      setMinStockText(stockToText(product.minStock || 5, product.saleType === 'peso'))
    } else {
      setFormData({
        id: `new-${Date.now()}`,
        name: '',
        price: 0,
        pricePerKg: 0,
        saleType: 'unidad',
        costPrice: 0,
        category: 'Otros',
        stock: 0,
        minStock: 5,
        description: '',
        barcode: '',
        brand: '',
        image: '',
        visibleInPOS: true,
        customizable: false,
      })
      setStockText('0')
      setMinStockText('5')
    }
  }, [product, open])

  const effectiveSalePrice = formData.saleType === 'peso' ? (formData.pricePerKg || 0) : formData.price
  const profitMargin = effectiveSalePrice - (formData.costPrice || 0)
  const profitPercentage = formData.costPrice ? ((profitMargin / formData.costPrice) * 100).toFixed(1) : '0'

  // === MAGIA DE LA CÁMARA / GALERÍA NATIVA ===
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecciona una imagen válida.')
      return
    }

    // Se reduce la foto antes de guardarla: una foto de cámara pesa varios MB y
    // llena la memoria de la tablet (ver lib/image-utils.ts).
    compressImageFile(file)
      .then((dataUrl) => {
        setFormData(prev => ({ ...prev, image: dataUrl, imageCredit: undefined }))
        setImageIsFromGallery(false)
        setSaveNewPhotoToGallery(true)
      })
      .catch(() => toast.error('No se pudo procesar la foto. Prueba con otra imagen.'))

    // Limpiar el input para permitir seleccionar la misma imagen de nuevo si se borra
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = () => {
    // Validación mínima: un producto sin nombre, a $0 o con stock negativo se
    // vendería mal (o gratis) y ensucia el cierre de caja.
    if (!formData.name?.trim()) { toast.error('El producto necesita un nombre'); return }
    if (formData.saleType === 'peso') {
      if (!Number.isFinite(formData.pricePerKg) || (formData.pricePerKg || 0) <= 0) { toast.error('El precio por kilo debe ser mayor a $0'); return }
    } else if (!Number.isFinite(formData.price) || formData.price <= 0) {
      toast.error('El precio de venta debe ser mayor a $0'); return
    }
    if (!Number.isFinite(formData.stock) || formData.stock < 0) { toast.error('El stock no puede ser negativo'); return }
    if (formData.costPrice !== undefined && (!Number.isFinite(formData.costPrice) || formData.costPrice < 0)) { toast.error('El costo no puede ser negativo'); return }

    let requiresOverride = false
    let overrideReason = ''

    const oldEffectivePrice = product?.saleType === 'peso' ? (product?.pricePerKg || 0) : (product?.price || 0)
    const newEffectivePrice = formData.saleType === 'peso' ? (formData.pricePerKg || 0) : formData.price
    if (product && oldEffectivePrice > 0) {
      // Check for significant price changes (>20%)
      const priceDiffPercent = (Math.abs(newEffectivePrice - oldEffectivePrice) / oldEffectivePrice) * 100

      // Check cost price change only if original cost exists and is > 0
      const costDiffPercent = (product.costPrice && product.costPrice > 0)
        ? (Math.abs((formData.costPrice || 0) - product.costPrice) / product.costPrice) * 100
        : 0

      if (priceDiffPercent > 20) {
        requiresOverride = true
        const oldPrice = formatCLP(oldEffectivePrice)
        const newPrice = formatCLP(newEffectivePrice)
        overrideReason = `Cambio de precio de venta mayor a 20%: ${oldPrice} -> ${newPrice} (${priceDiffPercent.toFixed(1)}% de cambio)`
      } else if (costDiffPercent > 20) {
        requiresOverride = true
        const oldCost = formatCLP(product.costPrice || 0)
        const newCost = formatCLP(formData.costPrice || 0)
        overrideReason = `Cambio de precio de costo mayor a 20%: ${oldCost} -> ${newCost} (${costDiffPercent.toFixed(1)}% de cambio)`
      }
    }

    if (!isEditing && !formData.image) toast.warning('Este producto quedó sin foto. Puedes tomarla después desde ✏️ Editar.')
    onSave({ ...formData, name: formData.name.trim() }, requiresOverride, overrideReason)

    // Si la foto es nueva (recién tomada, no venía ya de la galería), se
    // guarda para poder reutilizarla en el próximo producto igual.
    if (!requiresOverride && formData.image && !imageIsFromGallery && saveNewPhotoToGallery && formData.name) {
      saveToPhotoGallery(formData.name, formData.image, formData.imageCredit)
    }
  }

  const handleDelete = () => {
    if (product && onDelete) {
      onDelete(product.id)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {setup && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-600/10 border border-emerald-600/30 px-3 py-2 mb-2 text-sm">
              <span>Revisando tu catálogo: <strong>{setup.index + 1} de {setup.total}</strong></span>
              <Button type="button" variant="ghost" size="sm" onClick={setup.onSkip}>Saltar</Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-xl">
                {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
              </DialogTitle>
              <DialogDescription>
                {isEditing ? 'Modifica los datos del producto' : 'Ingresa los datos del nuevo producto'}
              </DialogDescription>
            </div>
            {!isEditing && (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowTemplates(true)} className="shrink-0">
                Productos Frecuentes
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* === Image Section (Nativa) === */}
          <div className="flex flex-col items-center justify-center gap-2">
            {formData.image ? (
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={formData.image} alt="Producto" className="w-full h-full object-cover" />
                <button
                  type="button"
                  aria-label="Quitar foto"
                  className="absolute top-1 right-1 h-8 w-8 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center"
                  onClick={() => { setFormData({ ...formData, image: '', imageCredit: undefined }); setImageIsFromGallery(false) }}
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ) : (
              <div className="w-full max-w-sm flex flex-col gap-2">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-primary hover:border-primary cursor-pointer transition-colors"
                >
                  <Camera className="w-8 h-8 mb-2" />
                  <span className="text-sm font-medium">Tocar para Foto o Galería</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={openGalleryPicker} className="w-full">
                  Elegir foto ya guardada
                </Button>
              </div>
            )}

            {isEditing && (
            <Button type="button" variant="outline" size="sm" className="w-full max-w-sm gap-2" onClick={() => setShowPhotoFinder(true)} disabled={!formData.name?.trim()}>
              <Search className="w-4 h-4" /> Buscar foto real en internet
            </Button>
            )}
            {!isEditing && !formData.image && (
              <p className="text-[11px] text-muted-foreground text-center max-w-sm">Producto nuevo: toma la foto con la cámara para que se vea igual que en tu puesto.</p>
            )}
            {formData.imageCredit && (
              <p className="text-[10px] text-muted-foreground text-center max-w-sm">Foto: {formData.imageCredit}</p>
            )}

            {formData.image && !imageIsFromGallery && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveNewPhotoToGallery}
                  onChange={(e) => setSaveNewPhotoToGallery(e.target.checked)}
                />
                Guardar esta foto en la Galería para reutilizarla después
              </label>
            )}

            {/* Input oculto mágico de HTML5 que activa el selector del celular */}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
          </div>

          {/* Barcode & Auto-fetch */}
          <FieldGroup>
            <Field>
              <FieldLabel>Código de Barras</FieldLabel>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={formData.barcode || ''}
                    onChange={(e) => { setFormData(prev => ({ ...prev, barcode: e.target.value })); setFuenteEncontrada(null) }}
                    placeholder="Escanear o ingresar código"
                    className="pl-10"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={buscarPorCodigoBarras}
                  disabled={buscandoProducto}
                  className="gap-2 shrink-0"
                >
                  {buscandoProducto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Buscar
                </Button>
              </div>
              {fuenteEncontrada && (
                <p className="text-xs text-muted-foreground mt-1">
                  Datos cargados desde {fuenteEncontrada} — revísalos antes de guardar, no todos los productos chilenos están en esta base.
                </p>
              )}
            </Field>
          </FieldGroup>

          <Separator />

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Nombre del Producto</FieldLabel>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Agua Mineral 500ml"
                />
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel>Emoji de referencia (opcional)</FieldLabel>
                <Input
                  value={formData.emoji || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, emoji: e.target.value }))}
                  placeholder="Ej: 🍅 🥬 🍉"
                  className="text-2xl text-center"
                  maxLength={4}
                />
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel>Marca / Familia</FieldLabel>
                <Input
                  value={formData.brand || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  placeholder="Ej: Coca-Cola, Nestlé..."
                />
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel>Categoría</FieldLabel>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, category: v as ProductCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </div>

          {/* Tipo de venta */}
          <FieldGroup>
            <Field>
              <FieldLabel>¿Cómo se vende?</FieldLabel>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {saleTypes.map(st => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => {
                      const cruza = (st.value === 'peso') !== (formData.saleType === 'peso')
                      setFormData(prev => cruza
                        ? { ...prev, saleType: st.value, stock: 0, minStock: st.value === 'peso' ? 2000 : 5 }
                        : { ...prev, saleType: st.value })
                      if (cruza) { setStockText('0'); setMinStockText(st.value === 'peso' ? '2' : '5') }
                    }}
                    className={`p-2 rounded-lg border text-left text-xs transition-colors ${formData.saleType === st.value ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50'}`}
                  >
                    <span className="font-semibold block">{st.label}</span>
                    <span className="text-muted-foreground">{st.hint}</span>
                  </button>
                ))}
              </div>
            </Field>
          </FieldGroup>

          {/* Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Precio de Costo{formData.saleType === 'peso' ? ' (por kg)' : ''}</FieldLabel>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    value={formData.costPrice || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, costPrice: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    className="pl-10"
                  />
                </div>
              </Field>
            </FieldGroup>

            {formData.saleType === 'peso' ? (
              <FieldGroup>
                <Field>
                  <FieldLabel>Precio por Kilo</FieldLabel>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={formData.pricePerKg || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, pricePerKg: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      className="pl-10"
                    />
                  </div>
                </Field>
              </FieldGroup>
            ) : (
              <FieldGroup>
                <Field>
                  <FieldLabel>{formData.saleType === 'atado' ? 'Precio por Atado' : 'Precio de Venta'}</FieldLabel>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={formData.price || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      className="pl-10"
                    />
                  </div>
                </Field>
              </FieldGroup>
            )}

            <FieldGroup>
              <Field>
                <FieldLabel>Margen de Ganancia</FieldLabel>
                <div className="h-10 px-3 border rounded-md bg-muted flex items-center justify-between">
                  <span className="font-semibold text-green-600 dark:text-green-500">
                    {formatCLP(profitMargin)}
                  </span>
                  <Badge variant="outline" className="text-green-600 dark:text-green-500 border-green-200 dark:border-green-900">
                    +{profitPercentage}%
                  </Badge>
                </div>
              </Field>
            </FieldGroup>
          </div>

          {/* Stock */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Stock Actual {isPeso ? '(kg)' : ''}</FieldLabel>
                <Input
                  type="number"
                  inputMode="decimal"
                  step={isPeso ? '0.1' : '1'}
                  min="0"
                  value={stockText}
                  onChange={(e) => { setStockText(e.target.value); setFormData(prev => ({ ...prev, stock: textToStock(e.target.value, isPeso) })) }}
                  placeholder={isPeso ? 'Ej: 20 (kilos)' : '0'}
                />
                {isPeso && <p className="text-[11px] text-muted-foreground mt-1">En kilos: 20 = 20 kg. Lo guarda en gramos.</p>}
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel>Stock Mínimo (Alerta) {isPeso ? '(kg)' : ''}</FieldLabel>
                <Input
                  type="number"
                  inputMode="decimal"
                  step={isPeso ? '0.1' : '1'}
                  min="0"
                  value={minStockText}
                  onChange={(e) => { setMinStockText(e.target.value); setFormData(prev => ({ ...prev, minStock: textToStock(e.target.value, isPeso) })) }}
                  placeholder={isPeso ? 'Ej: 2' : '5'}
                />
              </Field>
            </FieldGroup>
          </div>

          {/* Description */}
          <FieldGroup>
            <Field>
              <FieldLabel>Descripción</FieldLabel>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción opcional del producto..."
                rows={3}
              />
            </Field>
          </FieldGroup>

          {/* Options */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.visibleInPOS}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, visibleInPOS: checked }))}
              />
              <span className="text-sm">Visible en POS</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.customizable}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, customizable: checked }))}
              />
              <span className="text-sm">Producto Personalizable</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-6">
          {isEditing && onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!formData.name || (formData.saleType === 'peso' ? !formData.pricePerKg : !formData.price)}>
            {isEditing ? 'Guardar Cambios' : 'Crear Producto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {/* Plantillas de productos frecuentes */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Productos Frecuentes</DialogTitle>
            <DialogDescription>Elige uno para precargar nombre, categoría y foto (si ya la guardaste antes).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            {productTemplates.map((tpl) => {
              const photo = gallery.find(g => g.label.trim().toLowerCase() === tpl.name.trim().toLowerCase())
                || getPhotoGallery().find(g => g.label.trim().toLowerCase() === tpl.name.trim().toLowerCase())
              return (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  className="flex items-center gap-3 p-2 rounded-lg border hover:bg-secondary/50 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {photo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={photo.image} alt={tpl.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground">{tpl.category}{tpl.brand ? ` · ${tpl.brand}` : ''}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Selector de fotos ya guardadas en la Galería */}
      <PhotoFinder
        open={showPhotoFinder}
        productName={formData.name || ''}
        onClose={() => setShowPhotoFinder(false)}
        onPick={(dataUrl, credit) => {
          setFormData(prev => ({ ...prev, image: dataUrl, imageCredit: credit }))
          setImageIsFromGallery(false)
          setSaveNewPhotoToGallery(true)
        }}
      />

      <Dialog open={showGalleryPicker} onOpenChange={setShowGalleryPicker}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Galería de Fotos</DialogTitle>
            <DialogDescription>Fotos ya tomadas antes para otros productos.</DialogDescription>
          </DialogHeader>
          {gallery.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Todavía no hay fotos guardadas. Toma una foto con la cámara y se guardará acá automáticamente.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((entry) => (
                <button
                  key={entry.label}
                  onClick={() => pickFromGallery(entry)}
                  className="flex flex-col items-center gap-1 group"
                >
                  <div className="w-full aspect-square rounded-lg overflow-hidden border-2 border-transparent group-hover:border-primary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entry.image} alt={entry.label} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] text-center line-clamp-2">{entry.label}</span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}