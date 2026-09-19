'use client'

import { useState, useEffect, type ReactNode } from 'react'

interface SafeImageProps {
  src?: string
  alt: string
  className?: string
  fallback: ReactNode
}

// <img> que cae a un ícono si la foto no carga (URL caída, sin internet,
// dato corrupto). Sin esto el navegador muestra el texto "alt" roto encima
// de la tarjeta del producto.
export function SafeImage({ src, alt, className, fallback }: SafeImageProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => { setFailed(false) }, [src])

  if (!src || failed) return <>{fallback}</>

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />
  )
}
