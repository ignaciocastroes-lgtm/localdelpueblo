// Comprobantes (fotos de transferencias, boletas, etc.).
//
// Se guardan en IndexedDB y NO en localStorage: localStorage tiene ~5 MB para
// TODO el negocio y las fotos lo llenarían. Cada pago guarda solo el id del
// comprobante (`receiptId`); la imagen vive aquí.
//
// OJO: los comprobantes quedan solo en esta tablet y NO van dentro del archivo
// de respaldo (Stock → Descargar Respaldo). El n° de operación (`reference`)
// sí va en el respaldo.

const DB_NAME = 'kiosko-comprobantes'
const STORE = 'receipts'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB no disponible')); return }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => { resolve(req.result); db.close() }
    req.onerror = () => { reject(req.error); db.close() }
  }))
}

// Devuelve el id del comprobante guardado, o undefined si no se pudo guardar.
export async function saveReceipt(dataUrl: string): Promise<string | undefined> {
  const id = `rcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  try {
    await tx('readwrite', store => store.put(dataUrl, id))
    return id
  } catch (e) {
    console.error('No se pudo guardar el comprobante', e)
    return undefined
  }
}

export async function getReceipt(id: string): Promise<string | null> {
  try {
    const value = await tx<string | undefined>('readonly', store => store.get(id))
    return value ?? null
  } catch {
    return null
  }
}

export async function deleteReceipt(id: string): Promise<void> {
  try { await tx('readwrite', store => store.delete(id)) } catch { /* sin comprobante que borrar */ }
}
