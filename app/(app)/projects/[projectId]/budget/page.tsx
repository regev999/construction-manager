'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatNIS } from '@/components/shared/CurrencyDisplay'
import { cn } from '@/lib/utils'
import type { Stage, Task } from '@/lib/types/database.types'

interface StageWithTasks extends Stage {
  tasks: Task[]
}

export default function BudgetPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const [stages, setStages] = useState<StageWithTasks[]>([])
  const [project, setProject] = useState<{ total_budget?: number; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: proj } = await supabase.from('projects').select('name, total_budget').eq('id', projectId).single()
      setProject(proj)
      const { data: stagesData } = await supabase.from('stages').select('*, tasks(*)').eq('project_id', projectId).order('sort_order')
      setStages(stagesData?.map(s => ({ ...s, tasks: s.tasks ?? [] })) ?? [])
      setLoading(false)
    }
    load()
  }, [projectId])

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-200 rounded-2xl" /></div>

  const allTasks = stages.flatMap(s => s.tasks ?? [])
  const totalPlanned = stages.reduce((sum, s) => sum + (s.planned_cost ?? 0), 0)
  const totalActual = allTasks.reduce((sum, t) => sum + (t.actual_cost ?? 0), 0)
  const totalBudget = project?.total_budget ?? totalPlanned
  const remaining = totalBudget - totalActual
  const budgetPercent = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0
  const isOverBudget = totalActual > totalBudget && totalBudget > 0

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">תקציב — {project?.name}</h1>

      {/* Top row: Summary + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main budget bar */}
        <div className={cn("lg:col-span-2 rounded-2xl p-5 text-white shadow-sm", isOverBudget ? "gradient-danger" : "gradient-primary")}>
          <p className="text-white/70 text-sm mb-1">{isOverBudget ? '⚠️ חריגה מהתקציב!' : 'מצב תקציב'}</p>
          <p className="text-3xl font-bold">{formatNIS(totalActual)}</p>
          <p className="text-white/70 text-sm mt-1">מתוך {formatNIS(totalBudget)} מתוקצבים</p>
          <div className="mt-4 h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/70 mt-1.5">
            <span>{budgetPercent}% נוצל</span>
            <span>{isOverBudget ? `חריגה: ${formatNIS(Math.abs(remaining))}` : `נותר: ${formatNIS(remaining)}`}</span>
          </div>
        </div>

        {/* Stats column */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">תקציב כולל</p>
            <p className="text-xl font-bold text-gray-900">{formatNIS(totalBudget)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">מתוכנן (סך שלבים)</p>
            <p className="text-xl font-bold text-gray-900">{formatNIS(totalPlanned)}</p>
          </div>
          <div className={cn("rounded-xl p-4 shadow-sm border", isOverBudget ? "bg-red-50 border-red-100" : "bg-white border-gray-100")}>
            <p className="text-xs text-gray-400 mb-1">יתרה</p>
            <p className={cn("text-xl font-bold", isOverBudget ? "text-red-600" : "text-emerald-600")}>{formatNIS(remaining)}</p>
          </div>
        </div>
      </div>

      {/* Stages Breakdown — table style */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-700">פירוט לפי שלב</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {stages.map(stage => {
            const planned = stage.planned_cost ?? 0
            const actual = stage.tasks.reduce((sum, t) => sum + (t.actual_cost ?? 0), 0)
            const diff = actual - planned
            const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0
            const completedTasks = stage.tasks.filter(t => t.is_completed).length

            return (
              <div key={stage.id} className="px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                      <span className="text-xs text-gray-400">{completedTasks}/{stage.tasks.length} משימות</span>
                      {diff !== 0 && (
                        <span className={cn("text-xs font-medium", diff > 0 ? "text-red-500" : "text-emerald-500")}>
                          {diff > 0 ? `+${formatNIS(diff)} חריגה` : `חסכון: ${formatNIS(Math.abs(diff))}`}
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500")}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0 w-36">
                    <p className="text-sm font-semibold text-gray-900">{formatNIS(actual)}</p>
                    <p className="text-xs text-gray-400">מתוך {formatNIS(planned)}</p>
                  </div>
                  <div className="text-left flex-shrink-0 w-14">
                    <span className={cn("text-sm font-bold", pct > 100 ? "text-red-600" : pct > 80 ? "text-amber-600" : "text-gray-500")}>
                      {pct}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {stages.length === 0 && (
          <div className="text-center py-10 text-gray-400">אין שלבים בפרויקט</div>
        )}
      </div>
    </div>
  )
}
