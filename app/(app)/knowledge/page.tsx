'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ALL_KNOWLEDGE,
  CATEGORY_CONFIG,
  TYPE_CONFIG,
  type KnowledgeItem,
  type Category,
  type ContentType,
} from '@/lib/knowledge-base/data'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

// ─── Simple markdown renderer ──────────────────────────────────────────────
function RenderContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, i) => {
    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      elements.push(<p key={i} className="font-bold text-gray-900 mt-4 mb-1">{line.slice(2, -2)}</p>)
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="text-xl font-bold text-gray-900 mt-6 mb-2">{line.slice(2)}</h2>)
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-lg font-semibold text-gray-800 mt-4 mb-1">{line.slice(3)}</h3>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-2 items-start py-0.5">
          <span className="text-indigo-500 mt-1 flex-shrink-0">•</span>
          <span className="text-gray-700 text-sm leading-relaxed">{formatInline(line.slice(2))}</span>
        </div>
      )
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1]
      const rest = line.replace(/^\d+\.\s/, '')
      elements.push(
        <div key={i} className="flex gap-2 items-start py-0.5">
          <span className="text-indigo-500 font-bold text-sm flex-shrink-0 mt-0.5 w-5">{num}.</span>
          <span className="text-gray-700 text-sm leading-relaxed">{formatInline(rest)}</span>
        </div>
      )
    } else if (line.startsWith('|') && line.endsWith('|')) {
      // table row — skip for now, render as plain
      elements.push(<p key={i} className="text-gray-600 text-sm font-mono py-0.5 border-b border-gray-100">{line}</p>)
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(<p key={i} className="text-gray-700 text-sm leading-relaxed">{formatInline(line)}</p>)
    }
  })

  return <div className="space-y-0.5">{elements}</div>
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

// ─── Item Card ─────────────────────────────────────────────────────────────
function KnowledgeCard({ item, onClick }: { item: KnowledgeItem; onClick: () => void }) {
  const typeCfg = TYPE_CONFIG[item.type]
  const catCfg  = CATEGORY_CONFIG[item.category]

  const priorityBadge = item.priority === 'critical'
    ? <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">קריטי</span>
    : item.priority === 'high'
    ? <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">חשוב</span>
    : null

  return (
    <button
      onClick={onClick}
      className="w-full text-right bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-200 flex flex-col gap-3 group"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', typeCfg.bg, typeCfg.color)}>
            <span className="material-symbols-rounded" style={{ fontSize: '0.75rem', verticalAlign: 'middle', marginLeft: '3px' }}>{typeCfg.icon}</span>
            {typeCfg.label}
          </span>
          {priorityBadge}
        </div>
        <span className="material-symbols-rounded text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" style={{ fontSize: '1.1rem' }}>
          chevron_left
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 text-sm leading-snug text-right">{item.title}</h3>

      {/* Summary */}
      <p className="text-xs text-gray-500 leading-relaxed text-right">{item.summary}</p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <span className="material-symbols-rounded" style={{ fontSize: '0.75rem' }}>{catCfg.icon}</span>
          {catCfg.label}
        </span>
        {item.readTime && (
          <span className="text-xs text-gray-400">{item.readTime} דק׳ קריאה</span>
        )}
      </div>
    </button>
  )
}

