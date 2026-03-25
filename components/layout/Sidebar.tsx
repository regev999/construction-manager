'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils'

const adminNav = [
  { href: '/dashboard',  icon: 'dashboard',     label: 'דשבורד'        },
  { href: '/leads',      icon: 'person_search',  label: 'לידים'         },
  { href: '/clients',    icon: 'group',          label: 'לקוחות'        },
  { href: '/projects',   icon: 'home_work',      label: 'פרויקטים'      },
  { href: '/knowledge',  icon: 'school',         label: 'מרכז ידע'      },
]

const clientNav = [
  { href: '/dashboard', icon: 'dashboard', label: 'דשבורד' },
  { href: '/my-project/stages', icon: 'checklist', label: "צ'קליסט" },
  { href: '/my-project/log', icon: 'event_note', label: 'יומן' },
  { href: '/my-project/budget', icon: 'payments', label: 'תקציב' },
  { href: '/my-project/price-estimate', icon: 'calculate', label: 'אומדן' },
  { href: '/my-project/quotes', icon: 'request_quote', label: 'הצעות מחיר' },
  { href: '/community', icon: 'forum', label: 'קהילה' },
  { href: '/my-project/documents', icon: 'folder_open', label: 'מסמכים' },
  { href: '/my-project/contractors', icon: 'engineering', label: 'קבלנים' },
  { href: '/knowledge', icon: 'school', label: 'מרכז ידע' },
]

const bottomLinks = [
  { href: '/settings', icon: 'settings', label: 'הגדרות' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, role, signOut } = useAuth()
  const nav = role === 'admin' ? adminNav : clientNav

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-[#0f1623] text-white flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-rounded text-white filled" style={{ fontSize: '1.1rem' }}>home_work</span>
        </div>
        <div>
          <p className="font-bold text-sm text-white">בנה חכם</p>
          <p className="text-xs text-white/40">ניהול בנייה</p>
        </div>
      </div>

      {/* Project badge */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="bg-white/5 rounded-lg px-3 py-2">
          <p className="text-xs text-white/40 mb-0.5">
            {role === 'admin' ? 'מצב מנהל' : 'הפרויקט שלי'}
          </p>
          <p className="text-xs font-medium text-white/80 truncate">
            {role === 'admin' ? 'גישה מלאה לכל הפרויקטים' : 'בית פרטי'}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                active
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-white/50 hover:text-white/90 hover:bg-white/5'
              )}
            >
              <span className={cn('material-symbols-rounded', active && 'filled')} style={{ fontSize: '1.15rem' }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-white/10 pt-3">
        {bottomLinks.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                active ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/90 hover:bg-white/5'
              )}>
              <span className="material-symbols-rounded" style={{ fontSize: '1.15rem' }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}

        {/* User */}
        <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-xl">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-rounded text-white" style={{ fontSize: '0.9rem' }}>person</span>
          </div>
          <p className="text-xs text-white/50 truncate flex-1">{user?.email ?? 'dev mode'}</p>
          <button onClick={signOut} className="text-white/30 hover:text-red-400 transition-colors">
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>logout</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
