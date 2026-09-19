export type MemberCategory = 'Sub-8' | 'Sub-10' | 'Sub-12' | 'Sub-14' | 'Sub-16' | 'Juvenil' | 'Senior' | 'Staff'
export type MemberStatus = 'Pagado' | 'Deuda Pendiente' | 'Sobre Límite'
// Nota: se deja la unión ampliada (categorías de feria + categorías legacy del
// kiosko de hockey) a propósito, para no romper pantallas que todavía no se
// migran en esta ronda (Stock, Importar Excel). Las de feria son las que
// usan el POS y el editor de productos hoy.
export type ProductCategory =
  | 'Frutas' | 'Verduras' | 'Ensaladas y Preparados' | 'Jugos Naturales'
  | 'Bebidas' | 'Snacks' | 'Equipamiento' | 'Accesorios' | 'Comida' | 'Otros'
export type PaymentMethod = 'cash' | 'credit' | 'mercadopago'

// === TIPO DE VENTA (El Puesto del Pueblo) ===
// unidad: precio fijo por pieza (lechuga, sandía entera)
// peso: se pesa en el momento; dos modos en el POS (ver CartItem.saleMode)
// atado: precio fijo por manojo/paquete (albahaca, cilantro, perejil)
// preparado: precio base + variante elegida, reusando el sistema de modificadores (jugos naturales)
export type SaleType = 'unidad' | 'peso' | 'atado' | 'preparado'

export interface Modifier {
  id: string
  name: string
  price: number
  type: 'addon' | 'exclusion'
}

export interface ModifierGroup {
  id: string
  name: string
  modifiers: Modifier[]
}

export interface Member {
  id: string
  name: string
  rut: string
  category: MemberCategory
  balance: number
  creditLimit: number
  phone?: string
  email?: string
  joinDate: string
  creditEnabled: boolean
  isActive: boolean
}

export interface Product {
  id: string
  name: string
  price: number
  costPrice?: number
  category: ProductCategory
  stock: number
  minStock?: number
  description?: string
  barcode?: string
  brand?: string
  image?: string
  visibleInPOS: boolean
  customizable: boolean
  modifierGroups?: string[]
  // Opcional para que productos ya existentes (creados antes de este campo)
  // sigan funcionando: si no está, el POS lo trata como 'unidad'.
  saleType?: SaleType
  // Solo aplica cuando saleType === 'peso'. Es el precio de referencia por
  // kilo; el campo `price` no se usa para este tipo.
  pricePerKg?: number
  // Solo aplica cuando saleType === 'peso'. Peso mínimo de venta en gramos
  // (ej. no vender trozos de menos de 200 g). Opcional.
  minGrams?: number
  // Emoji de referencia (ej. 🍅, 🥬) — se muestra grande en el POS mientras
  // no haya foto real tomada por el vendedor. No depende de internet ni de
  // licencias de fotos de terceros, así que nunca se rompe ni se ve mal.
  emoji?: string
  // "Hoy hay": el administrador enciende o apaga el producto según el día (sandía, albahaca...).
  // Sin dato = encendido. Un producto apagado se ve atenuado en el POS y el vendedor puede venderlo igual.
  availableToday?: boolean
  // Crédito de la foto cuando viene de internet (autor · licencia · fuente). Se muestra en Stock → Créditos de fotos.
  imageCredit?: string
}

export interface CartItemModifier {
  modifier: Modifier
  type: 'addon' | 'exclusion'
}

export interface CartItemDiscount {
  // percent: % sobre cada unidad · amount: $ menos por unidad ·
  // bundle: promoción "lleva N paga M" (3x2, 2x1) — solo rebaja los grupos completos
  // total: precio final de la LÍNEA completa (remate: "las 3 lechugas a $2.000")
  type: 'percent' | 'amount' | 'bundle' | 'total'
  value: number
  buy?: number   // bundle: unidades que lleva el cliente por grupo (ej. 3)
  pay?: number   // bundle: unidades que paga por grupo (ej. 2)
  // Etiqueta libre para el ticket/cierre, ej. "3x2", "Stock viejo"
  label?: string
}

export interface CartItem {
  product: Product
  quantity: number
  modifiers: CartItemModifier[]
  itemTotal: number
  // Solo para saleType 'peso':
  // 'pesar' -> el vendedor ingresó gramos reales y el precio se calculó desde ahí.
  // 'monto' -> el cliente pidió un monto ($) y ese monto ES el precio; el peso
  //            mostrado en pantalla es solo referencia para pesar, no se guarda.
  saleMode?: 'pesar' | 'monto'
  weightGrams?: number
  // Descuento manual aplicado por el vendedor a este ítem específico.
  discount?: CartItemDiscount
}

export interface Transaction {
  id: string
  memberId: string | null
  memberName?: string
  items: {
    productId: string; productName: string; quantity: number; price: number; modifiers?: CartItemModifier[]
    lineTotal?: number          // lo cobrado por la línea (con descuento)
    listTotal?: number          // lo que valía sin descuento (para medir regalos y remates)
    discountLabel?: string      // "3x2", "Regalo", "Remate", "-20%"...
    saleMode?: 'pesar' | 'monto'
    weightGrams?: number
    soldWithoutStock?: boolean  // se vendió estando apagado o sin stock registrado
  }[]
  total: number
  type: 'cash' | 'credit' | 'mercadopago' | 'transfer'
  date: string
  shift: string
  // Transferencia: el vendedor fotografía el voucher y confirma el abono en el banco
  reference?: string
  receiptId?: string
  verified?: boolean
}

export interface Payment {
  id: string
  memberId: string
  amount: number
  date: string
  method: 'cash' | 'transfer' | 'card' | 'mercadopago'
}

export interface KitchenOrder {
  id: string
  transactionId: string
  items: { productName: string; quantity: number; addons: string[]; exclusions: string[] }[]
  timestamp: string
  status: 'pending' | 'preparing' | 'ready'
}

