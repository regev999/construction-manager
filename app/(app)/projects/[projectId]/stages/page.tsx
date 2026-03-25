'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { CurrencyDisplay, formatNIS } from '@/components/shared/CurrencyDisplay'
import { getStageIcon, DEFAULT_STAGES } from '@/lib/data/construction-stages'
import { calculatePrices, formatRange, type AdjustedItem } from '@/lib/utils/price-calculator'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'
import type { Stage, Task } from '@/lib/types/database.types'

interface StageWithTasks extends Stage {
  tasks: Task[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'טרם החל',
  in_progress: 'בתהליך',
  completed: 'הושלם',
  on_hold: 'מושהה',
}

export default function StagesPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { role } = useAuth()
  const [stages, setStages] = useState<StageWithTasks[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStageId, setActiveStageId] = useState<string | null>(null)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [project, setProject] = useState<any>(null)
  const [pricesByPhase, setPricesByPhase] = useState<Record<string, { min: number; max: number }>>({})

  const supabase = createClient()

  useEffect(() => { loadStages() }, [projectId])

  async function loadStages() {
    const { data: projectData } = await supabase.from('projects').select('name, location_type, build_type, notes, house_size, has_basement, finish_level').eq('id', projectId).single()
    if (projectData) {
      setProject(projectData)
      const items = calculatePrices({
        house_size: projectData.house_size ?? null,
        has_basement: projectData.has_basement ?? false,
        finish_level: projectData.finish_level ?? null,
      })
      const byPhase: Record<string, { min: number; max: number }> = {}
      for (const item of items) {
        if (!byPhase[item.phase]) byPhase[item.phase] = { min: 0, max: 0 }
        byPhase[item.phase].min += item.adjusted_min
        byPhase[item.phase].max += item.adjusted_max
      }
      setPricesByPhase(byPhase)
    }

    const { data } = await supabase
      .from('stages')
      .select('*, tasks(*)')
      .eq('project_id', projectId)
      .order('sort_order')
    if (data) {
      // Fix sort_order for stages + tasks based on DEFAULT_STAGES order
      await fixSortOrder(data)

      const withSorted = data.map(s => ({
        ...s,
        tasks: (s.tasks ?? []).sort((a: Task, b: Task) => a.sort_order - b.sort_order),
      }))
      setStages(withSorted)
      const first = withSorted.find(s => s.status === 'in_progress') ?? withSorted.find(s => s.status === 'pending') ?? withSorted[0]
      if (first) setActiveStageId(first.id)
    }
    setLoading(false)
  }

  async function fixSortOrder(stagesData: any[]) {
    for (const defaultStage of DEFAULT_STAGES) {
      // Find matching DB stage by name
      const dbStage = stagesData.find(s => s.name === defaultStage.name)
      if (!dbStage) continue

      // Fix stage sort_order if wrong
      if (dbStage.sort_order !== defaultStage.sort_order) {
        await supabase.from('stages').update({ sort_order: defaultStage.sort_order }).eq('id', dbStage.id)
        dbStage.sort_order = defaultStage.sort_order
      }

      // Fix task sort_order
      const dbTasks: Task[] = dbStage.tasks ?? []
      for (let taskIdx = 0; taskIdx < defaultStage.tasks.length; taskIdx++) {
        const defaultTask = defaultStage.tasks[taskIdx]
        const expectedSortOrder = taskIdx
        // Match by exact name or partial name
        const dbTask = dbTasks.find(t =>
          t.name === defaultTask.name ||
          t.name.includes(defaultTask.name.substring(0, 8)) ||
          defaultTask.name.includes(t.name.substring(0, 8))
        )
        if (!dbTask) continue
        if (dbTask.sort_order !== expectedSortOrder) {
          await supabase.from('tasks').update({ sort_order: expectedSortOrder }).eq('id', dbTask.id)
          dbTask.sort_order = expectedSortOrder
        }
      }
    }
  }

