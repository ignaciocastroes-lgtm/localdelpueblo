'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Minus, ChefHat, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  type Product, 
  type CartItemModifier, 
  type Modifier,
  getModifierGroupById,
  formatCLP,
  calculateCartItemTotal
} from '@/lib/store'
import { SafeImage } from '@/components/safe-image'

interface ProductCustomizerProps {
  product: Product
  open: boolean
  onClose: () => void
  onAddToCart: (product: Product, quantity: number, modifiers: CartItemModifier[]) => void
  disabledModifierIds?: string[]   // opciones que hoy no hay (el administrador las apaga)
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)
    
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

export function ProductCustomizer({ product, open, onClose, onAddToCart, disabledModifierIds = [] }: ProductCustomizerProps) {
  const [quantity, setQuantity] = useState(1)
  const [selectedModifiers, setSelectedModifiers] = useState<CartItemModifier[]>([])
  const isMobile = useMediaQuery('(max-width: 768px)')

  const modifierGroups = useMemo(() => {
    if (!product.modifierGroups) return []
    return (product.modifierGroups
      .map(id => getModifierGroupById(id))
      .filter(Boolean) as { id: string; name: string; modifiers: Modifier[] }[])
      // Opciones apagadas hoy (ej. "Piña" si no hay): no se ofrecen
      .map(g => ({ ...g, modifiers: g.modifiers.filter(m => !disabledModifierIds.includes(m.id)) }))
  }, [product.modifierGroups, disabledModifierIds])

  const addonsGroup = modifierGroups.filter(g => g.modifiers.some(m => m.type === 'addon'))
  const exclusionsGroup = modifierGroups.filter(g => g.modifiers.some(m => m.type === 'exclusion'))

  const itemTotal = useMemo(() => {
    return calculateCartItemTotal(product, selectedModifiers) * quantity
  }, [product, selectedModifiers, quantity])

  const toggleModifier = (modifier: Modifier) => {
    setSelectedModifiers(prev => {
      const exists = prev.find(m => m.modifier.id === modifier.id)
      if (exists) {
        return prev.filter(m => m.modifier.id !== modifier.id)
      }
      return [...prev, { modifier, type: modifier.type }]
    })
  }

  const isModifierSelected = (modifierId: string) => {
    return selectedModifiers.some(m => m.modifier.id === modifierId)
  }

  const handleAddToCart = () => {
    onAddToCart(product, quantity, selectedModifiers)
    setQuantity(1)
    setSelectedModifiers([])
    onClose()
  }

  const handleClose = () => {
    setQuantity(1)
    setSelectedModifiers([])
    onClose()
  }

  // Content that's shared between Dialog and Drawer
  const CustomizerContent = (
    <div className="space-y-6 px-1">
      {/* Product Image */}
      {product.image && (
        <div className="relative h-32 md:h-40 rounded-xl overflow-hidden">
          <SafeImage
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            fallback={null}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-3">
            <p className="text-white text-2xl font-bold">{formatCLP(product.price)}</p>
          </div>
        </div>
      )}

      {/* Addons */}
      {addonsGroup.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600" />
            Extras
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {addonsGroup.flatMap(group => 
              group.modifiers.filter(m => m.type === 'addon').map(modifier => (
                <Button
                  key={modifier.id}
                  variant={isModifierSelected(modifier.id) ? 'default' : 'outline'}
                  className={`h-14 md:h-12 justify-between text-base ${
                    isModifierSelected(modifier.id) 
                      ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                      : ''
                  }`}
                  onClick={() => toggleModifier(modifier)}
                >
                  <span className="font-medium">{modifier.name}</span>
                  <span className="text-sm opacity-80">+{formatCLP(modifier.price)}</span>
                </Button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Exclusions */}
      {exclusionsGroup.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Minus className="w-5 h-5 text-destructive" />
            Sin ingredientes
          </h3>
          <div className="flex flex-wrap gap-2">
            {exclusionsGroup.flatMap(group => 
              group.modifiers.filter(m => m.type === 'exclusion').map(modifier => (
                <Badge
                  key={modifier.id}
                  variant={isModifierSelected(modifier.id) ? 'default' : 'outline'}
                  className={`cursor-pointer py-3 px-5 text-base ${
                    isModifierSelected(modifier.id) 
                      ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' 
                      : 'hover:bg-secondary'
                  }`}
                  onClick={() => toggleModifier(modifier)}
                >
                  {isModifierSelected(modifier.id) && <X className="w-4 h-4 mr-1" />}
                  {modifier.name}
                </Badge>
              ))
            )}
          </div>
        </div>
      )}

      {/* Selected Summary */}
      {selectedModifiers.length > 0 && (
        <div className="space-y-2 p-4 bg-secondary/50 rounded-xl">
          <h4 className="font-medium text-sm text-muted-foreground">Tu seleccion:</h4>
          <div className="space-y-1">
            {selectedModifiers.filter(m => m.type === 'addon').map(m => (
              <div key={m.modifier.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="w-3 h-3" />
                  {m.modifier.name}
                </span>
                <span>+{formatCLP(m.modifier.price)}</span>
              </div>
            ))}
            {selectedModifiers.filter(m => m.type === 'exclusion').map(m => (
              <div key={m.modifier.id} className="flex items-center gap-1 text-sm text-destructive">
                <X className="w-3 h-3" />
                {m.modifier.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // Footer content (shared)
  const FooterContent = (
    <div className="space-y-4 w-full">
      {/* Quantity Selector */}
      <div className="flex items-center justify-center gap-4 w-full">
        <span className="text-sm font-medium text-muted-foreground">Cantidad:</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12"
            onClick={() => setQuantity(q => Math.max(1, q - 1))}
          >
            <Minus className="w-5 h-5" />
          </Button>
          <span className="w-12 text-center text-2xl font-bold">{quantity}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12"
            onClick={() => setQuantity(q => q + 1)}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Add to Cart Button */}
      <Button
        size="lg"
        className="w-full h-16 text-lg gap-2 bg-primary hover:bg-primary/90"
        onClick={handleAddToCart}
      >
        <Check className="w-6 h-6" />
        Agregar al Carrito - {formatCLP(itemTotal)}
      </Button>
    </div>
  )

  // Mobile: Use Drawer sliding from bottom
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2 text-xl">
              <ChefHat className="w-6 h-6 text-primary" />
              {product.name}
            </DrawerTitle>
          </DrawerHeader>
          
          <ScrollArea className="flex-1 px-4 overflow-y-auto">
            {CustomizerContent}
          </ScrollArea>

          <Separator className="my-2" />
          
          <DrawerFooter>
            {FooterContent}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  // Desktop: Use Dialog
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ChefHat className="w-6 h-6 text-primary" />
            {product.name}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {CustomizerContent}
        </ScrollArea>

        <Separator className="my-4" />

        <DialogFooter className="flex-col sm:flex-col">
          {FooterContent}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