export interface ShiftLog {
  id: string
  shiftName: string
  startTime: string
  endTime?: string
  salesCount: number
  totalSales: number
}

export interface Seller {
  id: string
  name: string
  pin: string
  role: 'vendedor' | 'admin'
  active: boolean
}

export interface ProductTemplate {
  id: string
  name: string
  category: ProductCategory
  brand?: string
  customizable?: boolean
  modifierGroups?: string[]
  note?: string
}

// === MERMA ===
// Registro de lo que se pierde SIN vender (se puso feo, se aplastó, etc.),
// para diferenciarlo de lo vendido con descuento (3x2, 2x1, que sí generan
// ingreso). `cantidad` es en gramos si el producto es saleType 'peso', o en
// unidades/atados en los demás casos — igual que como se descuenta el stock.
export interface MermaEntry {
  id: string
  productId: string
  productName: string
  cantidad: number
  motivo: string
  date: string
  // merma: se echó a perder · regalo: se regaló · conteo: faltante detectado al contar ·
  // sobrante: al contar había más de lo registrado (no es pérdida)
  kind?: 'merma' | 'regalo' | 'conteo' | 'sobrante'
  costValue?: number   // valor de lo perdido a costo (CLP), fijado al registrarlo
}

// Gastos del puesto y retiros del dueño. Lo que sale en EFECTIVO baja el efectivo esperado del arqueo.
export interface Expense {
  id: string
  date: string
  amount: number
  kind: 'gasto' | 'retiro'
  category: string
  note?: string
  method: 'cash' | 'transfer'
  receiptId?: string
  cashSource?: CashSource   // solo gastos en efectivo (un retiro siempre sale del cajón)
}

export interface Payable {
  id: string
  supplierName: string
  description: string
  amount: number
  amountPaid: number
  date: string
  status: 'pending' | 'partial' | 'paid'
}

// De dónde sale el efectivo de una compra o gasto:
//  'caja'  = del cajón del puesto → baja el efectivo esperado del arqueo
//  'dueno' = de la plata del dueño (bolsillo) → NO toca el cajón
// Sin dato (registros anteriores a esta versión) se trata como 'caja'.
export type CashSource = 'caja' | 'dueno'

export interface PayablePayment {
  id: string
  payableId: string
  supplierName: string
  amount: number
  date: string
  method: 'cash' | 'transfer' | 'card'
  reference?: string   // n° de operación (transferencias, tarjeta)
  receiptId?: string   // foto del comprobante (guardada en lib/receipt-store.ts)
  cashSource?: CashSource   // solo pagos en efectivo
}

export interface ClosureLogEntry {
  id: string
  date: string
  shift: string
  totalSales: number
  cashFloatStart: number
  cashExpected: number
  cashCounted: number | null
  cashDifference: number | null
  sentToMake: boolean
  supplierCashPayments?: number   // pagos a proveedores hechos en efectivo durante el turno
  expenseCashPayments?: number    // gastos y retiros pagados en efectivo durante el turno
}

// Modifier Groups
export const modifierGroups: ModifierGroup[] = [
  {
    id: 'jugo-fruta',
    name: 'Elige la fruta',
    modifiers: [
      { id: 'jugo-naranja', name: 'Naranja', price: 0, type: 'addon' },
      { id: 'jugo-sandia', name: 'Sandía', price: 0, type: 'addon' },
      { id: 'jugo-frutilla', name: 'Frutilla', price: 0, type: 'addon' },
      { id: 'jugo-pina', name: 'Piña', price: 0, type: 'addon' },
      { id: 'jugo-betarraga-zanahoria', name: 'Betarraga-Zanahoria', price: 0, type: 'addon' },
      { id: 'jugo-mixto', name: 'Mixto (a elección del feriante)', price: 0, type: 'addon' },
    ]
  },
  {
    id: 'jugo-extras',
    name: 'Extras',
    modifiers: [
      { id: 'jugo-sin-azucar', name: 'Sin azúcar', price: 0, type: 'exclusion' },
      { id: 'jugo-con-hielo', name: 'Con hielo', price: 0, type: 'addon' },
      { id: 'jugo-vaso-grande', name: 'Vaso grande', price: 500, type: 'addon' },
    ]
  },
  {
    id: 'sandwich-addons',
    name: 'Extras Sándwich',
    modifiers: [
      { id: 'palta', name: 'Palta', price: 800, type: 'addon' },
      { id: 'queso', name: 'Queso', price: 500, type: 'addon' },
      { id: 'huevo', name: 'Huevo', price: 400, type: 'addon' },
      { id: 'tocino', name: 'Tocino', price: 700, type: 'addon' },
      { id: 'extra-carne', name: 'Extra Carne', price: 1000, type: 'addon' },
    ]
  },
  {
    id: 'sandwich-exclusions',
    name: 'Sin...',
    modifiers: [
      { id: 'sin-mayo', name: 'Sin Mayo', price: 0, type: 'exclusion' },
      { id: 'sin-tomate', name: 'Sin Tomate', price: 0, type: 'exclusion' },
      { id: 'sin-lechuga', name: 'Sin Lechuga', price: 0, type: 'exclusion' },
      { id: 'sin-cebolla', name: 'Sin Cebolla', price: 0, type: 'exclusion' },
      { id: 'sin-aji', name: 'Sin Ají', price: 0, type: 'exclusion' },
    ]
  },
  {
    id: 'empanada-addons',
    name: 'Extras Empanada',
    modifiers: [
      { id: 'extra-queso-emp', name: 'Extra Queso', price: 400, type: 'addon' },
      { id: 'pebre', name: 'Con Pebre', price: 200, type: 'addon' },
    ]
  },
  {
    id: 'completo-addons',
    name: 'Extras Completo',
    modifiers: [
      { id: 'palta-completo', name: 'Palta', price: 800, type: 'addon' },
      { id: 'chucrut', name: 'Chucrut', price: 400, type: 'addon' },
      { id: 'extra-mayo', name: 'Extra Mayo', price: 200, type: 'addon' },
      { id: 'queso-completo', name: 'Queso Derretido', price: 500, type: 'addon' },
    ]
  },
  {
    id: 'completo-exclusions',
    name: 'Sin...',
    modifiers: [
      { id: 'sin-mayo-comp', name: 'Sin Mayo', price: 0, type: 'exclusion' },
      { id: 'sin-tomate-comp', name: 'Sin Tomate', price: 0, type: 'exclusion' },
      { id: 'sin-palta-comp', name: 'Sin Palta', price: 0, type: 'exclusion' },
    ]
  }
]

