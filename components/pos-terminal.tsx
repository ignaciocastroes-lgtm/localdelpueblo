'use client'

import { useState, useMemo } from 'react'
import {
  Search, Plus, Minus, ShoppingCart, Trash2, Banknote, QrCode, X,
  Apple, Carrot, Salad, CupSoda, Package, Scale, Percent, ChefHat, Coins
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ProductCustomizer } from '@/components/product-customizer'
import { MercadoPagoCheckout } from '@/components/mercado-pago-checkout'
import {
  formatCLP, formatWeight, calculateCartItemTotal, applyItemDiscount,
  roundToNearestTen, estimateGramsForAmount,
  type Product, type ProductCategory, type CartItem, type CartItemModifier, type CartItemDiscount
} from '@/lib/store'

const categoryIcons: Partial<Record<ProductCategory, React.ReactNode>> = {
  'Frutas': <Apple className="w-4 h-4" />,
  'Verduras': <Carrot className="w-4 h-4" />,
  'Ensaladas y Preparados': <Salad className="w-4 h-4" />,
  'Jugos Naturales': <CupSoda className="w-4 h-4" />,
  'Otros': <Package className="w-4 h-4" />,
}

function getProductIcon(product: Product): React.ReactNode {
  // Preferimos el emoji de referencia del producto (más distintivo que el
  // ícono genérico de categoría, y no depende de internet ni de licencias).
  if (product.emoji) return <span className="text-4xl leading-none">{product.emoji}</span>
  const icon = categoryIcons[product.category]
  return icon
    ? <span className="[&>svg]:w-10 [&>svg]:h-10">{icon}</span>
    : <Package className="w-10 h-10" />
}

const categories: ProductCategory[] = ['Frutas', 'Verduras', 'Ensaladas y Preparados', 'Jugos Naturales', 'Otros']

const DISCOUNT_PRESETS: { label: string; discount: CartItemDiscount }[] = [
  { label: '3x2 (-33%)', discount: { type: 'percent', value: 33, label: '3x2' } },
  { label: '2x1 (-50%)', discount: { type: 'percent', value: 50, label: '2x1' } },
  { label: '-20%', discount: { type: 'percent', value: 20, label: '-20%' } },
  { label: '-30%', discount: { type: 'percent', value: 30, label: '-30%' } },
  { label: '-50%', discount: { type: 'percent', value: 50, label: '-50%' } },
]

interface POSTerminalProps {
  products: Product[]
  onSaleComplete?: (items: CartItem[], type: 'cash' | 'mercadopago', total: number) => void
  currentShift?: string
}

