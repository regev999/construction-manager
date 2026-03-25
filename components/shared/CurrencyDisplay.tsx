interface CurrencyDisplayProps {
  amount: number
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function CurrencyDisplay({ amount, className = '', size = 'md' }: CurrencyDisplayProps) {
  const formatted = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(amount)

  const sizeClass = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
    xl: 'text-2xl font-bold',
  }[size]

  return <span className={`${sizeClass} ${className}`}>{formatted}</span>
}

export function formatNIS(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(amount)
}
