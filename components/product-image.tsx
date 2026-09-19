'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CategoryIcon } from '@/components/category-icon'
import { type ProductCategory } from '@/lib/store'

interface ProductImageProps {
  src?: string
  alt: string
  category: ProductCategory | string
  className?: string
}

export function ProductImage({ src, alt, category, className = '' }: ProductImageProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // Check if src is a valid URL (not base64 and not empty)
  const isValidUrl = src && src.startsWith('http') && !src.startsWith('data:')
  
  // Show fallback if no valid URL or if image failed to load
  const showFallback = !isValidUrl || hasError
  
  return (
    <div className={`relative w-full h-full ${className}`}>
      {isValidUrl && !hasError && (
        <Image
          src={src}
          alt={alt}
          fill
          className={`object-cover transition-all duration-300 ${isLoading ? 'opacity-0' : 'opacity-100 group-hover:scale-105'}`}
          sizes="(max-width: 640px) 50vw, 33vw"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setHasError(true)
            setIsLoading(false)
          }}
        />
      )}
      
      {/* Category Icon Fallback */}
      {(showFallback || isLoading) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <CategoryIcon category={category} size="lg" />
        </div>
      )}
    </div>
  )
}