export function POSTerminal({ products, onSaleComplete, currentShift }: POSTerminalProps) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'Todos'>('Todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Producto tipo "peso" que se está pesando/cobrando por monto ahora mismo
  const [weighingProduct, setWeighingProduct] = useState<Product | null>(null)
  const [weighMode, setWeighMode] = useState<'pesar' | 'monto'>('pesar')
  const [weighGramsInput, setWeighGramsInput] = useState('')
  const [weighAmountInput, setWeighAmountInput] = useState('')

  // Producto tipo "preparado" (ej. jugo) que se está personalizando
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null)

  // Descuento manual sobre un ítem del carrito
  const [discountingIndex, setDiscountingIndex] = useState<number | null>(null)
  const [customDiscountPercent, setCustomDiscountPercent] = useState('')

  // Mercado Pago
  const [showMercadoPago, setShowMercadoPago] = useState(false)

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      if (!product.visibleInPOS) return false
      const matchesCategory = selectedCategory === 'Todos' || product.category === selectedCategory
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.brand || '').toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [products, selectedCategory, searchQuery])

  // Precio final de un ítem (después de su descuento manual, si tiene)
  const getItemUnitPrice = (item: CartItem) => applyItemDiscount(item.itemTotal, item.discount)

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + getItemUnitPrice(item) * item.quantity, 0)
  }, [cart])

  const cartTotalRoundedCash = roundToNearestTen(cartTotal)

  const stockRemaining = (product: Product) => {
    const inCart = cart
      .filter(i => i.product.id === product.id)
      .reduce((sum, i) => sum + (product.saleType === 'peso' ? (i.weightGrams || 0) : i.quantity), 0)
    return Math.max(0, product.stock - inCart)
  }

  const handleProductClick = (product: Product) => {
    if (product.saleType === 'peso') {
      setWeighingProduct(product)
      setWeighMode('pesar')
      setWeighGramsInput('')
      setWeighAmountInput('')
      return
    }
    if (product.customizable && product.modifierGroups && product.modifierGroups.length > 0) {
      setCustomizingProduct(product)
      return
    }
    if (stockRemaining(product) <= 0) {
      toast.error(`No queda stock de "${product.name}".`)
      return
    }
    addToCart(product, 1, [])
  }

  const addToCart = (product: Product, quantity: number, modifiers: CartItemModifier[], extra?: { saleMode?: 'pesar' | 'monto'; weightGrams?: number; amountOverride?: number }) => {
    const itemTotal = calculateCartItemTotal(product, modifiers, {
      weightGrams: extra?.weightGrams,
      amountOverride: extra?.amountOverride,
    })

    const isPeso = product.saleType === 'peso'

    setCart(prev => {
      // Los ítems por peso o con modificadores siempre se agregan como línea nueva
      // (cada pesada/preparado es distinto). Los de unidad/atado se acumulan.
      if (isPeso || modifiers.length > 0) {
        return [...prev, {
          product, quantity, modifiers, itemTotal,
          saleMode: extra?.saleMode, weightGrams: extra?.weightGrams,
        }]
      }

      const existingIndex = prev.findIndex(item => item.product.id === product.id && item.modifiers.length === 0 && !item.discount)
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = { ...updated[existingIndex], quantity: updated[existingIndex].quantity + quantity }
        return updated
      }
      return [...prev, { product, quantity, modifiers, itemTotal }]
    })
  }

  const confirmWeighing = () => {
    if (!weighingProduct) return
    const product = weighingProduct

    if (weighMode === 'pesar') {
      const grams = parseInt(weighGramsInput) || 0
      if (grams <= 0) { toast.error('Ingresa un peso válido.'); return }
      if (product.minGrams && grams < product.minGrams) {
        toast.error(`El mínimo de venta para "${product.name}" es ${formatWeight(product.minGrams)}.`)
        return
      }
      if (grams > stockRemaining(product)) {
        toast.error(`Solo quedan ${formatWeight(stockRemaining(product))} de "${product.name}".`)
        return
      }
      addToCart(product, 1, [], { saleMode: 'pesar', weightGrams: grams })
    } else {
      const amount = parseInt(weighAmountInput) || 0
      if (amount <= 0) { toast.error('Ingresa un monto válido.'); return }
      addToCart(product, 1, [], { saleMode: 'monto', amountOverride: amount })
    }

    setWeighingProduct(null)
  }

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const item = prev[index]
      if (item.product.saleType === 'peso') return prev // no aplica stepper a ítems pesados
      const newQuantity = item.quantity + delta
      if (newQuantity <= 0) return prev.filter((_, i) => i !== index)
      if (delta > 0 && newQuantity > item.product.stock) {
        toast.error(`Solo quedan ${item.product.stock} unidades de "${item.product.name}".`)
        return prev
      }
      const updated = [...prev]
      updated[index] = { ...updated[index], quantity: newQuantity }
      return updated
    })
  }

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  const applyDiscountToItem = (index: number, discount: CartItemDiscount | undefined) => {
    setCart(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], discount }
      return updated
    })
    setDiscountingIndex(null)
    setCustomDiscountPercent('')
  }

  const handleCheckout = (type: 'cash' | 'mercadopago') => {
    if (type === 'mercadopago') {
      setShowMercadoPago(true)
      return
    }
    completeSale('cash', cartTotalRoundedCash)
  }

  const completeSale = (type: 'cash' | 'mercadopago', total: number) => {
    onSaleComplete?.(cart, type, total)
    setCart([])
  }

  const handleMercadoPagoComplete = (success: boolean) => {
    setShowMercadoPago(false)
    if (success) completeSale('mercadopago', cartTotal)
  }

  const getCartItemDescription = (item: CartItem) => {
    const parts: string[] = []
    if (item.product.saleType === 'peso') {
      if (item.saleMode === 'pesar' && item.weightGrams) parts.push(formatWeight(item.weightGrams))
      if (item.saleMode === 'monto') parts.push('Por monto pedido')
    }
    if (item.modifiers.length > 0) {
      const addons = item.modifiers.filter(m => m.type === 'addon').map(m => `+${m.modifier.name}`)
      const exclusions = item.modifiers.filter(m => m.type === 'exclusion').map(m => m.modifier.name)
      if (addons.length > 0) parts.push(addons.join(', '))
      if (exclusions.length > 0) parts.push(exclusions.join(', '))
    }
    if (item.discount) parts.push(`Descuento: ${item.discount.label || (item.discount.type === 'percent' ? `-${item.discount.value}%` : `-${formatCLP(item.discount.value)}`)}`)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  const priceLabel = (product: Product) => {
    if (product.saleType === 'peso') return `${formatCLP(product.pricePerKg || 0)} / kg`
    if (product.saleType === 'atado') return `${formatCLP(product.price)} / atado`
    return formatCLP(product.price)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Products Grid */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button
              variant={selectedCategory === 'Todos' ? 'default' : 'outline'}
              size="lg"
              onClick={() => setSelectedCategory('Todos')}
              className="shrink-0 h-11"
            >
              Todos
            </Button>
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="lg"
                onClick={() => setSelectedCategory(category)}
                className="shrink-0 gap-2 h-11"
              >
                {categoryIcons[category]}
                {category}
              </Button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filteredProducts.map(product => {
              const remaining = stockRemaining(product)
              const sinStock = product.saleType === 'peso' ? remaining <= 0 : remaining <= 0
              return (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all overflow-hidden group flex flex-col"
                  onClick={() => handleProductClick(product)}
                >
                  <div className="relative aspect-[4/3] bg-muted overflow-hidden flex items-center justify-center">
                    {product.image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground/50">
                        {getProductIcon(product)}
                      </div>
                    )}

                    {product.saleType === 'peso' && (
                      <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground shadow-md gap-1">
                        <Scale className="w-3 h-3" /> kg
                      </Badge>
                    )}
                    {product.customizable && (
                      <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground shadow-md gap-1">
                        <ChefHat className="w-3 h-3" />
                      </Badge>
                    )}
                    {sinStock && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm">
                        <Badge variant="destructive" className="text-sm font-bold shadow-lg">AGOTADO</Badge>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-3 flex-1 flex flex-col">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </h3>
                    <div className="mt-auto pt-2">
                      <p className="text-lg font-bold text-primary">
                        {priceLabel(product)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Cart */}
      <Card className="flex flex-col h-full">
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Carrito
            </h2>
            <Badge variant="secondary" className="text-sm">
              {cart.length} ítem(s)
            </Badge>
          </div>
        </div>

        <Separator className="my-3" />

        <div className="flex-1 overflow-hidden px-4">
          <ScrollArea className="h-full">
            {cart.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Carrito vacío</p>
                <p className="text-xs mt-1">Selecciona productos para comenzar</p>
              </div>
            ) : (
              <div className="space-y-3 pb-4">
                {cart.map((item, index) => (
                  <div key={index} className="p-3 bg-secondary/30 rounded-lg border border-border/50">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 shrink-0 bg-muted rounded-md overflow-hidden flex items-center justify-center border border-border/50">
                        {item.product.image ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-muted-foreground/50 [&>svg]:w-5 [&>svg]:h-5">{getProductIcon(item.product)}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{item.product.name}</p>
                        {getCartItemDescription(item) && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {getCartItemDescription(item)}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-primary font-bold">
                            {formatCLP(getItemUnitPrice(item) * item.quantity)}
                          </p>
                          <button
                            className="text-xs text-muted-foreground underline flex items-center gap-0.5"
                            onClick={() => setDiscountingIndex(index)}
                          >
                            <Percent className="w-3 h-3" /> descuento
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {item.product.saleType !== 'peso' && (
                          <>
                            <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => updateQuantity(index, -1)}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => updateQuantity(index, 1)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => removeFromCart(index)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="p-4 pt-0 space-y-3">
          <Separator />

          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Total:</span>
            <span className="text-2xl font-bold text-primary">{formatCLP(cartTotal)}</span>
          </div>
          {cartTotalRoundedCash !== cartTotal && (
            <p className="text-xs text-muted-foreground text-right -mt-2">
              En efectivo se cobra {formatCLP(cartTotalRoundedCash)} (redondeo al $10)
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="flex-col h-16 gap-1 text-base border-2"
              disabled={cart.length === 0}
              onClick={() => handleCheckout('cash')}
            >
              <Banknote className="w-6 h-6 text-green-600" />
              <span className="text-xs font-medium">Efectivo</span>
            </Button>
            <Button
              className="flex-col h-16 gap-1 text-base bg-[#009EE3] hover:bg-[#008ACC]"
              disabled={cart.length === 0}
              onClick={() => handleCheckout('mercadopago')}
            >
              <QrCode className="w-6 h-6" />
              <span className="text-xs font-medium">M. Pago</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Diálogo de pesaje / venta por monto */}
      <Dialog open={!!weighingProduct} onOpenChange={(o) => !o && setWeighingProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{weighingProduct?.name}</DialogTitle>
            <DialogDescription>{formatCLP(weighingProduct?.pricePerKg || 0)} / kg</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant={weighMode === 'pesar' ? 'default' : 'outline'} className="flex-1" onClick={() => setWeighMode('pesar')}>
              <Scale className="w-4 h-4 mr-2" /> Pesar
            </Button>
            <Button variant={weighMode === 'monto' ? 'default' : 'outline'} className="flex-1" onClick={() => setWeighMode('monto')}>
              <Coins className="w-4 h-4 mr-2" /> Por monto
            </Button>
          </div>

          {weighMode === 'pesar' ? (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Peso en gramos (según la balanza)</label>
              <Input
                type="number"
                inputMode="numeric"
                autoFocus
                placeholder="Ej: 500"
                value={weighGramsInput}
                onChange={(e) => setWeighGramsInput(e.target.value)}
                className="h-12 text-lg"
              />
              {weighingProduct && parseInt(weighGramsInput) > 0 && (
                <p className="text-right font-bold text-primary text-lg">
                  {formatCLP(Math.round((parseInt(weighGramsInput) / 1000) * (weighingProduct.pricePerKg || 0)))}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Monto pedido por el cliente ($)</label>
              <Input
                type="number"
                inputMode="numeric"
                autoFocus
                placeholder="Ej: 1000"
                value={weighAmountInput}
                onChange={(e) => setWeighAmountInput(e.target.value)}
                className="h-12 text-lg"
              />
              {weighingProduct && parseInt(weighAmountInput) > 0 && (
                <p className="text-right text-sm text-muted-foreground">
                  Referencia para pesar: ~{formatWeight(estimateGramsForAmount(weighingProduct, parseInt(weighAmountInput)))}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setWeighingProduct(null)}>Cancelar</Button>
            <Button onClick={confirmWeighing}>Agregar al carrito</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de descuento manual por ítem */}
      <Dialog open={discountingIndex !== null} onOpenChange={(o) => !o && setDiscountingIndex(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aplicar descuento</DialogTitle>
            <DialogDescription>
              {discountingIndex !== null ? cart[discountingIndex]?.product.name : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {DISCOUNT_PRESETS.map(preset => (
              <Button key={preset.label} variant="outline" onClick={() => discountingIndex !== null && applyDiscountToItem(discountingIndex, preset.discount)}>
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">% personalizado</label>
              <Input
                type="number"
                inputMode="numeric"
                value={customDiscountPercent}
                onChange={(e) => setCustomDiscountPercent(e.target.value)}
                placeholder="Ej: 15"
              />
            </div>
            <Button
              onClick={() => discountingIndex !== null && applyDiscountToItem(discountingIndex, { type: 'percent', value: parseInt(customDiscountPercent) || 0 })}
            >
              Aplicar
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => discountingIndex !== null && applyDiscountToItem(discountingIndex, undefined)}>
              Quitar descuento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Customizer (jugos, etc.) */}
      {customizingProduct && (
        <ProductCustomizer
          product={customizingProduct}
          open={!!customizingProduct}
          onClose={() => setCustomizingProduct(null)}
          onAddToCart={addToCart}
        />
      )}

      {/* Mercado Pago Checkout */}
      <MercadoPagoCheckout
        open={showMercadoPago}
        onClose={() => setShowMercadoPago(false)}
        amount={cartTotal}
        onPaymentComplete={handleMercadoPagoComplete}
      />
    </div>
  )
}