// ─── Detail Modal ───────────────────────────────────────────────────────────
function DetailModal({ item, onClose }: { item: KnowledgeItem; onClose: () => void }) {
  const typeCfg = TYPE_CONFIG[item.type]
  const catCfg  = CATEGORY_CONFIG[item.category]
  const router  = useRouter()

  const priorityBar = item.priority === 'critical'
    ? <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex gap-2 items-center">
        <span className="material-symbols-rounded text-red-500" style={{ fontSize: '1.1rem' }}>error</span>
        <span className="text-sm text-red-700 font-medium">מידע קריטי — חשוב מאוד לקרוא לפני שממשיכים</span>
      </div>
    : item.priority === 'high'
    ? <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex gap-2 items-center">
        <span className="material-symbols-rounded text-orange-500" style={{ fontSize: '1.1rem' }}>warning</span>
        <span className="text-sm text-orange-700 font-medium">מידע חשוב — מומלץ לקרוא בשלב זה</span>
      </div>
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full md:max-w-2xl max-h-[92dvh] md:max-h-[85vh] bg-white md:rounded-3xl rounded-t-3xl flex flex-col shadow-2xl">
        {/* Handle (mobile) */}
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-4 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', typeCfg.bg, typeCfg.color)}>
                <span className="material-symbols-rounded" style={{ fontSize: '0.75rem', verticalAlign: 'middle', marginLeft: '3px' }}>{typeCfg.icon}</span>
                {typeCfg.label}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <span className="material-symbols-rounded" style={{ fontSize: '0.75rem' }}>{catCfg.icon}</span>
                {catCfg.label}
              </span>
              {item.readTime && <span className="text-xs text-gray-400">{item.readTime} דק׳ קריאה</span>}
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-snug">{item.title}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 flex-shrink-0 mt-0.5">
            <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {priorityBar}
          <RenderContent text={item.content} />

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
              {item.tags.map(tag => (
                <span key={tag} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* System link CTA */}
        {item.systemLink && (
          <div className="border-t border-gray-100 px-6 py-4 flex-shrink-0">
            <button
              onClick={() => { onClose(); router.push(item.systemLink!) }}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-sm font-semibold transition-colors"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>open_in_new</span>
              {item.systemLinkLabel ?? 'פתח במערכת'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Counts ─────────────────────────────────────────────────────────────────
const TYPES: Array<{ key: ContentType | 'all'; label: string; icon: string }> = [
  { key: 'all',     label: 'הכל',             icon: 'apps'      },
  { key: 'faq',     label: 'שאלות ותשובות',   icon: 'quiz'      },
  { key: 'guide',   label: 'מדריכים',         icon: 'menu_book' },
  { key: 'article', label: 'מאמרים',          icon: 'article'   },
  { key: 'warning', label: 'אזהרות',          icon: 'warning'   },
  { key: 'tip',     label: 'טיפים',           icon: 'lightbulb' },
]

const CATEGORIES: Array<{ key: Category | 'all'; label: string; icon: string }> = [
  { key: 'all',         label: 'כל הנושאים',    icon: 'apps'             },
  { key: 'system',      label: 'המערכת',        icon: 'laptop'           },
  { key: 'land',        label: 'קרקע',          icon: 'landscape'        },
  { key: 'planning',    label: 'תכנון',         icon: 'architecture'     },
  { key: 'permit',      label: 'היתר',          icon: 'gavel'            },
  { key: 'contractor',  label: 'קבלנים',        icon: 'engineering'      },
  { key: 'budget',      label: 'תקציב',         icon: 'payments'         },
  { key: 'rami',        label: 'רמ"י',          icon: 'account_balance'  },
  { key: 'construction',label: 'בנייה',         icon: 'construction'     },
  { key: 'handover',    label: 'מסירה',         icon: 'key'              },
]

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function KnowledgePage() {
  const { user, role } = useAuth()
  const supabase = createClient()
  const [userProject, setUserProject] = useState<{
    location_type: string|null;
    build_type: string|null;
    notes: string|null;
  } | null>(null)

  useEffect(() => {
    if (!user || user.id === 'dev-user') return
    supabase.from('projects')
      .select('location_type, build_type, notes')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setUserProject(data) })
  }, [user])

  const relevantTags = useMemo(() => {
    if (!userProject) return [] as string[]
    const tags: string[] = []
    if (userProject.location_type === 'moshav' || userProject.location_type === 'kibbutz') {
      tags.push('מושב', 'קיבוץ', 'נחלה', 'רמ"י')
    }
    if (userProject.notes?.includes('רמ"י')) {
      tags.push('רמ"י', 'היוון', 'דמי היתר')
    }
    if (userProject.build_type === 'turnkey') tags.push('קבלן מפתח')
    if (userProject.build_type === 'self') tags.push('ניהול עצמאי')
    return tags
  }, [userProject])

  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState<ContentType | 'all'>('all')
  const [catFilter, setCatFilter]   = useState<Category | 'all'>('all')
  const [selected, setSelected]     = useState<KnowledgeItem | null>(null)

  const filtered = useMemo(() => {
    let items = ALL_KNOWLEDGE
    if (typeFilter !== 'all') items = items.filter(i => i.type === typeFilter)
    if (catFilter  !== 'all') items = items.filter(i => i.category === catFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    // sort: relevant tags first, then critical, high, normal
    return [...items].sort((a, b) => {
      const p: Record<string, number> = { critical: 0, high: 1, normal: 2, undefined: 3 }
      const aRelevant = relevantTags.length > 0 && a.tags.some(t => relevantTags.includes(t))
      const bRelevant = relevantTags.length > 0 && b.tags.some(t => relevantTags.includes(t))
      if (aRelevant && !bRelevant) return -1
      if (!aRelevant && bRelevant) return 1
      return (p[a.priority ?? 'undefined'] ?? 3) - (p[b.priority ?? 'undefined'] ?? 3)
    })
  }, [search, typeFilter, catFilter, relevantTags])

  const stats = useMemo(() => ({
    total:    ALL_KNOWLEDGE.length,
    articles: ALL_KNOWLEDGE.filter(i => i.type === 'article').length,
    faqs:     ALL_KNOWLEDGE.filter(i => i.type === 'faq').length,
    warnings: ALL_KNOWLEDGE.filter(i => i.type === 'warning').length,
    guides:   ALL_KNOWLEDGE.filter(i => i.type === 'guide').length,
    tips:     ALL_KNOWLEDGE.filter(i => i.type === 'tip').length,
  }), [])

  return (
    <div className="space-y-4" dir="rtl">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">מרכז הידע</h1>
          <p className="text-sm text-gray-500 mt-0.5">מהמגרש ועד המפתח — {ALL_KNOWLEDGE.length} פריטי ידע</p>
        </div>
        <div className="flex items-center gap-3">
          {[
            { label: 'מאמרים', val: stats.articles, color: 'bg-blue-50 text-blue-700' },
            { label: 'אזהרות', val: stats.warnings, color: 'bg-red-50 text-red-700' },
            { label: 'מדריכים', val: stats.guides, color: 'bg-emerald-50 text-emerald-700' },
          ].map(s => (
            <span key={s.label} className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${s.color}`}>
              {s.val} {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Personalization banner ── */}
      {userProject && relevantTags.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-rounded text-indigo-500 flex-shrink-0" style={{ fontSize: '1rem' }}>person_pin</span>
          <p className="text-sm text-indigo-800">
            <span className="font-semibold">מותאם לפרויקט שלך</span>
            {' — '}תוכן רלוונטי ל{relevantTags.slice(0,3).join(', ')} מוצג ראשון
          </p>
        </div>
      )}

      {/* ── Search + filters card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        {/* Search */}
        <div className="relative mb-4">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-rounded text-gray-400" style={{ fontSize: '1rem' }}>search</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='חיפוש: קבלן, תקציב, היתר, רמ"י...'
            className="w-full bg-gray-50 rounded-xl pl-4 pr-9 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>close</span>
            </button>
          )}
        </div>

        {/* Type filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar mb-3">
          {TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key as ContentType | 'all')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 border',
                typeFilter === t.key
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              )}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>{t.icon}</span>
              {t.label}
              {t.key !== 'all' && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full', typeFilter === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}>
                  {ALL_KNOWLEDGE.filter(i => i.type === t.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setCatFilter(c.key as Category | 'all')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 border',
                catFilter === c.key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              )}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '0.8rem' }}>{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results ── */}
      <div>
        {/* Results count */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">
            {filtered.length === ALL_KNOWLEDGE.length
              ? `${filtered.length} פריטי ידע`
              : `${filtered.length} תוצאות`}
          </p>
          {(typeFilter !== 'all' || catFilter !== 'all' || search) && (
            <button
              onClick={() => { setTypeFilter('all'); setCatFilter('all'); setSearch('') }}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>refresh</span>
              נקה פילטרים
            </button>
          )}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-rounded text-gray-300 text-5xl block mb-3">search_off</span>
            <p className="text-gray-500 font-medium">לא נמצאו תוצאות</p>
            <p className="text-gray-400 text-sm mt-1">נסה חיפוש שונה או נקה את הפילטרים</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(item => (
              <KnowledgeCard key={item.id} item={item} onClick={() => setSelected(item)} />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
