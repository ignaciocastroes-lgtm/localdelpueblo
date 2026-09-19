// Reduce las fotos antes de guardarlas. Una foto de cámara de tablet pesa
// 2–8 MB; el almacenamiento del navegador (localStorage) tiene ~5 MB en total
// para TODO el negocio. Sin esto, 1–2 fotos llenan la memoria y la app deja de
// guardar ventas y saldos sin avisar. A 640 px y calidad 0.7 cada foto pesa
// ~40–70 KB, más que suficiente para la tarjeta del producto.

export function compressImageFile(file: File, maxDim = 640, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas no disponible')

        // Fondo blanco: los PNG con transparencia quedarían negros en JPEG.
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)

        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (e) {
        reject(e)
      } finally {
        URL.revokeObjectURL(url)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }

    img.src = url
  })
}