// El Puesto del Pueblo no usa socios/fiado (eso era del kiosko del club de
// hockey). Se deja el arreglo vacío en vez de borrar el tipo/las funciones,
// para no romper pantallas que aún no se migran esta ronda.
export const defaultMembers: Member[] = []


export const defaultProducts: Product[] = [
  // Verduras — venta por peso (a granel, como se compra en La Vega)
  { id: 'v1', name: 'Tomate', saleType: 'peso', price: 0, pricePerKg: 1200, costPrice: 700, category: 'Verduras', stock: 20000, minStock: 2000, description: 'Venta a granel, se pesa en el puesto', visibleInPOS: true, customizable: false, emoji: '🍅' },
  { id: 'v2', name: 'Papa', saleType: 'peso', price: 0, pricePerKg: 900, costPrice: 500, category: 'Verduras', stock: 30000, minStock: 3000, visibleInPOS: true, customizable: false, emoji: '🥔' },
  { id: 'v3', name: 'Cebolla', saleType: 'peso', price: 0, pricePerKg: 800, costPrice: 450, category: 'Verduras', stock: 15000, minStock: 2000, visibleInPOS: true, customizable: false, emoji: '🧅' },
  { id: 'v4', name: 'Zanahoria', saleType: 'peso', price: 0, pricePerKg: 900, costPrice: 500, category: 'Verduras', stock: 12000, minStock: 2000, visibleInPOS: true, customizable: false, emoji: '🥕' },
  { id: 'v15', name: 'Zapallo', saleType: 'unidad', price: 2500, costPrice: 1300, category: 'Verduras', stock: 15, minStock: 3, description: 'Zapallo camote entero', visibleInPOS: true, customizable: false, emoji: '🎃' },
  { id: 'v16', name: 'Zapallo Italiano', saleType: 'peso', price: 0, pricePerKg: 1000, costPrice: 550, category: 'Verduras', stock: 10000, minStock: 1500, visibleInPOS: true, customizable: false, emoji: '🥒' },
  { id: 'v17', name: 'Apio', saleType: 'unidad', price: 800, costPrice: 350, category: 'Verduras', stock: 20, minStock: 4, description: 'Rama de apio', visibleInPOS: true, customizable: false, emoji: '🥬' },
  { id: 'v18', name: 'Ajo', saleType: 'unidad', price: 400, costPrice: 150, category: 'Verduras', stock: 40, minStock: 8, description: 'Cabeza de ajo', visibleInPOS: true, customizable: false, emoji: '🧄' },
  { id: 'v19', name: 'Pepino de Ensalada', saleType: 'unidad', price: 600, costPrice: 300, category: 'Verduras', stock: 25, minStock: 5, visibleInPOS: true, customizable: false, emoji: '🥒' },
  { id: 'v20', name: 'Cebollín', saleType: 'atado', price: 500, costPrice: 200, category: 'Verduras', stock: 15, minStock: 3, visibleInPOS: true, customizable: false, emoji: '🌱' },
  // Lechugas — venta por unidad (7 tipos, según lo que dijiste)
  { id: 'v5', name: 'Lechuga Costina', saleType: 'unidad', price: 900, costPrice: 400, category: 'Verduras', stock: 30, minStock: 5, visibleInPOS: true, customizable: false, emoji: '🥬' },
  { id: 'v6', name: 'Lechuga Escarola', saleType: 'unidad', price: 900, costPrice: 400, category: 'Verduras', stock: 30, minStock: 5, visibleInPOS: true, customizable: false, emoji: '🥬' },
  { id: 'v7', name: 'Lechuga Milanesa', saleType: 'unidad', price: 900, costPrice: 400, category: 'Verduras', stock: 30, minStock: 5, visibleInPOS: true, customizable: false, emoji: '🥬' },
  { id: 'v8', name: 'Lechuga Repollada', saleType: 'unidad', price: 900, costPrice: 400, category: 'Verduras', stock: 30, minStock: 5, visibleInPOS: true, customizable: false, emoji: '🥬' },
  { id: 'v9', name: 'Lechuga Morada', saleType: 'unidad', price: 1000, costPrice: 450, category: 'Verduras', stock: 20, minStock: 5, visibleInPOS: true, customizable: false, emoji: '🟣' },
  { id: 'v10', name: 'Lechuga Mantecosa', saleType: 'unidad', price: 900, costPrice: 400, category: 'Verduras', stock: 20, minStock: 5, visibleInPOS: true, customizable: false, emoji: '🥬' },
  { id: 'v11', name: 'Lechuga Hidropónica', saleType: 'unidad', price: 1200, costPrice: 600, category: 'Verduras', stock: 15, minStock: 5, visibleInPOS: true, customizable: false, emoji: '🥬' },
  // Hierbas — venta por atado
  { id: 'v12', name: 'Albahaca', saleType: 'atado', price: 700, costPrice: 300, category: 'Verduras', stock: 15, minStock: 3, visibleInPOS: true, customizable: false, emoji: '🌿' },
  { id: 'v13', name: 'Cilantro', saleType: 'atado', price: 500, costPrice: 200, category: 'Verduras', stock: 15, minStock: 3, visibleInPOS: true, customizable: false, emoji: '🌿' },
  { id: 'v14', name: 'Perejil', saleType: 'atado', price: 500, costPrice: 200, category: 'Verduras', stock: 15, minStock: 3, visibleInPOS: true, customizable: false, emoji: '🌿' },
  // Frutas
  { id: 'f1', name: 'Sandía Entera', saleType: 'unidad', price: 4500, costPrice: 2500, category: 'Frutas', stock: 10, minStock: 2, description: 'Se puede vender entera o en trozos (ver "Trozos de Sandía")', visibleInPOS: true, customizable: false, emoji: '🍉' },
  { id: 'f2', name: 'Trozos de Sandía', saleType: 'peso', price: 0, pricePerKg: 1500, costPrice: 700, category: 'Frutas', stock: 8000, minStock: 1000, description: 'Cortada y pesada en el momento', visibleInPOS: true, customizable: false, emoji: '🍉' },
  { id: 'f3', name: 'Manzana', saleType: 'peso', price: 0, pricePerKg: 1400, costPrice: 800, category: 'Frutas', stock: 15000, minStock: 2000, visibleInPOS: true, customizable: false, emoji: '🍎' },
  { id: 'f4', name: 'Plátano', saleType: 'peso', price: 0, pricePerKg: 1100, costPrice: 600, category: 'Frutas', stock: 15000, minStock: 2000, visibleInPOS: true, customizable: false, emoji: '🍌' },
  { id: 'f5', name: 'Naranja', saleType: 'peso', price: 0, pricePerKg: 1000, costPrice: 550, category: 'Frutas', stock: 15000, minStock: 2000, visibleInPOS: true, customizable: false, emoji: '🍊' },
  // Jugos naturales — preparado, con variante de fruta (reusa el sistema de modificadores)
  { id: 'j1', name: 'Jugo Natural', saleType: 'preparado', price: 1500, costPrice: 500, category: 'Jugos Naturales', stock: 100, minStock: 0, description: 'Elige la fruta al momento de vender', visibleInPOS: true, customizable: true, modifierGroups: ['jugo-fruta', 'jugo-extras'], emoji: '🥤' },
  // Ensaladas / preparados
  { id: 'e1', name: 'Ensalada Surtida (armada)', saleType: 'peso', price: 0, pricePerKg: 2500, costPrice: 1400, category: 'Ensaladas y Preparados', stock: 5000, minStock: 500, description: 'Lechuga, tomate y zanahoria mezclados, a granel', visibleInPOS: true, customizable: false, emoji: '🥗' },
]

