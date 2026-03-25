'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils'

const adminNav = [
  { href: '/dashboard', icon: 'dashboard', label: 'דשבורד' },
  { href: '/projects', icon: 'home_work', label: 'פרויקטים' },
  { href: '/clients', icon: 'group', label: 'לקוחות' },
  { href: '/settings', icon: 'settings', label: 'הגדרות' },
]

const clientMainNav = [
  { href: '/dashboard', icon: 'home', label: 'בית' },
  { href: '/my-project/stages', icon: 'checklist', label: "צ'קליסט" },
  { href: '/my-project/quotes', icon: 'request_quote', label: 'הצעות' },
  { href: '/my-project/budget', icon: 'payments', label: 'תקציב' },
]

const clientMoreNav = [
  { href: '/my-project/log', icon: 'event_note', label: 'יומן' },
  { href: '/my-project/price-estimate', icon: 'calculate', label: 'אומדן' },
  { href: '/my-project/documents', icon: 'folder_open', label: 'מסמכים' },
  { href: '/my-project/contractors', icon: 'engineering', label: 'קבלנים' },
  { href: '/community', icon: 'forum', label: 'קהילה' },
  { href: '/knowledge', icon: 'school', label: 'מרכז ידע' },
  { href: '/settings', icon: 'settings', label: 'הגדרות' },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { role, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const nav = role === 'admin' ? adminNav : clientMainNav

  // Check if current page is in "more" items
  const moreActive = clientMoreNav.some(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  )

  function handleMoreLink(href: string) {
    setDrawerOpen(false)
    router.push(href)
  }

  return (
    <>
      {/* Bottom Tab Bar */}
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
                    'material-symbols-rounded transition-all',
                    active ? 'text-indigo-600 filled' : 'text-gray-400'
                  )}
                  style={{ fontSize: '1.5rem' }}
                >
                  {item.icon}
                </span>
                <span className={cn('text-xs font-medium', active ? 'text-indigo-600' : 'text-gray-400')}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* "עוד" button — only for clients */}
          {role !== 'admin' && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-0"
            >
              <span
                className={cn(
                  'material-symbols-rounded transition-all',
                  moreActive ? 'text-indigo-600 filled' : 'text-gray-400'
                )}
                style={{ fontSize: '1.5rem' }}
              >
                grid_view
              </span>
              <span className={cn('text-xs font-medium', moreActive ? 'text-indigo-600' : 'text-gray-400')}>
                עוד
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer Sheet */}
      <div
        className={cn(
          'md:hidden fixed bottom-0 inset-x-0 z-[70] bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out',
          drawerOpen ? 'translate-y-0' : 'translate-y-full'
        )}
        dir="rtl"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-base">תפריט ראשי</h3>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>close</span>
          </button>
        </div>

        {/* Nav Items Grid */}
        <div className="grid grid-cols-4 gap-2 p-4">
          {clientMoreNav.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <button
                key={item.href}
                onClick={() => handleMoreLink(item.href)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all',
                  active ? 'bg-indigo-50' : 'hover:bg-gray-50'
                )}
              >
                <span
                  className={cn(
                    'material-symbols-rounded',
                    active ? 'text-indigo-600 filled' : 'text-gray-500'
                  )}
                  style={{ fontSize: '1.6rem' }}
                >
                  {item.icon}
                </span>
                <span className={cn(
                  'text-xs font-medium text-center leading-tight',
                  active ? 'text-indigo-600' : 'text-gray-600'
                )}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Sign out */}
        <div className="px-4 pb-6 pt-2 border-t border-gray-100">
          <button
            onClick={() => { setDrawerOpen(false); signOut() }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 transition-colors text-sm font-medium"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1.2rem' }}>logout</span>
            יציאה מהחשבון
          </button>
        </div>
      </div>
    </>
  )
}