  async function updateStage(stageId: string, field: string, value: unknown) {
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, [field]: value } : s))
    const { error } = await supabase.from('stages').update({ [field]: value }).eq('id', stageId)
    if (error) toast.error('שגיאה בעדכון השלב')
    else toast.success('השלב עודכן')
  }

  async function updateTask(taskId: string, field: string, value: unknown) {
    // Optimistic update
    setStages(prev => prev.map(s => ({
      ...s,
      tasks: s.tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t),
    })))
    const { error } = await supabase.from('tasks').update({ [field]: value }).eq('id', taskId)
    if (error) {
      // Rollback
      setStages(prev => prev.map(s => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? { ...t, [field]: undefined } : t),
      })))
      toast.error('שגיאה בעדכון המשימה')
    }
  }

  async function toggleTask(task: Task) {
    const newValue = !task.is_completed
    setStages(prev => prev.map(s => ({
      ...s,
      tasks: s.tasks.map(t => t.id === task.id
        ? { ...t, is_completed: newValue, completed_at: newValue ? new Date().toISOString() : undefined }
        : t),
    })))
    const { error } = await supabase.from('tasks').update({
      is_completed: newValue,
      completed_at: newValue ? new Date().toISOString() : null,
    }).eq('id', task.id)
    if (error) {
      setStages(prev => prev.map(s => ({
        ...s,
        tasks: s.tasks.map(t => t.id === task.id ? { ...t, is_completed: task.is_completed } : t),
      })))
      toast.error('שגיאה בעדכון המשימה')
    } else {
      if (newValue) toast.success(`✓ "${task.name}" הושלם!`)
      // Auto-create log when task completed
      if (!error && newValue) {
        const stg = stages.find(s => s.tasks.some(t => t.id === task.id))
        await supabase.from('logs').insert({
          project_id: projectId,
          stage_id: stg?.id ?? null,
          task_id: task.id,
          type: 'completion',
          title: task.name,
          description: 'משימה סומנה כהושלמה',
          status: 'normal',
          source: 'auto',
        }).select()
      }
    }
  }

  const allTasks = stages.flatMap(s => s.tasks)
  const totalProgress = allTasks.length > 0
    ? Math.round((allTasks.filter(t => t.is_completed).length / allTasks.length) * 100)
    : 0

  const activeStage = stages.find(s => s.id === activeStageId)
  const pendingTasks = activeStage ? activeStage.tasks.filter(t => !t.is_completed) : []
  const criticalTasks = pendingTasks.filter(t => t.priority === 'critical' || t.priority === 'high')

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-24 bg-gray-200 rounded-2xl" />
      <div className="h-64 bg-gray-200 rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">

      {project && (project.location_type === 'moshav' || project.location_type === 'kibbutz' || project.notes?.includes('רמ"י')) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-rounded text-amber-500 flex-shrink-0" style={{ fontSize: '1.1rem' }}>info</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">הצ'קליסט מותאם אישית</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {[
                project.location_type === 'moshav' ? 'מושב' : project.location_type === 'kibbutz' ? 'קיבוץ' : null,
                project.notes?.includes('רמ"י') ? 'קרקע רמ"י' : null,
                project.build_type === 'turnkey' ? 'קבלן מפתח' : project.build_type === 'self' ? 'ניהול עצמאי' : null,
              ].filter(Boolean).join(' · ')} — נוספו משימות ייחודיות לסיטואציה שלך
            </p>
          </div>
        </div>
      )}

      {/* ── Construction Timeline ── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">ציר זמן הבנייה</span>
          <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
            {totalProgress}% הושלם
          </span>
        </div>
        <div className="relative flex items-start">
          {/* connector line */}
          <div className="absolute top-5 right-5 left-5 h-0.5 bg-gray-100" style={{ zIndex: 0 }}>
            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${totalProgress}%` }} />
          </div>
          {stages.map((stage, i) => {
            const pct = stage.tasks.length > 0
              ? Math.round((stage.tasks.filter(t => t.is_completed).length / stage.tasks.length) * 100)
              : 0
            const isDone = stage.status === 'completed' || pct === 100
            const isActive = stage.id === activeStageId
            const isCurrent = stage.status === 'in_progress'
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStageId(stage.id)}
                className="flex-1 flex flex-col items-center gap-2 relative z-10"
              >
                <div className={cn(
                  'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all',
                  isDone ? 'bg-indigo-600 border-indigo-600' :
                  isActive ? 'bg-white border-indigo-600 shadow-md shadow-indigo-100' :
                  'bg-white border-gray-200'
                )}>
                  {isDone
                    ? <span className="material-symbols-rounded text-white filled" style={{ fontSize: '1.1rem' }}>check</span>
                    : <span className={cn('material-symbols-rounded', isActive ? 'text-indigo-600' : 'text-gray-300')} style={{ fontSize: '1.1rem' }}>
                        {getStageIcon(stage.name)}
                      </span>
                  }
                </div>
                <div className="text-center">
                  <p className={cn('text-xs font-semibold leading-tight', isActive ? 'text-indigo-700' : isDone ? 'text-gray-500' : 'text-gray-300')}>
                    {stage.name}
                  </p>
                  {isCurrent && (
                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">פעיל</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Main Content ── */}
      {activeStage && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Tasks */}
          <div className="lg:col-span-2 space-y-4">
            {/* Stage header */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded-full',
                    activeStage.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    activeStage.status === 'in_progress' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-gray-100 text-gray-500'
                  )}>
                    {STATUS_LABELS[activeStage.status] ?? activeStage.status}
                  </span>
                  <h2 className="text-xl font-bold text-gray-900 mt-2">{activeStage.name}</h2>
                  {/* Date chips under stage name */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {activeStage.start_date ? (
                      <span className="flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                        <span className="material-symbols-rounded" style={{ fontSize: '0.7rem' }}>play_arrow</span>
                        התחלה: {new Date(activeStage.start_date).toLocaleDateString('he-IL', { day:'numeric', month:'short', year:'2-digit' })}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100">
                        <span className="material-symbols-rounded" style={{ fontSize: '0.7rem' }}>event</span>
                        אין תאריך התחלה
                      </span>
                    )}
                    {activeStage.end_date ? (
                      <span className={cn(
                        'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full',
                        new Date(activeStage.end_date) < new Date() && activeStage.status !== 'completed'
                          ? 'bg-red-50 text-red-600 border border-red-100'
                          : 'bg-gray-100 text-gray-500'
                      )}>
                        <span className="material-symbols-rounded" style={{ fontSize: '0.7rem' }}>flag</span>
                        יעד: {new Date(activeStage.end_date).toLocaleDateString('he-IL', { day:'numeric', month:'short', year:'2-digit' })}
                        {new Date(activeStage.end_date) < new Date() && activeStage.status !== 'completed' && ' ⚠'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">
                        <span className="material-symbols-rounded" style={{ fontSize: '0.7rem' }}>flag</span>
                        אין תאריך סיום
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-left">
                  {(() => {
                    const done = activeStage.tasks.filter(t => t.is_completed).length
                    const total = activeStage.tasks.length
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0
                    return (
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className={cn('text-lg font-bold', pct === 100 ? 'text-emerald-600' : 'text-indigo-600')}>{pct}%</span>
                      </div>
                    )
                  })()}
                  <p className="text-xs text-gray-400 mt-1 text-left">
                    {activeStage.tasks.filter(t => t.is_completed).length} / {activeStage.tasks.length} משימות
                  </p>
                </div>
              </div>
            </div>

            {/* Tasks grouped: pending then completed */}
            {[
              { label: 'משימות פתוחות', tasks: activeStage.tasks.filter(t => !t.is_completed), icon: 'checklist' },
              { label: 'משימות שהושלמו', tasks: activeStage.tasks.filter(t => t.is_completed), icon: 'check_circle' },
            ].map(group => group.tasks.length > 0 && (
              <div key={group.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-50">
                  <span className={cn('material-symbols-rounded', group.label.includes('הושלמו') ? 'text-emerald-500' : 'text-indigo-500')}
                    style={{ fontSize: '1rem' }}>{group.icon}</span>
                  <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">{group.label}</p>
                  <span className="text-xs text-gray-300 mr-auto">{group.tasks.length}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {group.tasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      role={role}
                      isExpanded={expandedTask === task.id}
                      onToggle={() => toggleTask(task)}
                      onExpand={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                      onUpdateTask={updateTask}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-4">

            {/* Critical Alerts */}
            {criticalTasks.length > 0 && (
              <div className="rounded-2xl p-5 border border-red-100" style={{ background: '#fff8f7' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-rounded text-red-500 filled" style={{ fontSize: '1rem' }}>warning</span>
                  <p className="text-xs font-bold tracking-widest text-red-600 uppercase">התראות קריטיות</p>
                </div>
                <div className="space-y-3">
                  {criticalTasks.slice(0, 3).map(task => (
                    <div key={task.id} className="bg-white rounded-xl p-3 border border-red-100">
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 font-bold text-sm flex-shrink-0">!</span>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{task.name}</p>
                          {task.description && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{task.description}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress insight */}
            <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #002045 0%, #0a3060 100%)' }}>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="material-symbols-rounded text-indigo-300 filled" style={{ fontSize: '0.9rem' }}>auto_awesome</span>
                <p className="text-xs font-bold tracking-widest text-indigo-300 uppercase">סיכום התקדמות</p>
              </div>
              <p className="text-sm leading-relaxed text-white/90">
                {totalProgress === 0
                  ? 'הפרויקט עוד לא התחיל. לחץ על משימה כדי לסמן אותה כהושלמה.'
                  : totalProgress === 100
                  ? '🎉 כל המשימות הושלמו! הפרויקט הסתיים בהצלחה.'
                  : `השלמת ${totalProgress}% מהמשימות. ${pendingTasks.length} משימות נותרו לשלב הנוכחי.`
                }
              </p>
              {pricesByPhase[activeStage.name] && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-white/50">אומדן שוק לשלב{project?.house_size ? ` · ${project.house_size} מ"ר` : ''}</p>
                  <p className="text-base font-bold text-white mt-0.5">
                    {formatRange(pricesByPhase[activeStage.name].min, pricesByPhase[activeStage.name].max)}
                  </p>
                </div>
              )}
            </div>

            {/* Stage Settings — dates, status, cost */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
              <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">פרטי שלב</p>

              {/* Status */}
              {role === 'admin' && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">סטטוס</label>
                  <select
                    value={activeStage.status}
                    onChange={e => updateStage(activeStage.id, 'status', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="pending">טרם החל</option>
                    <option value="in_progress">בתהליך</option>
                    <option value="completed">הושלם</option>
                    <option value="on_hold">מושהה</option>
                  </select>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                    <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>play_arrow</span>
                    תאריך התחלה
                  </label>
                  <input
                    type="date"
                    defaultValue={activeStage.start_date ?? ''}
                    key={`start-${activeStage.id}`}
                    onBlur={e => updateStage(activeStage.id, 'start_date', e.target.value || null)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                    <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>flag</span>
                    תאריך סיום מתוכנן
                    {activeStage.end_date && new Date(activeStage.end_date) < new Date() && activeStage.status !== 'completed' && (
                      <span className="text-red-500 text-[10px] font-bold">⚠ עבר!</span>
                    )}
                  </label>
                  <input
                    type="date"
                    defaultValue={activeStage.end_date ?? ''}
                    key={`end-${activeStage.id}`}
                    onBlur={e => updateStage(activeStage.id, 'end_date', e.target.value || null)}
                    className={cn(
                      'w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300',
                      activeStage.end_date && new Date(activeStage.end_date) < new Date() && activeStage.status !== 'completed'
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200'
                    )}
                  />
                </div>
                {role === 'admin' && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                      <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>payments</span>
                      עלות מתוכננת (₪)
                    </label>
                    <input
                      type="number"
                      defaultValue={activeStage.planned_cost ?? ''}
                      key={`cost-${activeStage.id}`}
                      onBlur={e => updateStage(activeStage.id, 'planned_cost', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                )}
              </div>

              {/* Date summary chips */}
              {(activeStage.start_date || activeStage.end_date) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeStage.start_date && (
                    <span className="flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                      <span className="material-symbols-rounded" style={{ fontSize: '0.7rem' }}>play_arrow</span>
                      {new Date(activeStage.start_date).toLocaleDateString('he-IL', { day:'numeric', month:'short' })}
                    </span>
                  )}
                  {activeStage.end_date && (
                    <span className={cn(
                      'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full',
                      activeStage.end_date && new Date(activeStage.end_date) < new Date() && activeStage.status !== 'completed'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-gray-100 text-gray-500'
                    )}>
                      <span className="material-symbols-rounded" style={{ fontSize: '0.7rem' }}>flag</span>
                      {new Date(activeStage.end_date).toLocaleDateString('he-IL', { day:'numeric', month:'short' })}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick links */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">קישורים מהירים</p>
              <div className="space-y-2">
                {[
                  { href: `/projects/${projectId}/budget`, icon: 'payments', label: 'תקציב הפרויקט' },
                  { href: `/projects/${projectId}/documents`, icon: 'folder_open', label: 'מסמכים' },
                  { href: `/projects/${projectId}/contractors`, icon: 'engineering', label: 'קבלנים' },
                ].map(link => (
                  <Link key={link.href} href={link.href}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                    <span className="material-symbols-rounded text-gray-400 group-hover:text-indigo-500 transition-colors" style={{ fontSize: '1.1rem' }}>{link.icon}</span>
                    <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{link.label}</span>
                    <span className="material-symbols-rounded text-gray-200 mr-auto group-hover:text-indigo-400 transition-colors" style={{ fontSize: '0.9rem' }}>arrow_back</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, role, isExpanded, onToggle, onExpand, onUpdateTask }: {
  task: Task
  role: string | null
  isExpanded: boolean
  onToggle: () => void
  onExpand: () => void
  onUpdateTask: (taskId: string, field: string, value: unknown) => void
}) {
  const priorityConfig: Record<string, { label: string; color: string }> = {
    critical: { label: 'קריטי', color: 'text-red-600 bg-red-50' },
    high: { label: 'גבוה', color: 'text-orange-600 bg-orange-50' },
    normal: { label: 'רגיל', color: 'text-gray-500 bg-gray-100' },
    low: { label: 'נמוך', color: 'text-gray-400 bg-gray-50' },
  }
  const p = priorityConfig[task.priority ?? 'normal']

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = task.due_date ? new Date(task.due_date) : null
  if (dueDate) dueDate.setHours(0, 0, 0, 0)
  const isOverdue = dueDate && !task.is_completed && dueDate < today
  const daysOverdue = isOverdue && dueDate
    ? Math.round((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const hasExpandContent = task.why_important || task.pro_tip || task.what_if_skip || true // always expandable for dates

  return (
    <div className={cn('transition-colors', task.is_completed ? 'bg-gray-50/40' : 'bg-white')}>
      <div className="flex items-start gap-4 px-5 py-4">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
            task.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-indigo-400'
          )}
        >
          {task.is_completed && (
            <span className="material-symbols-rounded text-white filled" style={{ fontSize: '0.75rem' }}>check</span>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold', task.is_completed ? 'text-gray-400 line-through' : 'text-gray-900')}>
            {task.name}
          </p>
          {task.description && (
            <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>
          )}
          {/* Date + overdue chips */}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {task.due_date && (
              <span className={cn(
                'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full',
                isOverdue
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : task.is_completed
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-gray-100 text-gray-500'
              )}>
                <span className="material-symbols-rounded" style={{ fontSize: '0.7rem' }}>event</span>
                יעד: {new Date(task.due_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {isOverdue && daysOverdue > 0 && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold border border-red-200">
                <span className="material-symbols-rounded" style={{ fontSize: '0.7rem' }}>warning</span>
                איחור של {daysOverdue} ימים
              </span>
            )}
            {task.is_completed && task.completed_at && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                <span className="material-symbols-rounded" style={{ fontSize: '0.7rem' }}>check_circle</span>
                בוצע: {new Date(task.completed_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {task.priority && task.priority !== 'normal' && (
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', p.color)}>{p.label}</span>
          )}
          {task.is_completed
            ? <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">הושלם</span>
            : isOverdue
            ? <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">באיחור</span>
            : <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">ממתין</span>
          }
          <button onClick={onExpand} className="text-gray-300 hover:text-indigo-500 transition-colors mr-1">
            <span className={cn('material-symbols-rounded transition-transform', isExpanded && 'rotate-180')} style={{ fontSize: '1rem' }}>
              expand_more
            </span>
          </button>
        </div>
      </div>

      {/* Expanded */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-gray-50 pt-3">

          {/* ── Task Dates ── */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">תאריכים</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                  <span className="material-symbols-rounded text-indigo-400" style={{ fontSize: '0.85rem' }}>event</span>
                  תאריך יעד
                </label>
                <input
                  type="date"
                  defaultValue={task.due_date ?? ''}
                  key={`due-${task.id}`}
                  onBlur={e => onUpdateTask(task.id, 'due_date', e.target.value || null)}
                  className={cn(
                    'w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white',
                    isOverdue ? 'border-red-300' : 'border-gray-200'
                  )}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                  <span className="material-symbols-rounded text-emerald-500" style={{ fontSize: '0.85rem' }}>check_circle</span>
                  תאריך ביצוע בפועל
                </label>
                <input
                  type="date"
                  defaultValue={task.completed_at ? task.completed_at.split('T')[0] : ''}
                  key={`done-${task.id}`}
                  onBlur={e => {
                    if (e.target.value) {
                      onUpdateTask(task.id, 'completed_at', new Date(e.target.value).toISOString())
                    } else {
                      onUpdateTask(task.id, 'completed_at', null)
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                />
              </div>
            </div>
            {/* Delay summary */}
            {isOverdue && daysOverdue > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <span className="material-symbols-rounded text-red-500" style={{ fontSize: '0.9rem' }}>warning</span>
                <p className="text-xs text-red-700 font-semibold">
                  המשימה באיחור של <strong>{daysOverdue} ימים</strong> — תאריך היעד היה {new Date(task.due_date!).toLocaleDateString('he-IL')}
                </p>
              </div>
            )}
            {task.is_completed && task.completed_at && task.due_date && (
              (() => {
                const planned = new Date(task.due_date)
                const actual = new Date(task.completed_at)
                const diff = Math.round((actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24))
                if (diff > 0) return (
                  <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                    ✓ הושלם — אך {diff} ימים לאחר המועד המתוכנן
                  </p>
                )
                if (diff < 0) return (
                  <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                    ✓ הושלם {Math.abs(diff)} ימים לפני המועד המתוכנן
                  </p>
                )
                return (
                  <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                    ✓ הושלם בדיוק במועד המתוכנן
                  </p>
                )
              })()
            )}
          </div>

          {/* ── Info boxes ── */}
          {task.why_important && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-600 mb-1">🚨 למה זה חשוב</p>
              <p className="text-amber-700 text-xs leading-relaxed">{task.why_important}</p>
            </div>
          )}
          {task.what_if_skip && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xs font-bold text-red-600 mb-1">⚠️ מה קורה אם לא עושים</p>
              <p className="text-red-700 text-xs leading-relaxed">{task.what_if_skip}</p>
            </div>
          )}
          {task.pro_tip && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <p className="text-xs font-bold text-indigo-600 mb-1">💡 טיפ מקצועי</p>
              <p className="text-indigo-700 text-xs leading-relaxed">{task.pro_tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
