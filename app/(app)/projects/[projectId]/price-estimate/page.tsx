'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { calculatePrices, getTotalRange, formatRange, checkBudgetReality, type AdjustedItem, type BudgetRealityResult } from '@/lib/utils/price-calculator'
import type { Quote } from '@/lib/types/database.types'

// מיפוי קטגוריית הצעת מחיר → id של price item
const QUOTE_TO_ITEM: Record<string, string[]> = {
  planning:   ['architect', 'permit_fees'],
  excavation: ['excavation'],
  structure:  ['structure'],
  concrete:   ['structure'],
  electrical: ['electrical'],
  plumbing:   ['plumbing'],
  flooring:   ['finish'],
  kitchen:    ['finish'],
  drywall:    ['finish'],
  aluminum:   ['finish'],
  painting:   ['finish'],
}

const FINISH_LABELS: Record<string, string> = {
  basic: 'בסיסי',
  standard: 'רגיל',
  high: 'גבוה',
}

const PHASE_ORDER = ['קרקע', 'היתר', 'שלד', 'גמר']

interface ProjectData {
  id: string
  name: string
  house_size: number | null
  has_basement: boolean
  basement_size?: number | null
  finish_level: 'basic' | 'standard' | 'high' | null
  total_budget: number | null
  construction_type?: 'concrete' | 'light' | null
}

function InfoModal({ item, onClose }: { item: AdjustedItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900">{item.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="material-symbols-rounded" style={{ fontSize: '1.2rem' }}>close</span>
          </button>
        </div>

        <div className="space-y-3 text-sm text-gray-600">
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-xs text-gray-400 mb-0.5">טווח המחירים</p>
            <p className="font-semibold text-gray-900">{formatRange(item.adjusted_min, item.adjusted_max)}</p>
          </div>

          <p>
            <span className="font-medium text-gray-700">איך נקבע המחיר: </span>
            {item.price_type === 'semi_dynamic'
              ? 'הטווח מחושב לפי גודל הבית שלך ונתוני שוק עדכניים.'
              : 'מחיר קבוע — לא תלוי בגודל הבית.'}
          </p>

          {item.note && (
            <div className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
              <span className="material-symbols-rounded text-amber-500 flex-shrink-0 mt-0.5" style={{ fontSize: '0.9rem' }}>info</span>
              <p className="text-xs text-amber-700">{item.note}</p>
            </div>
          )}

          <p className="text-xs text-gray-400 border-t pt-3">
            {item.explanation} · המחיר בפועל תלוי בקבלן ובבחירות שלך.
          </p>
        </div>
      </div>
    </div>
  )
}

function PriceCard({
  item,
  actualQuote,
  onInfo,
}: {
  item: AdjustedItem
  actualQuote: Quote | null
  onInfo: () => void
}) {
  const rangeStr = formatRange(item.adjusted_min, item.adjusted_max)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="font-medium text-gray-900 text-sm leading-snug">{item.name}</p>
        {item.id === 'basement' && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 flex-shrink-0">
            מרתף
          </span>
        )}
      </div>

      <p className="text-lg font-bold text-gray-900 mb-1">{rangeStr}</p>
      <p className="text-xs text-gray-400 mb-3">{item.explanation}</p>

      {/* הצעת מחיר בפועל */}
      {actualQuote && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 mb-3">
          <span className="material-symbols-rounded filled text-emerald-500 flex-shrink-0" style={{ fontSize: '0.9rem' }}>verified</span>
          <div className="min-w-0">
            <p className="text-xs text-emerald-600 font-semibold">מחיר בפועל</p>
            <p className="text-sm font-bold text-emerald-800">
              {actualQuote.amount != null ? `₪${actualQuote.amount.toLocaleString('he-IL')}` : 'הצעה מאושרת'}
              {actualQuote.contractor_name && (
                <span className="font-normal text-emerald-600 text-xs mr-1">— {actualQuote.contractor_name}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* פעולות */}
      <div className="flex items-center gap-2">
        <button
          onClick={onInfo}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>info</span>
          איך נקבע?
        </button>
        {item.quoteCategory && !actualQuote && (
          <Link
            href={`/my-project/quotes?category=${item.quoteCategory}`}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition-colors mr-auto"
          >
            קבל הצעת מחיר
            <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>arrow_back</span>
          </Link>
        )}
      </div>
    </div>
  )
}

