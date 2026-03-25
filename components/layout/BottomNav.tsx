'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils'

const adminNav = [
  { href: '/dashboard', icon: 'dashboard', label: 'דשבורד' },
  { href: '/projects', icon: 'home_work', label: 'פרויקטים' },
  { href: '/clients', icon: 'group', label: 'לקוחות' },
  { href: '/settings', icon: 'settings', label: 'הגדרות' },
]

const clientNav = [
  { href: '/dashboard', icon: 'home', label: 'בית' },
  { href: '/my-project/stages', icon: 'checklist', label: 'צ\'קליסט' },
  { href: '/my-project/quotes', icon: 'request_quote', label: 'הצעות' },
  { href: '/my-project/budget', icon: 'payments', label: 'תקציב' },
  { href: '/community', icon: 'forum', label: 'קהילה' },
]

export function BottomNav() {
  const pathname = usePathname()
  const { role } = useAuth()
  const nav = role === 'admin' ? adminNav : clientNav

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-gray-100 z-50 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-2">
        {nav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-0"
            >
              <span
                className={cn(
                  "material-symbols-rounded transition-all",
                  active ? "text-indigo-600 filled" : "text-gray-400"
                )}
                style={{ fontSize: '1.5rem' }}
              >
                {item.icon}
              </span>
              <span className={cn(
                "text-xs font-medium",
                active ? "text-indigo-600" : "text-gray-400"
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