// Vendedores por defecto (se pueden editar/agregar desde la pantalla de inicio de turno)
export const defaultSellers: Seller[] = [
  { id: 'admin', name: 'Administrador', pin: '1234', role: 'admin', active: true },
]

// Plantillas rápidas de los productos que SIEMPRE se venden en el kiosko real
// (dadas por el cliente). Al crear un producto nuevo desde una plantilla, se
// precargan nombre/categoría/marca — la foto se toma una sola vez con la
// cámara y queda guardada en la Galería para reutilizar después.
export const productTemplates: ProductTemplate[] = [
  { id: 'tpl-tomate', name: 'Tomate', category: 'Verduras' },
  { id: 'tpl-papa', name: 'Papa', category: 'Verduras' },
  { id: 'tpl-cebolla', name: 'Cebolla', category: 'Verduras' },
  { id: 'tpl-zanahoria', name: 'Zanahoria', category: 'Verduras' },
  { id: 'tpl-lechuga', name: 'Lechuga', category: 'Verduras', note: 'Cambia el nombre por el tipo exacto (Costina, Escarola, Milanesa, Morada, etc.) — cada tipo es un producto distinto.' },
  { id: 'tpl-albahaca', name: 'Albahaca', category: 'Verduras' },
  { id: 'tpl-cilantro', name: 'Cilantro', category: 'Verduras' },
  { id: 'tpl-perejil', name: 'Perejil', category: 'Verduras' },
  { id: 'tpl-sandia-entera', name: 'Sandía Entera', category: 'Frutas' },
  { id: 'tpl-trozos-sandia', name: 'Trozos de Sandía', category: 'Frutas' },
  { id: 'tpl-manzana', name: 'Manzana', category: 'Frutas' },
  { id: 'tpl-platano', name: 'Plátano', category: 'Frutas' },
  { id: 'tpl-naranja', name: 'Naranja', category: 'Frutas' },
  { id: 'tpl-jugo-natural', name: 'Jugo Natural', category: 'Jugos Naturales', customizable: true, modifierGroups: ['jugo-fruta', 'jugo-extras'], note: 'Con la variante de fruta ya cargada, el vendedor elige el sabor al momento de vender, sin crear un producto por cada jugo.' },
  { id: 'tpl-ensalada-armada', name: 'Ensalada Surtida (armada)', category: 'Ensaladas y Preparados' },
]

// Legacy exports for compatibility
export const members = defaultMembers
export const products = defaultProducts

export const transactions: Transaction[] = [
  { id: '1', memberId: '1', memberName: 'Carlos Pérez González', items: [{ productId: '1', productName: 'Agua Mineral', quantity: 2, price: 800 }, { productId: '9', productName: 'Cinta Hockey', quantity: 1, price: 3500 }], total: 5100, type: 'credit', date: '2024-03-20T10:30:00', shift: 'Voluntario 1' },
  { id: '2', memberId: '3', memberName: 'Juan Martínez Silva', items: [{ productId: '2', productName: 'Gatorade', quantity: 3, price: 1800 }, { productId: '5', productName: 'Barra Cereal', quantity: 2, price: 600 }], total: 6600, type: 'credit', date: '2024-03-19T14:15:00', shift: 'Directiva' },
  { id: '3', memberId: '1', memberName: 'Carlos Pérez González', items: [{ productId: '9', productName: 'Cinta Hockey', quantity: 2, price: 3500 }], total: 7000, type: 'credit', date: '2024-03-18T09:45:00', shift: 'Voluntario 2' },
]

export const payments: Payment[] = [
  { id: '1', memberId: '2', amount: 10000, date: '2024-03-20T12:00:00', method: 'transfer' },
  { id: '2', memberId: '5', amount: 25000, date: '2024-03-19T10:30:00', method: 'cash' },
  { id: '3', memberId: '8', amount: 5000, date: '2024-03-18T14:00:00', method: 'card' },
]