export default function PriceEstimatePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const supabase = createClient()

  const [project, setProject] = useState<ProjectData | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [infoItem, setInfoItem] = useState<AdjustedItem | null>(null)

  useEffect(() => {
    async function load() {
      // Dev mode: use localStorage project
      if (projectId === 'dev-project-1') {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('bm_dev_project') : null
        if (saved) {
          const p = JSON.parse(saved)
          setProject({
            id: p.id,
            name: p.name ?? 'הפרויקט שלי',
            house_size: p.house_size ?? null,
            has_basement: p.has_basement ?? false,
            finish_level: p.finish_level ?? null,
            total_budget: p.total_budget ?? null,
          })
        }
        setLoading(false)
        return
      }

      const [{ data: proj }, { data: qs }] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, house_size, has_basement, basement_size, finish_level, total_budget, construction_type')
          .eq('id', projectId)
          .single(),
        supabase
          .from('quotes')
          .select('*')
          .eq('project_id', projectId)
          .eq('status', 'approved'),
      ])
      if (proj) setProject(proj)
      if (qs) setQuotes(qs)
      setLoading(false)
    }
    load()
  }, [projectId])

  const items = useMemo(() => {
    if (!project) return []
    return calculatePrices({
      house_size: project.house_size,
      has_basement: project.has_basement ?? false,
      basement_size: project.basement_size ?? null,
      finish_level: project.finish_level,
      construction_type: project.construction_type,
    })
  }, [project])

  // בנה מפה: itemId → Quote
  const quoteMap = useMemo(() => {
    const map: Record<string, Quote> = {}
    for (const q of quotes) {
      const itemIds = QUOTE_TO_ITEM[q.category] ?? []
      for (const id of itemIds) {
        if (!map[id]) map[id] = q  // first approved quote wins
      }
    }
    return map
  }, [quotes])

  const totalRange = useMemo(() => getTotalRange(items), [items])

  const budgetCheck = useMemo(() => {
    if (!project) return null
    return checkBudgetReality({
      house_size: project.house_size,
      has_basement: project.has_basement,
      basement_size: project.basement_size ?? null,
      finish_level: project.finish_level,
      total_budget: project.total_budget,
      construction_type: project.construction_type,
    })
  }, [project])

  // group by phase
  const byPhase = useMemo(() => {
    const groups: Record<string, AdjustedItem[]> = {}
    for (const item of items) {
      if (!groups[item.phase]) groups[item.phase] = []
      groups[item.phase].push(item)
    }
    return groups
  }, [items])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">אומדן עלויות</h1>
        <p className="text-sm text-gray-500">הערכות מבוססות נתוני שוק לפרויקטים דומים · המחיר בפועל תלוי בקבלן ובבחירות שלך</p>
      </div>

      {/* Missing house_size banner */}
      {!project?.house_size && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3 mb-5">
          <span className="material-symbols-rounded text-amber-500 flex-shrink-0" style={{ fontSize: '1.1rem' }}>info</span>
          <div className="flex-1">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">הוסף שטח בנייה</span> לקבלת הערכה מדויקת יותר.
            </p>
            <p className="text-xs text-amber-600 mt-0.5">כרגע מוצגים טווחי ברירת מחדל ללא התאמה לגודל.</p>
          </div>
        </div>
      )}

      {/* Project params chips */}
      {project && (
        <div className="flex flex-wrap gap-2 mb-5">
          {project.house_size && (
            <span className="flex items-center gap-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-3 py-1">
              <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>straighten</span>
              {project.house_size} מ"ר
            </span>
          )}
          {project.has_basement && (
            <span className="flex items-center gap-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-3 py-1">
              <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>domain</span>
              כולל מרתף
            </span>
          )}
          {project.finish_level && (
            <span className="flex items-center gap-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-3 py-1">
              <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>format_paint</span>
              גמר {FINISH_LABELS[project.finish_level]}
            </span>
          )}
        </div>
      )}

      {/* Total range card */}
      <div className="bg-[#0d1b2e] rounded-2xl p-5 mb-6 text-white">
        <p className="text-white/50 text-xs font-medium mb-1">סה"כ טווח משוער</p>
        <p className="text-2xl font-bold mb-1">{formatRange(totalRange.min, totalRange.max)}</p>
        <p className="text-white/40 text-xs">
          כולל {items.length} סעיפים · {quotes.length > 0 ? `${quotes.length} הצעות מחיר מאושרות` : 'עוד אין הצעות מחיר'}
        </p>
      </div>

      {/* Budget Reality Widget */}
      {budgetCheck && (() => {
        const isUnrealistic = budgetCheck.status === 'unrealistic'
        const isBorderline  = budgetCheck.status === 'borderline'
        const isOk          = budgetCheck.status === 'ok'

        const colors = {
          border: isUnrealistic ? 'border-red-200' : isBorderline ? 'border-amber-200' : 'border-emerald-200',
          bg:     isUnrealistic ? 'bg-red-50'      : isBorderline ? 'bg-amber-50'      : 'bg-emerald-50',
          title:  isUnrealistic ? 'text-red-800'   : isBorderline ? 'text-amber-800'   : 'text-emerald-800',
          sub:    isUnrealistic ? 'text-red-600'   : isBorderline ? 'text-amber-600'   : 'text-emerald-600',
          icon:   isUnrealistic ? 'text-red-500'   : isBorderline ? 'text-amber-500'   : 'text-emerald-500',
          iconName: isUnrealistic ? 'warning' : isBorderline ? 'info' : 'check_circle',
          bar:    isUnrealistic ? 'bg-red-400'     : isBorderline ? 'bg-amber-400'     : 'bg-emerald-400',
        }

        const barPct = Math.min(100, Math.round((budgetCheck.budget / budgetCheck.estimated_max) * 100))

        return (
          <div className={cn('border rounded-2xl p-4 mb-6', colors.border, colors.bg)}>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('material-symbols-rounded filled flex-shrink-0', colors.icon)} style={{ fontSize: '1.1rem' }}>
                {colors.iconName}
              </span>
              <p className={cn('font-semibold text-sm', colors.title)}>{budgetCheck.message}</p>
            </div>
            <p className={cn('text-xs mb-3 mr-6', colors.sub)}>{budgetCheck.sub_message}</p>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>התקציב שלך: <span className="font-semibold text-gray-600">₪{budgetCheck.budget.toLocaleString('he-IL')}</span></span>
                <span>עלות מקסימלית: <span className="font-semibold text-gray-600">₪{budgetCheck.estimated_max.toLocaleString('he-IL')}</span></span>
              </div>
              <div className="h-2 bg-white/60 rounded-full overflow-hidden border border-white/40">
                <div
                  className={cn('h-full rounded-full transition-all', colors.bar)}
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>מינימום: ₪{budgetCheck.estimated_min.toLocaleString('he-IL')}</span>
                {isUnrealistic && (
                  <span className="text-red-500 font-medium">חסר ₪{budgetCheck.shortfall.toLocaleString('he-IL')}</span>
                )}
              </div>
            </div>

            {/* Suggestions */}
            {budgetCheck.suggestions.length > 0 && (
              <ul className="space-y-1">
                {budgetCheck.suggestions.map((s, i) => (
                  <li key={i} className={cn('flex items-start gap-1.5 text-xs', colors.sub)}>
                    <span className="material-symbols-rounded flex-shrink-0 mt-0.5" style={{ fontSize: '0.75rem' }}>arrow_back_ios</span>
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })()}

      {/* Items by phase */}
      <div className="space-y-6">
        {PHASE_ORDER.filter(phase => byPhase[phase]).map(phase => (
          <div key={phase}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-4 h-px bg-gray-200" />
              {phase}
              <div className="h-px bg-gray-200 flex-1" />
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {byPhase[phase].map(item => (
                <PriceCard
                  key={item.id}
                  item={item}
                  actualQuote={quoteMap[item.id] ?? null}
                  onInfo={() => setInfoItem(item)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="mt-8 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          <span className="font-medium text-gray-500">שים לב:</span> הנתונים באומדן הם טווחי מחירים מקובלים בשוק הישראלי ולא הצעת מחיר מחייבת.
          המחיר בפועל תלוי בקבלנים, בחירת חומרים, תנאי השטח ועוד. קבל הצעות מחיר לפני כל התחייבות.
        </p>
      </div>

      {/* Info modal */}
      {infoItem && (
        <InfoModal item={infoItem} onClose={() => setInfoItem(null)} />
      )}
    </div>
  )
}
