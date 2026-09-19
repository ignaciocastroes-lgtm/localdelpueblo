import { type Product, type Member, parseCSVLine } from './store'

// SISTEMA DE EXPORTACIÓN NATIVO (CERO LIBRERÍAS, CERO ERRORES)

export async function exportProductsToExcel(products: Product[]) {
  const headers = ['ID', 'Nombre', 'Categoria', 'Precio Costo', 'Precio Venta', 'Stock']
  const rows = products.map(p => [p.id, `"${p.name}"`, p.category, p.costPrice || 0, p.price, p.stock].join(','))
  const csv = [headers.join(','), ...rows].join('\n')

  // \uFEFF asegura que Excel lea los acentos correctamente (UTF-8 BOM)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

export async function exportMembersToExcel(members: Member[]) {
  const headers = ['ID', 'Nombre', 'RUT', 'Categoria', 'Saldo', 'Telefono']
  const rows = members.map(m => [m.id, `"${m.name}"`, m.rut, m.category, m.balance, m.phone || ''].join(','))
  const csv = [headers.join(','), ...rows].join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `socios_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

export async function parseProductsFromExcel(file: File, existingProducts: Product[]) {
  const text = await file.text()
  const lines = text.split('\n').filter(l => l.trim().length > 0)
  const products: Product[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length >= 6) {
      products.push({
        id: cols[0] || `prod-${Date.now()}-${i}`,
        name: cols[1] || 'Producto Nuevo',
        category: cols[2] as any || 'Otros',
        costPrice: Number(cols[3]) || 0,
        price: Number(cols[4]) || 0,
        stock: Number(cols[5]) || 0,
        visibleInPOS: true,
        image: ''
      })
    }
  }
  return { success: true, data: products, created: products.length, updated: 0, errors: [] }
}

export async function parseMembersFromExcel(file: File, existingMembers: Member[]) {
  const text = await file.text()
  const lines = text.split('\n').filter(l => l.trim().length > 0)
  const members: Member[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length >= 5) {
      members.push({
        id: cols[0] || `mem-${Date.now()}-${i}`,
        name: cols[1] || 'Nuevo Socio',
        rut: cols[2] || 'Sin RUT',
        category: cols[3] as any || 'Senior',
        balance: Number(cols[4]) || 0,
        phone: cols[5] || '',
        creditEnabled: true,
        isActive: true,
        creditLimit: 30000,
        joinDate: new Date().toISOString()
      })
    }
  }
  return { success: true, data: members, created: members.length, updated: 0, errors: [] }
}

export function downloadProductTemplate() { alert("No se requiere plantilla, exporte el inventario y úselo como base.") }
export function downloadMemberTemplate() { alert("No se requiere plantilla, exporte los socios y úselos como base.") }