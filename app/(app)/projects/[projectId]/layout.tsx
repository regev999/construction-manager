'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { segment: 'stages',      icon: 'checklist',       label: "צ'קליסט"      },
  { segment: 'budget',      icon: 'payments',         label: 'תקציב'        },
  { segment: 'contractors', icon: 'engineering',      label: 'קבלנים'       },
  { segment: 'quotes',      icon: 'request_quote',    label: 'הצעות מחיר'   },
  { segment: 'documents',   icon: 'folder_open',      label: 'מסמכים'       },
]

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { projectId: string }
}) {
  const pathname = usePathname()

  return (
    <div className="space-y-0 animate-fade-in">
      {/* Project sub-nav tabs */}
      <div className="flex items-center gap-1 mb-5 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 overflow-x-auto scrollbar-hide">
        <Link
          href="/projects"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all flex-shrink-0"
        >
          <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>arrow_forward_ios</span>
          פרויקטים
        </Link>
        <span className="text-gray-200 text-xs flex-shrink-0">•</span>
        {tabs.map(tab => {
          const href = `/projects/${params.projectId}/${tab.segment}`
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={tab.segment}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <span
                className={cn('material-symbols-rounded', active && 'filled')}
                style={{ fontSize: '0.95rem' }}
              >
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
