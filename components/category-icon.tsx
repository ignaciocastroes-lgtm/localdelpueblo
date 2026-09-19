'use client'

import { CupSoda, Utensils, Cookie, Trophy, Package } from 'lucide-react'
import { type ProductCategory } from '@/lib/store'

interface CategoryIconProps {
  category: ProductCategory | string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

// Map categories to icons and theme colors
const categoryConfig: Record<string, { 
  icon: React.ElementType
  bgColor: string
  iconColor: string
}> = {
  'Bebidas': {
    icon: CupSoda,
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400'
  },
  'Comida': {
    icon: Utensils,
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400'
  },
  'Sandwich': {
    icon: Utensils,
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400'
  },
  'Snacks': {
    icon: Cookie,
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    iconColor: 'text-yellow-600 dark:text-yellow-500'
  },
  'Equipamiento': {
    icon: Trophy,
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-700 dark:text-indigo-400'
  },
  'Hockey': {
    icon: Trophy,
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-700 dark:text-indigo-400'
  },
  'Accesorios': {
    icon: Trophy,
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-700 dark:text-indigo-400'
  },
}

const defaultConfig = {
  icon: Package,
  bgColor: 'bg-gray-100 dark:bg-gray-800',
  iconColor: 'text-gray-600 dark:text-gray-400'
}

const sizeClasses = {
  sm: { container: 'w-10 h-10', icon: 'w-5 h-5' },
  md: { container: 'w-16 h-16', icon: 'w-8 h-8' },
  lg: { container: 'w-24 h-24', icon: 'w-12 h-12' },
  xl: { container: 'w-32 h-32', icon: 'w-16 h-16' },
}

export function CategoryIcon({ category, size = 'lg', className = '' }: CategoryIconProps) {
  const config = categoryConfig[category] || defaultConfig
  const Icon = config.icon
  const sizes = sizeClasses[size]
  
  return (
    <div 
      className={`${sizes.container} ${config.bgColor} rounded-lg flex items-center justify-center ${className}`}
    >
      <Icon className={`${sizes.icon} ${config.iconColor}`} />
    </div>
  )
}

// Simple icon version without container (for inline use)
export function CategoryIconSimple({ category, className = '' }: { category: ProductCategory | string, className?: string }) {
  const config = categoryConfig[category] || defaultConfig
  const Icon = config.icon
  
  return <Icon className={`${config.iconColor} ${className}`} />
}
