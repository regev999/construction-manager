'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatNIS } from '@/components/shared/CurrencyDisplay'
import { cn } from '@/lib/utils'
import { calculatePrices, getTotalRange, checkBudgetReality } from '@/lib/utils/price-calculator'
import type { Stage, Task } from '@/lib/types/database.types'

interface StageWithTasks extends Stage {
  tasks: Task[]
}

interface Project {
  name: string
  total_budget?: number
  house_size?: number
  has_basement?: boolean
  finish_level?: 'basic' | 'standard' | 'high'
}

export default function BudgetPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const [stages, setStages]   = useState<StageWithTasks[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: proj } = await supabase
        .from('projects')
        .select('name, total_budget, house_size, has_basement, finish_level')
        .eq('id', projectId)
        .single()
      setProject(proj)
      const { data: stagesData } = await supabase
        .from('stages')
        .select('*, tasks(*)')
        .eq('project_id', projectId)
        .order('sort_order')
      setStages(stagesData?.map(s => ({ ...s, tasks: s.tasks ?? [] })) ?? [])
      setLoading(false)
    }
    load()
  }, [projectId])

  // Smart market estimate via price-calculator
  const marketRange = useMemo(() => {
    if (!project) return null
    const items = calculatePrices({
      house_size: project.house_size ?? null,
      has_basement: project.has_basement ?? false,
      finish_level: project.finish_level ?? null,
    })
    return getTotalRange(items)
  }, [project])

  // Budget reality check
  const budgetCheck = useMemo(() => {
    if (!project) return null
    return checkBudgetReality({
      house_size: project.house_size ?? null,
      has_basement: project.has_basement ?? false,
      finish_level: project.finish_level ?? null,
      total_budget: project.total_budget ?? null,
    })
  }, [project])

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 bg-gray-100 rounded-xl w-48" />
      <div className="h-36 bg-gray-100 rounded-2xl" />
      <div className="h-48 bg-gray-100 rounded-2xl" />
    </div>
  )

  const allTasks    = stages.flatMap(s => s.tasks ?? [])
  const totalActual = allTasks.reduce((sum, t) => sum + (t.actual_cost ?? 0), 0)
  const totalBudget = project?.total_budget ?? 0
  const freeBudget  = totalBudget - totalActual
  const usedPct     = totalBudget > 0 ? Math.min(Math.round((totalActual / totalBudget) * 100), 100) : 0
  const isOver      = totalActual > totalBudget && totalBudget > 0

  // BudgetReality colors
  const realityColors = {
    unrealistic: { bg: 'bg-red-50', border: 'border-red-200', icon: 'savings', iconColor: 'text-red-500', badge: 'bg-red-100 text-red-700', title: 'text-red-800' },
    borderline:  { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'warning', iconColor: 'text-amber-500', badge: 'bg-amber-100 text-amber-700', title: 'text-amber-800' },
    ok:          { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'check_circle', iconColor: 'text-emerald-500', badge: 'bg-emerald-100 text-emerald-700', title: 'text-emerald-800' },
  }

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">תקציב — {project?.name}</h1>
        <p className="text-sm text-gray-400 mt-0.5">מעקב הוצאות ואומדן שוק לפרויקט</p>
      </div>

      {/* ── Budget Reality Widget ── */}
      {budgetCheck && (
        <div className={cn(
          'rounded-2xl border p-5',
          realityColors[budgetCheck.status].bg,
          realityColors[budgetCheck.status].border
        )}>
          <div className="flex items-start gap-4">
            <span className={cn('material-symbols-rounded filled flex-shrink-0 mt-0.5', realityColors[budgetCheck.status].iconColor)} style={{ fontSize: '1.6rem' }}>
              {realityColors[budgetCheck.status].icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className={cn('font-bold text-base', realityColors[budgetCheck.status].title)}>
                  {budgetCheck.message}
                </h3>
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', realityColors[budgetCheck.status].badge)}>
                  {budgetCheck.status === 'ok' ? 'תקציב תקין' : budgetCheck.status === 'borderline' ? 'גבולי' : 'לא ריאלי'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{budgetCheck.sub_message}</p>

              {/* Range bar */}
              {budgetCheck.status !== 'ok' && (
                <div className="bg-white/70 rounded-xl p-3 mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>אומדן שוק: {formatNIS(budgetCheck.estimated_min)} – {formatNIS(budgetCheck.estimated_max)}</span>
                    <span>התקציב שלך: {formatNIS(budgetCheck.budget)}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', budgetCheck.status === 'unrealistic' ? 'bg-red-400' : 'bg-amber-400')}
                      style={{ width: `${Math.min((budgetCheck.budget / budgetCheck.estimated_max) * 100, 100)}%` }}
                    />
                  </div>
                  {budgetCheck.shortfall > 0 && (
                    <p className="text-xs text-red-600 font-semibold mt-1.5">
                      חסר לפחות {formatNIS(budgetCheck.shortfall)} להגיע למינימום שוק
                    </p>
                  )}
                </div>
              )}

              {/* Suggestions */}
              {budgetCheck.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {budgetCheck.suggestions.map((s, i) => (
                    <span key={i} className="text-xs bg-white/70 border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Budget Card ── */}
      <div className={cn(
        'rounded-2xl p-5 text-white shadow-sm',
        isOver ? 'bg-red-600' : 'bg-[#0d1b2e]'
      )}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/50 text-xs font-medium mb-1">
              {isOver ? '⚠️ חריגה מהתקציב!' : 'מצב תקציב'}
            </p>
            <p className="text-3xl font-bold">{formatNIS(totalActual)}</p>
            <p className="text-white/50 text-sm mt-0.5">הוצאות בפועל מתוך {formatNIS(totalBudget)}</p>
          </div>
          <div className="text-left">
            <p className="text-white/50 text-xs font-medium mb-1">תקציב פנוי</p>
            <p className={cn('text-2xl font-bold', isOver ? 'text-red-200' : 'text-emerald-400')}>
              {formatNIS(Math.abs(freeBudget))}
            </p>
            {isOver && <p className="text-red-200 text-xs">חריגה</p>}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', isOver ? 'bg-red-300' : 'bg-indigo-400')}
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/40 mt-1.5">
          <span>{usedPct}% נוצל</span>
          {marketRange && (
            <span className="text-white/40">
              אומדן שוק: {formatNIS(marketRange.min)} – {formatNIS(marketRange.max)}
            </span>
          )}
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-rounded text-indigo-500" style={{ fontSize: '1.1rem' }}>account_balance_wallet</span>
            <p className="text-xs text-gray-400 font-medium">תקציב כולל</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatNIS(totalBudget)}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-rounded text-rose-500" style={{ fontSize: '1.1rem' }}>receipt_long</span>
            <p className="text-xs text-gray-400 font-medium">הוצאות בפועל</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatNIS(totalActual)}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-rounded text-violet-500" style={{ fontSize: '1.1rem' }}>calculate</span>
            <p className="text-xs text-gray-400 font-medium">אומדן שוק</p>
          </div>
          {marketRange ? (
            <p className="text-sm font-bold text-gray-900 leading-tight">
              {formatNIS(marketRange.min)}<br/>
              <span className="text-gray-400 font-normal">עד</span> {formatNIS(marketRange.max)}
            </p>
          ) : (
            <p className="text-sm text-gray-400">לא מוגדר</p>
          )}
        </div>

        <div className={cn('rounded-2xl p-4 border shadow-sm', isOver ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100')}>
          <div className="flex items-center gap-2 mb-2">
            <span className={cn('material-symbols-rounded', isOver ? 'text-red-500' : 'text-emerald-500')} style={{ fontSize: '1.1rem' }}>
              {isOver ? 'trending_down' : 'savings'}
            </span>
            <p className="text-xs text-gray-400 font-medium">תקציב פנוי</p>
          </div>
          <p className={cn('text-xl font-bold', isOver ? 'text-red-600' : 'text-emerald-600')}>
            {isOver ? '-' : ''}{formatNIS(Math.abs(freeBudget))}
          </p>
        </div>
      </div>

      {/* ── Stages Breakdown ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700">פירוט לפי שלב</h2>
          <p className="text-xs text-gray-400 mt-0.5">הוצאות בפועל מתוך מחיר מתוכנן לשלב</p>
        </div>
        <div className="divide-y divide-gray-50">
          {stages.map(stage => {
            const planned   = stage.planned_cost ?? 0
            const actual    = stage.tasks.reduce((sum, t) => sum + (t.actual_cost ?? 0), 0)
            const diff      = actual - planned
            const pct       = planned > 0 ? Math.round((actual / planned) * 100) : 0
            const completed = stage.tasks.filter(t => t.is_completed).length
            const total     = stage.tasks.length

            return (
              <div key={stage.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {completed}/{total} משימות
                      </span>
                      {diff !== 0 && planned > 0 && (
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', diff > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')}>
                          {diff > 0 ? `+${formatNIS(diff)} חריגה` : `חסכון: ${formatNIS(Math.abs(diff))}`}
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-indigo-500'
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-left w-40">
                    <p className="text-sm font-bold text-gray-900">{formatNIS(actual)}</p>
                    <p className="text-xs text-gray-400">מתוך {planned > 0 ? formatNIS(planned) : '—'}</p>
                  </div>
                  <div className="flex-shrink-0 w-12 text-left">
                    <span className={cn(
                      'text-sm font-bold',
                      pct > 100 ? 'text-red-600' : pct > 80 ? 'text-amber-600' : pct > 0 ? 'text-indigo-600' : 'text-gray-300'
                    )}>
                      {planned > 0 ? `${pct}%` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
          {stages.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <span className="material-symbols-rounded block mb-2" style={{ fontSize: '2rem' }}>payments</span>
              אין שלבים בפרויקט
            </div>
          )}
        </div>

        {/* Footer total */}
        {stages.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">סה"כ הוצאות בפועל</span>
            <span className="text-base font-bold text-gray-900">{formatNIS(totalActual)}</span>
          </div>
        )}
      </div>

      {/* ── Missing project params hint ── */}
      {!project?.house_size && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="material-symbols-rounded text-amber-500 flex-shrink-0">info</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">האומדן לא מדויק</p>
            <p className="text-xs text-amber-700 mt-0.5">
              הגדר שטח בנייה, מרתף ורמת גמר ב
              <a href="/settings" className="font-bold underline mx-1">הגדרות</a>
              לקבל אומדן שוק מדויק
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