export const kitchenOrders: KitchenOrder[] = []

export function getMemberStatus(member: Member): MemberStatus {
  if (member.balance >= 0) return 'Pagado'
  if (Math.abs(member.balance) > member.creditLimit) return 'Sobre Límite'
  return 'Deuda Pendiente'
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount)
}

export function formatRUT(rut: string): string {
  return rut
}

export function getMemberPurchaseHistory(memberId: string, transactionList: Transaction[] = transactions): Transaction[] {
  return transactionList.filter(t => t.memberId === memberId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getMostBoughtProducts(memberId: string, productList: Product[] = products, transactionList: Transaction[] = transactions): { product: Product; count: number }[] {
  const memberTransactions = transactionList.filter(t => t.memberId === memberId)
  const productCounts: Record<string, number> = {}
  
  memberTransactions.forEach(t => {
    t.items.forEach(item => {
      productCounts[item.productId] = (productCounts[item.productId] || 0) + item.quantity
    })
  })
  
  return Object.entries(productCounts)
    .map(([productId, count]) => ({
      product: productList.find(p => p.id === productId)!,
      count
    }))
    .filter(item => item.product)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

export function getModifierGroupById(id: string): ModifierGroup | undefined {
  return modifierGroups.find(g => g.id === id)
}

// Precio base de un ítem sin descuentos, según su tipo de venta.
// - unidad / atado / preparado: usa product.price (más los addons de modificadores).
// - peso, modo 'pesar': gramos ÷ 1000 × $/kg.
// - peso, modo 'monto': el monto pedido por el cliente ES el precio, tal cual.
export function calculateCartItemTotal(
  product: Product,
  modifiers: CartItemModifier[],
  opts?: { weightGrams?: number; amountOverride?: number }
): number {
  const addonsTotal = modifiers
    .filter(m => m.type === 'addon')
    .reduce((sum, m) => sum + m.modifier.price, 0)

  if (product.saleType === 'peso') {
    if (opts?.amountOverride !== undefined) {
      // Modo "por monto": el precio es exactamente lo que pidió el cliente.
      return opts.amountOverride
    }
    const grams = opts?.weightGrams ?? 0
    const pricePerKg = product.pricePerKg ?? 0
    return Math.round((grams / 1000) * pricePerKg) + addonsTotal
  }

  return product.price + addonsTotal
}

// Peso de referencia (en gramos) para que el vendedor sepa cuánto poner en
// la balanza cuando el cliente pide "$X de tomate". Es solo informativo — no
// se redondea ni se guarda; el precio final es el monto pedido tal cual.
export function estimateGramsForAmount(product: Product, amount: number): number {
  const pricePerKg = product.pricePerKg ?? 0
  if (pricePerKg <= 0) return 0
  return (amount / pricePerKg) * 1000
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toLocaleString('es-CL', { maximumFractionDigits: 2 })} kg`
  return `${Math.round(grams)} g`
}

// Aplica el descuento manual de un ítem (si tiene) sobre su precio ya calculado.
// (Los descuentos 'bundle' dependen de la cantidad: usar cartLineTotal.)
export function applyItemDiscount(itemTotal: number, discount?: CartItemDiscount): number {
  if (!discount || discount.type === 'bundle' || discount.type === 'total') return itemTotal
  if (discount.type === 'percent') return Math.max(0, Math.round(itemTotal * (1 - discount.value / 100)))
  return Math.max(0, itemTotal - discount.value)
}

// Redondeo del TOTAL A PAGAR EN EFECTIVO al múltiplo de $10 más cercano.
// Ojo: esto solo aplica al monto que paga el cliente en efectivo — la boleta
// electrónica y el registro de la venta guardan el monto exacto sin
// redondear, con el ajuste como una línea separada (así lo exige la
// normativa vigente sobre el redondeo en Chile).
export function roundToNearestTen(amount: number): number {
  return Math.round(amount / 10) * 10
}

// === ARQUEO DE CAJA ===
// Efectivo esperado en el cajón = fondo inicial
//   + ventas en efectivo
//   - compras y pagos a proveedores hechos en efectivo (Pasivos)
//   - gastos y retiros del dueño hechos en efectivo.
// Transferencias y tarjeta a proveedores no pasan por el cajón: se informan aparte.
// Las ventas con Mercado Pago tampoco entran al cajón.

export interface CashSession {
  cashFloatStart: number
  cashSales: number
  supplierCashOut: number
  supplierCashCount: number
  expenseCashOut: number      // gastos y retiros pagados en efectivo desde el cajón
  expenseCashCount: number
  ownerCashOut: number        // efectivo pagado con plata del dueño (no baja el cajón)
  ownerCashCount: number
  cashExpected: number
  supplierOtherOut: { transfer: number; card: number }
}

export function computeCashSession(args: {
  cashFloatStart: number
  sales: { total: number; type: string }[]
  supplierPayments: PayablePayment[]
  expenses?: Expense[]
}): CashSession {
  const sum = (list: { amount: number }[]) => list.reduce((t, x) => t + x.amount, 0)
  const cashSales = args.sales.filter(x => x.type === 'cash').reduce((t, x) => t + x.total, 0)
  // Solo baja el cajón lo pagado en efectivo DESDE el cajón. Si el dueño pagó con su propia plata
  // (ej. compra en La Vega con su bolsillo) el cajón no se toca: contarlo generaba un "sobrante" falso.
  const fromDrawer = (x: { cashSource?: CashSource }) => x.cashSource !== 'dueno'
  const supplierCashAll = args.supplierPayments.filter(p => p.method === 'cash')
  const expenseCashAll = (args.expenses ?? []).filter(e => e.method === 'cash')
  const supplierCash = supplierCashAll.filter(fromDrawer)
  const expenseCash = expenseCashAll.filter(fromDrawer)
  const ownerPaid = [...supplierCashAll, ...expenseCashAll].filter(x => !fromDrawer(x))
  const by = (m: string) => sum(args.supplierPayments.filter(p => p.method === m))

  return {
    cashFloatStart: args.cashFloatStart,
    cashSales,
    supplierCashOut: sum(supplierCash),
    supplierCashCount: supplierCash.length,
    expenseCashOut: sum(expenseCash),
    expenseCashCount: expenseCash.length,
    ownerCashOut: sum(ownerPaid),
    ownerCashCount: ownerPaid.length,
    cashExpected: args.cashFloatStart + cashSales - sum(supplierCash) - sum(expenseCash),
    supplierOtherOut: { transfer: by('transfer'), card: by('card') },
  }
}

// Movimientos registrados desde que se abrió la caja del turno.
export function paymentsSince<T extends { date: string }>(list: T[], startISO: string | null): T[] {
  if (!startISO) return []
  const start = new Date(startISO).getTime()
  return list.filter(p => new Date(p.date).getTime() >= start)
}

// LocalStorage utilities
const STORAGE_KEYS = {
  PRODUCTS: 'puesto-pueblo-products',
  MEMBERS: 'puesto-pueblo-members',
  TRANSACTIONS: 'puesto-pueblo-transactions',
  SHIFT_LOGS: 'puesto-pueblo-shift-logs',
  CURRENT_SHIFT: 'puesto-pueblo-current-shift',
  LAST_SYNC: 'puesto-pueblo-last-sync',
  SELLERS: 'puesto-pueblo-sellers',
  CURRENT_SELLER: 'puesto-pueblo-current-seller',
  ADMIN_PIN: 'puesto-pueblo-admin-pin',
  SESSION_SALES: 'puesto-pueblo-session-sales',
  CLOSURES_LOG: 'puesto-pueblo-closures-log',
  ALL_TRANSACTIONS: 'puesto-pueblo-all-transactions',
  ALL_PAYMENTS: 'puesto-pueblo-all-payments',
  PHOTO_GALLERY: 'puesto-pueblo-photo-gallery',
  PAYABLES: 'puesto-pueblo-payables',
  PAYABLE_PAYMENTS: 'puesto-pueblo-payable-payments',
  CASH_FLOAT: 'puesto-pueblo-cash-float',
  SHIFT_STARTED_AT: 'puesto-pueblo-shift-started-at',
  MERMA_LOG: 'puesto-pueblo-merma-log',
  EXPENSES: 'puesto-pueblo-expenses',
  DAY_OPENING: 'puesto-pueblo-day-opening',
  OFF_MODIFIERS: 'puesto-pueblo-off-modifiers',
  PURCHASES: 'puesto-pueblo-purchases',
}

// Parser CSV real: respeta comillas y comas dentro de campos ("Producto, grande" no se rompe)
export function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

export function saveToStorage<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false
  try {
    localStorage.setItem(key, JSON.stringify(value))
    // Update last sync timestamp
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString())
    return true
  } catch (error) {
    console.error('Error saving to localStorage:', error)
    // Memoria llena o bloqueada: antes fallaba en silencio y los datos se
    // perdían al recargar. Ahora la pantalla principal avisa al usuario.
    window.dispatchEvent(new CustomEvent('kiosko:storage-error', { detail: { key } }))
    return false
  }
}

export function getLastSyncTime(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.LAST_SYNC)
}

export const StorageKeys = STORAGE_KEYS

// === GALERÍA DE FOTOS DE PRODUCTOS ===
// Guarda cada foto tomada con la cámara, indexada por un nombre elegido por
// el usuario (normalmente el nombre del producto o de la plantilla), para
// poder reutilizarla la próxima vez que se cargue un producto igual o
// parecido — sin tener que volver a fotografiar cada vez.

export interface GalleryEntry {
  label: string
  image: string
  credit?: string
  updatedAt: string
}

export function getPhotoGallery(): GalleryEntry[] {
  return loadFromStorage<GalleryEntry[]>(STORAGE_KEYS.PHOTO_GALLERY, [])
}

export function saveToPhotoGallery(label: string, image: string, credit?: string): void {
  const gallery = getPhotoGallery()
  const key = label.trim().toLowerCase()
  const existingIdx = gallery.findIndex(g => g.label.trim().toLowerCase() === key)
  const entry: GalleryEntry = { label: label.trim(), image, credit, updatedAt: new Date().toISOString() }
  if (existingIdx >= 0) gallery[existingIdx] = entry
  else gallery.push(entry)
  saveToStorage(STORAGE_KEYS.PHOTO_GALLERY, gallery)
}

export function deleteFromPhotoGallery(label: string): void {
  const gallery = getPhotoGallery().filter(g => g.label.trim().toLowerCase() !== label.trim().toLowerCase())
  saveToStorage(STORAGE_KEYS.PHOTO_GALLERY, gallery)
}

// === RESPALDO COMPLETO ===
// Todo el negocio vive en localStorage de esta tablet. Esta función junta
// todo en un solo archivo descargable, y la de abajo lo restaura completo.
// Es la red de seguridad ante un reset de fábrica, una tablet rota, o un
// cambio de dispositivo.

export function exportFullBackup(): Record<string, any> {
  if (typeof window === 'undefined') return {}
  const backup: Record<string, any> = {
    _meta: {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: 'el-puesto-del-pueblo',
    },
  }
  Object.values(STORAGE_KEYS).forEach((key) => {
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      try { backup[key] = JSON.parse(raw) } catch { backup[key] = raw }
    }
  })
  return backup
}

export function downloadFullBackup() {
  const backup = exportFullBackup()
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  const fecha = new Date().toISOString().split('T')[0]
  link.download = `respaldo-kiosko-${fecha}.json`
  link.click()
}

export function restoreFullBackup(backup: Record<string, any>): { ok: boolean; error?: string } {
  if (typeof window === 'undefined') return { ok: false, error: 'No disponible' }
  if (!backup || typeof backup !== 'object' || !backup._meta || backup._meta.app !== 'el-puesto-del-pueblo') {
    return { ok: false, error: 'El archivo no parece ser un respaldo válido de esta app.' }
  }
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      if (key in backup) {
        localStorage.setItem(key, JSON.stringify(backup[key]))
      }
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// === COBRO POR WHATSAPP ===
// Arma el mensaje y, si Mercado Pago está configurado, agrega un link de
// pago real para que el socio pueda pagar directo desde WhatsApp sin pasar
// por la tablet. Si no hay MP configurado, igual manda el mensaje con el
// detalle — el cobro por WhatsApp no depende de tener MP listo.

export function buildDebtWhatsAppMessage(member: Member, opts?: { paymentLink?: string; itemsDetail?: string }): string {
  const firstName = member.name.split(' ')[0]
  const lines = [`Hola ${firstName}, te escribimos del kiosko.`]

  if (member.balance < 0) {
    lines.push(`Tienes un saldo pendiente de ${formatCLP(Math.abs(member.balance))}.`)
  }
  if (opts?.itemsDetail) {
    lines.push(`Detalle: ${opts.itemsDetail}`)
  }
  if (opts?.paymentLink) {
    lines.push(`Puedes pagar directo aquí: ${opts.paymentLink}`)
  }
  lines.push('¡Gracias!')
  return lines.join('\n')
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '')
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}

export async function sendDebtWhatsApp(member: Member, itemsDetail?: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined') return { ok: false, error: 'No disponible' }
  if (!member.phone) return { ok: false, error: 'Este socio no tiene WhatsApp cargado en su ficha.' }

  // Se abre la ventana ANTES del await: si se abre después, el navegador la
  // bloquea por considerarla un pop-up no originado directamente del clic.
  const win = window.open('', '_blank')

  let paymentLink: string | undefined
  if (member.balance < 0) {
    try {
      const res = await fetch('/api/mercadopago/crear-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.abs(member.balance),
          description: `Deuda ${member.name}`,
          externalReference: `deuda-${member.id}-${Date.now()}`,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        paymentLink = data.initPoint
      }
    } catch {
      // Mercado Pago no configurado o falló: se manda igual el mensaje, sin link.
    }
  }

  const message = buildDebtWhatsAppMessage(member, { paymentLink, itemsDetail })
  const url = buildWhatsAppUrl(member.phone, message)

  if (win) win.location.href = url
  else window.open(url, '_blank')

  return { ok: true }
}

// Total real de una línea del carrito (precio × cantidad, con su descuento).
// 3x2 con 3 unidades cobra 2; con 4 unidades cobra 3 (solo rebaja el grupo completo);
// con 1 o 2 unidades no rebaja nada.
export function cartLineTotal(item: { itemTotal: number; quantity: number; discount?: CartItemDiscount }): number {
  const d = item.discount
  if (d?.type === 'total') return Math.max(0, Math.round(d.value))
  if (d?.type === 'bundle' && d.buy && d.pay !== undefined && d.buy > d.pay) {
    const groups = Math.floor(item.quantity / d.buy)
    const payableUnits = item.quantity - groups * (d.buy - d.pay)
    return item.itemTotal * payableUnits
  }
  return applyItemDiscount(item.itemTotal, d) * item.quantity
}

// === COMPRAS (el dueño compra en volumen y las registra) ===
// Cantidad: kg (se guarda en gramos en el stock) para productos por peso; unidades o
// atados para el resto. `cost` es el costo TOTAL de esa línea en pesos.
export interface PurchaseLine {
  productId: string
  productName: string
  quantity: number      // kg si el producto es por peso; unidades/atados si no
  unit: 'kg' | 'un'
  cost: number          // costo total de la línea (CLP)
}

export interface Purchase {
  id: string
  date: string
  supplierName: string
  lines: PurchaseLine[]
  total: number
  paidNow: number       // lo pagado al registrar la compra
  method?: 'cash' | 'transfer' | 'card'
  cashSource?: CashSource
  reference?: string
  receiptId?: string
  note?: string
  payableId: string     // deuda/pago asociado en Pasivos
}

// Efecto de una compra sobre los productos: suma stock (kg → gramos en productos por peso)
// y, si se pide, deja el costo por kilo/unidad de la última línea de ese producto.
export function applyPurchaseToProducts<T extends Product>(products: T[], lines: PurchaseLine[], updateCost: boolean): T[] {
  return products.map(p => {
    const mine = lines.filter(l => l.productId === p.id)
    if (mine.length === 0) return p
    let stock = p.stock
    let costPrice = p.costPrice
    for (const l of mine) {
      stock += p.saleType === 'peso' ? Math.round(l.quantity * 1000) : Math.round(l.quantity)
      if (updateCost && l.quantity > 0) costPrice = Math.round(l.cost / l.quantity)
    }
    return { ...p, stock, costPrice }
  })
}

// Deshace el stock de una compra anulada (nunca deja stock negativo).
export function revertPurchaseFromProducts<T extends Product>(products: T[], lines: PurchaseLine[]): T[] {
  return products.map(p => {
    const mine = lines.filter(l => l.productId === p.id)
    if (mine.length === 0) return p
    const remove = mine.reduce((sum, l) => sum + (p.saleType === 'peso' ? Math.round(l.quantity * 1000) : Math.round(l.quantity)), 0)
    return { ...p, stock: Math.max(0, p.stock - remove) }
  })
}

// === STOCK DEL DÍA ===
// El stock es diario: cada mañana parte con lo que quedó contado la noche anterior (o con lo
// que el dueño registre en la apertura), durante el día sube con las compras y baja con las
// ventas, los regalos y la merma, y al cerrar se cuenta lo que quedó.
// Unidades: gramos en productos por peso; unidades o atados en el resto.

const isPeso = (p: Product) => p.saleType === 'peso'

// Valor de lo perdido, a costo (el costo de un producto por peso es por kilo).
export function lossValue(product: Product, cantidad: number): number {
  const cost = product.costPrice || 0
  return Math.round(isPeso(product) ? (cantidad / 1000) * cost : cantidad * cost)
}

export interface StockRow {
  productId: string
  name: string
  saleType: SaleType
  opening: number     // con lo que partió el día
  purchased: number   // + compras del día
  sold: number        // - vendido
  lost: number        // - merma, regalos y faltantes ya registrados
  current: number     // lo que la app dice que hay ahora
  other: number       // ajustes manuales no explicados por lo anterior (puede ser 0)
}

export function computeStockBreakdown(args: {
  products: Product[]
  opening: Record<string, number> | null
  sales: { items: { productId: string; quantity: number; weightGrams?: number }[] }[]
  purchases: Purchase[]
  mermaLog: MermaEntry[]
}): StockRow[] {
  return args.products.map(p => {
    const opening = args.opening && args.opening[p.id] !== undefined ? args.opening[p.id] : p.stock
    const sold = args.sales.reduce((sum, sale) => sum + sale.items
      .filter(i => i.productId === p.id)
      .reduce((s2, i) => s2 + (isPeso(p) ? (i.weightGrams || 0) : i.quantity), 0), 0)
    const purchased = args.purchases.reduce((sum, pu) => sum + pu.lines
      .filter(l => l.productId === p.id)
      .reduce((s2, l) => s2 + (isPeso(p) ? Math.round(l.quantity * 1000) : Math.round(l.quantity)), 0), 0)
    const lost = args.mermaLog
      .filter(m => m.productId === p.id && m.kind !== 'sobrante')
      .reduce((sum, m) => sum + m.cantidad, 0)
    return {
      productId: p.id, name: p.name, saleType: p.saleType || 'unidad',
      opening, purchased, sold, lost, current: p.stock,
      other: p.stock - (opening + purchased - sold - lost),
    }
  })
}

// Aplica el conteo de cierre: el stock pasa a ser lo contado; lo que faltaba queda como
// pérdida valorizada ("Diferencia de conteo") y lo que sobraba como sobrante.
export function applyStockCount<T extends Product>(products: T[], counts: Record<string, number>): {
  products: T[]
  entries: Omit<MermaEntry, 'id' | 'date'>[]
} {
  const entries: Omit<MermaEntry, 'id' | 'date'>[] = []
  const updated = products.map(p => {
    const counted = counts[p.id]
    if (counted === undefined || !Number.isFinite(counted) || counted < 0) return p
    const diff = counted - p.stock
    if (diff < 0) {
      entries.push({ productId: p.id, productName: p.name, cantidad: -diff, motivo: 'Diferencia de conteo', kind: 'conteo', costValue: lossValue(p, -diff) })
    } else if (diff > 0) {
      entries.push({ productId: p.id, productName: p.name, cantidad: diff, motivo: 'Sobrante de conteo', kind: 'sobrante', costValue: 0 })
    }
    return { ...p, stock: counted }
  })
  return { products: updated, entries }
}

// === CONTABILIDAD BÁSICA (control interno, NO es contabilidad tributaria) ===
export interface AccountingSummary {
  sales: { total: number; cash: number; transfer: number; mercadopago: number; count: number; transferUnverified: number }
  discountsGiven: number            // rebaja otorgada en regalos, remates y descuentos
  purchases: { total: number; paid: number; pending: number }
  expenses: number                  // gastos del puesto
  withdrawals: number               // retiros del dueño
  losses: { merma: number; regalo: number; conteo: number; total: number }   // a costo
  result: number                    // ventas - compras - gastos (resultado de caja simple)
  afterWithdrawals: number          // lo que queda después de los retiros
  electronicReference: number       // 1,5 % referencial sobre ventas con Mercado Pago
}

export function computeAccounting(args: {
  transactions: Transaction[]
  purchases: Purchase[]
  expenses: Expense[]
  mermaLog: MermaEntry[]
  from: Date
  to: Date
}): AccountingSummary {
  const inRange = (iso: string) => { const t = new Date(iso).getTime(); return t >= args.from.getTime() && t <= args.to.getTime() }
  const tx = args.transactions.filter(t => inRange(t.date))
  const sumBy = (type: string) => tx.filter(t => t.type === type).reduce((s, t) => s + t.total, 0)
  const salesTotal = tx.reduce((s, t) => s + t.total, 0)

  const discountsGiven = tx.reduce((sum, t) => sum + t.items.reduce((s2, i) =>
    i.listTotal !== undefined && i.lineTotal !== undefined && i.listTotal > i.lineTotal ? s2 + (i.listTotal - i.lineTotal) : s2, 0), 0)

  const pu = args.purchases.filter(p => inRange(p.date))
  const purchasesTotal = pu.reduce((s, p) => s + p.total, 0)
  const purchasesPaid = pu.reduce((s, p) => s + p.paidNow, 0)

  const ex = args.expenses.filter(e => inRange(e.date))
  const expenses = ex.filter(e => e.kind === 'gasto').reduce((s, e) => s + e.amount, 0)
  const withdrawals = ex.filter(e => e.kind === 'retiro').reduce((s, e) => s + e.amount, 0)

  const lossOf = (kind: string) => args.mermaLog.filter(m => inRange(m.date) && (m.kind || 'merma') === kind).reduce((s, m) => s + (m.costValue || 0), 0)
  const merma = lossOf('merma'), regalo = lossOf('regalo'), conteo = lossOf('conteo')

  const mp = sumBy('mercadopago')
  const result = salesTotal - purchasesTotal - expenses
  return {
    sales: {
      total: salesTotal, cash: sumBy('cash'), transfer: sumBy('transfer'), mercadopago: mp, count: tx.length,
      transferUnverified: tx.filter(t => t.type === 'transfer' && t.verified === false).length,
    },
    discountsGiven,
    purchases: { total: purchasesTotal, paid: purchasesPaid, pending: purchasesTotal - purchasesPaid },
    expenses, withdrawals,
    losses: { merma, regalo, conteo, total: merma + regalo + conteo },
    result,
    afterWithdrawals: result - withdrawals,
    electronicReference: Math.round(mp * 0.015),
  }
}
