'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatNIS } from '@/components/shared/CurrencyDisplay'
import { getStageIcon } from '@/lib/data/construction-stages'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Project, Stage, Task, Quote } from '@/lib/types/database.types'
import { SmartEnginePanel } from '@/components/dashboard/SmartEnginePanel'
import { getNextAction, getSmartAlerts } from '@/lib/smart-engine'
import type { ContractorSummary } from '@/lib/smart-engine'

interface ProjectWithStages extends Project {
  stages?: (Stage & { tasks?: Task[] })[]
  contractors?: ContractorSummary[]
  quotes?: Quote[]
}

interface Document { id: string; name: string; category: string; created_at: string }
interface CommunityPost { id: string; title: string; post_type: string; stage_tag: string | null; likes: number; answers_count: number }

export default function DashboardPage() {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectWithStages[]>([])
  const [fetching, setFetching] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (loading) return
    if (!user) { setFetching(false); return }
    if (user.id === 'dev-user') { setFetching(false); return }
    async function load() {
      const query = role === 'admin'
        ? supabase.from('projects').select('*').eq('admin_id', user!.id).order('created_at', { ascending: false })
        : supabase.from('projects').select('*').eq('client_id', user!.id).order('created_at', { ascending: false })
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        setFetching(false)
        toast.error('הטעינה לקחה יותר מדי זמן — בדוק את החיבור לאינטרנט')
      }, 8000)
      const { data: projectsData } = await query
      clearTimeout(timer)
      if (timedOut) return
      if (!projectsData) { setFetching(false); return }
      const full = await Promise.all(
        projectsData.map(async (p) => {
          const [{ data: stages }, { data: contractors }, { data: quotes }] = await Promise.all([
            supabase.from('stages').select('*, tasks(*)').eq('project_id', p.id).order('sort_order'),
            supabase.from('contractors').select('id,name,contract_url,status,progress_pct,quote_amount,advance_amount,actual_amount,planned_end_date').eq('project_id', p.id),
            supabase.from('quotes').select('*').eq('project_id', p.id),
          ])
          return { ...p, stages: stages ?? [], contractors: (contractors ?? []) as ContractorSummary[], quotes: (quotes ?? []) as Quote[] }
        })
      )
      setProjects(full)
      setFetching(false)
    }
    load()
  }, [user, role, loading])

  if (loading || fetching) return <LoadingSkeleton />

  if (projects.length === 0) {
    if (role === 'client' && user?.id !== 'dev-user') {
      const justFinished = typeof window !== 'undefined' && sessionStorage.getItem('bm_onboarding_done') === '1'
      if (justFinished) { sessionStorage.removeItem('bm_onboarding_done'); return <EmptyDashboard role={role} /> }
      router.replace('/onboarding')
      return (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#002045] flex items-center justify-center">
              <span className="material-symbols-rounded text-white filled" style={{ fontSize: '1.4rem' }}>home_work</span>
            </div>
            <div className="w-6 h-6 border-2 border-[#002045] border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )
    }
    return <EmptyDashboard role={role} />
  }

  if (role === 'client') return <ClientDashboard project={projects[0]} />
  return <AdminDashboard projects={projects} />
}

// ─── CLIENT DASHBOARD ─────────────────────────────────────────────────────────
function ClientDashboard({ project }: { project: ProjectWithStages }) {
  const supabase = createClient()
  const stages = project.stages ?? []
  const allTasks = stages.flatMap(s => s.tasks ?? [])
  const completedTasks = allTasks.filter(t => t.is_completed)
  const progress = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0

  const currentStage = stages.find(s => s.status === 'in_progress') ?? stages.find(s => s.status === 'pending')
  const currentStageTasks = currentStage?.tasks ?? []
  const criticalTasks = currentStageTasks.filter(t => !t.is_completed && (t.priority === 'critical' || t.priority === 'high')).slice(0, 5)
  const nextTasks = criticalTasks.length > 0 ? criticalTasks : currentStageTasks.filter(t => !t.is_completed).slice(0, 5)

  // Budget
  const totalBudget = project.total_budget ?? 0
  const plannedCost = allTasks.reduce((s, t) => s + (t.planned_cost ?? 0), 0)
  const tasksActualCost = allTasks.reduce((s, t) => s + (t.actual_cost ?? 0), 0)
  // Approved quotes count as committed spend
  const approvedQuotesTotal = (project.quotes ?? [])
    .filter(q => q.status === 'approved')
    .reduce((s, q) => s + (q.amount ?? 0), 0)
  const actualCost = Math.max(tasksActualCost, approvedQuotesTotal)
  const budgetUsedPct = totalBudget > 0 ? Math.round((actualCost / totalBudget) * 100) : 0
  const budgetOverrun = actualCost > plannedCost && plannedCost > 0

  // Risk score
  const overdueTasks = allTasks.filter(t => !t.is_completed && t.due_date && new Date(t.due_date) < new Date()).length
  const criticalPending = allTasks.filter(t => !t.is_completed && t.priority === 'critical').length
  const riskScore: 'low' | 'medium' | 'high' =
    criticalPending > 2 || budgetUsedPct > 90 ? 'high' :
    overdueTasks > 0 || budgetUsedPct > 70 ? 'medium' : 'low'

  const [recentDocs, setRecentDocs] = useState<Document[]>([])
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([])
  const [taskCostMap, setTaskCostMap] = useState<Record<string, string>>({})
  const [completingTask, setCompletingTask] = useState<Task | null>(null)
  const [localTasks, setLocalTasks] = useState<Task[]>(currentStageTasks)
  const [localStages, setLocalStages] = useState(stages)
  const [editingStageId, setEditingStageId] = useState<string | null>(null)

  async function saveStageDate(stageId: string, field: 'start_date' | 'end_date', value: string) {
    setLocalStages(prev => prev.map(s => s.id === stageId ? { ...s, [field]: value || null } : s))
    await supabase.from('stages').update({ [field]: value || null }).eq('id', stageId)
  }

  // ── Smart Engine ──
  const engineInput = useMemo(() => ({
    project,
    stages: localStages ?? [],
    contractors: project.contractors ?? [],
    quotes: project.quotes ?? [],
  }), [project, localStages])
  const smartAction = useMemo(() => getNextAction(engineInput), [engineInput])
  const smartAlerts = useMemo(() => getSmartAlerts(engineInput), [engineInput])

  useEffect(() => {
    setLocalTasks(currentStageTasks)
  }, [currentStage?.id])

  useEffect(() => {
    supabase.from('documents').select('id, name, category, created_at').eq('project_id', project.id)
      .order('created_at', { ascending: false }).limit(4).then(({ data }) => { if (data) setRecentDocs(data) })
    supabase.from('community_posts').select('id, title, post_type, stage_tag, likes, answers_count')
      .order('likes', { ascending: false }).limit(4).then(({ data }) => { if (data) setCommunityPosts(data) })
  }, [project.id])

  async function handleToggleTask(task: Task) {
    const newValue = !task.is_completed
    if (newValue && task.planned_cost) {
      setCompletingTask(task)
      return
    }
    await doToggle(task, newValue, null)
  }

  async function doToggle(task: Task, newValue: boolean, actualCostInput: number | null) {
    const updatedTask = { ...task, is_completed: newValue, actual_cost: actualCostInput ?? task.actual_cost }
    // Update both localTasks and localStages so progress % stays in sync
    setLocalTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t))
    setLocalStages(prev => prev.map(s => ({
      ...s,
      tasks: (s.tasks ?? []).map((t: Task) => t.id === task.id ? updatedTask : t),
    })))
    const { error } = await supabase.from('tasks').update({
      is_completed: newValue,
      completed_at: newValue ? new Date().toISOString() : null,
      actual_cost: actualCostInput ?? task.actual_cost,
    }).eq('id', task.id)
    if (error) {
      // Rollback on failure
      setLocalTasks(prev => prev.map(t => t.id === task.id ? task : t))
      setLocalStages(prev => prev.map(s => ({
        ...s,
        tasks: (s.tasks ?? []).map((t: Task) => t.id === task.id ? task : t),
      })))
      toast.error('שגיאה בעדכון המשימה')
    } else {
      if (newValue) toast.success(`✓ "${task.name}" הושלם!`)
    }
    setCompletingTask(null)
    setTaskCostMap(m => { const n = { ...m }; delete n[task.id]; return n })
  }

  const riskConfig = {
    low: { label: 'נמוך', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500' },
    medium: { label: 'בינוני', color: 'text-amber-600 bg-amber-50 border-amber-100', dot: 'bg-amber-500' },
    high: { label: 'גבוה', color: 'text-red-600 bg-red-50 border-red-100', dot: 'bg-red-500' },
  }[riskScore]

  const docCatIcons: Record<string, string> = {
    permit: 'gavel', plan: 'architecture', receipt: 'receipt',
    contract: 'description', photo: 'photo_camera', other: 'folder',
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── 1. PROJECT HEADER ── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
            {project.address && <p className="text-sm text-gray-400 mt-0.5">{project.address}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {currentStage && (
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
                  <span className="material-symbols-rounded filled" style={{ fontSize: '0.8rem' }}>play_circle</span>
                  שלב נוכחי: {currentStage.name}
                </span>
              )}
              <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', riskConfig.color)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', riskConfig.dot)} />
                סיכון {riskConfig.label}
              </span>
              {budgetOverrun && (
                <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
                  <span className="material-symbols-rounded" style={{ fontSize: '0.8rem' }}>warning</span>
                  חריגת תקציב
                </span>
              )}
            </div>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-36 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-sm font-bold text-gray-700">{progress}%</span>
            </div>
            <p className="text-xs text-gray-400">{completedTasks.length} / {allTasks.length} משימות</p>
          </div>
        </div>
      </div>

      {/* Personalization banner */}
      {project && (project.location_type === 'moshav' || project.location_type === 'kibbutz' || (project.notes && project.notes.includes('רמ"י'))) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-rounded text-amber-600 flex-shrink-0" style={{ fontSize: '1.1rem' }}>verified</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">הפרויקט שלך מותאם אישית</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {[
                project.location_type === 'moshav' ? 'מושב' : project.location_type === 'kibbutz' ? 'קיבוץ' : null,
                project.notes?.includes('רמ"י') ? 'קרקע רמ"י' : null,
                project.build_type === 'turnkey' ? 'קבלן מפתח' : project.build_type === 'self' ? 'ניהול עצמאי' : null,
              ].filter(Boolean).join(' · ')} — הצ'קליסט כולל משימות ייחודיות לסיטואציה שלך
            </p>
          </div>
        </div>
      )}

      {/* ── Smart Engine Panel ── */}
      <SmartEnginePanel
        action={smartAction}
        alerts={smartAlerts}
      />

      {/* ── Row 1: Budget + Timeline ── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">תקציב</p>
          <Link href={`/projects/${project.id}/budget`} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">פרטים מלאים ←</Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">תקציב כולל</p>
            <p className="text-base font-bold text-gray-900">{totalBudget > 0 ? formatNIS(totalBudget) : '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">הוצאות בפועל</p>
            <p className={cn('text-base font-bold', budgetOverrun ? 'text-red-600' : 'text-gray-900')}>{formatNIS(actualCost)}</p>
          </div>
          <div className="bg-indigo-50 rounded-xl p-3">
            <p className="text-xs text-indigo-400 mb-1">הצעות מחיר</p>
            <p className="text-base font-bold text-indigo-700">{formatNIS(approvedQuotesTotal)}</p>
            <p className="text-[10px] text-indigo-300 mt-0.5">{(project.quotes ?? []).filter(q => q.status === 'approved').length} מאושרות</p>
          </div>
          <div className={cn('rounded-xl p-3', actualCost <= totalBudget || totalBudget === 0 ? 'bg-emerald-50' : 'bg-red-50')}>
            <p className="text-xs text-gray-400 mb-1">נותר</p>
            <p className={cn('text-base font-bold', actualCost <= totalBudget || totalBudget === 0 ? 'text-emerald-600' : 'text-red-600')}>
              {totalBudget > 0 ? formatNIS(Math.max(0, totalBudget - actualCost)) : '—'}
            </p>
          </div>
        </div>

        {totalBudget > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>ניצול תקציב</span>
              <span className={cn('font-semibold', budgetUsedPct > 90 ? 'text-red-600' : budgetUsedPct > 70 ? 'text-amber-600' : 'text-emerald-600')}>
                {budgetUsedPct}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', budgetUsedPct > 90 ? 'bg-red-500' : budgetUsedPct > 70 ? 'bg-amber-500' : 'bg-indigo-500')}
                style={{ width: `${Math.min(budgetUsedPct, 100)}%` }} />
            </div>
          </div>
        )}

        {/* Timeline inline */}
        <div className="border-t border-gray-50 pt-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">לוח זמנים</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {localStages.slice(0, 4).map(stage => {
              const tasks = stage.tasks ?? []
              const pct = tasks.length > 0 ? Math.round((tasks.filter(t => t.is_completed).length / tasks.length) * 100) : 0
              const isLate = stage.end_date && new Date(stage.end_date) < new Date() && stage.status !== 'completed'
              const isEditing = editingStageId === stage.id
              const missingDate = !stage.start_date || !stage.end_date
              return (
                <div key={stage.id} className={cn(
                  'rounded-xl border transition-all',
                  stage.status === 'completed' ? 'bg-emerald-50 border-emerald-100' :
                  isLate ? 'bg-red-50 border-red-100' :
                  stage.status === 'in_progress' ? 'bg-indigo-50 border-indigo-100' :
                  'bg-gray-50 border-gray-100',
                  isEditing && 'ring-2 ring-indigo-300'
                )}>
                  {/* Card header — click to toggle edit */}
                  <button
                    onClick={() => setEditingStageId(isEditing ? null : stage.id)}
                    className="w-full text-right p-3"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className={cn('text-xs font-semibold',
                        stage.status === 'completed' ? 'text-emerald-700' :
                        isLate ? 'text-red-600' :
                        stage.status === 'in_progress' ? 'text-indigo-700' : 'text-gray-400'
                      )}>{stage.name}</p>
                      {missingDate && (
                        <span className="material-symbols-rounded text-amber-400 flex-shrink-0" style={{ fontSize: '0.9rem' }}>edit_calendar</span>
                      )}
                    </div>
                    <p className={cn('text-base font-bold mt-0.5',
                      stage.status === 'completed' ? 'text-emerald-600' :
                      isLate ? 'text-red-600' :
                      stage.status === 'in_progress' ? 'text-indigo-600' : 'text-gray-300'
                    )}>{pct}%</p>
                    {stage.start_date || stage.end_date ? (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {stage.start_date ? new Date(stage.start_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) : '?'}
                        {' — '}
                        {stage.end_date ? new Date(stage.end_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) : '?'}
                      </p>
                    ) : (
                      <p className="text-[10px] text-amber-500 mt-0.5 font-medium">הגדר תאריכים</p>
                    )}
                  </button>

                  {/* Inline date editor */}
                  {isEditing && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-2">
                      <div>
                        <label className="text-[10px] text-gray-400 font-medium block mb-0.5">התחלה</label>
                        <input
                          type="date"
                          defaultValue={stage.start_date ?? ''}
                          onBlur={e => saveStageDate(stage.id, 'start_date', e.target.value)}
                          className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 font-medium block mb-0.5">סיום</label>
                        <input
                          type="date"
                          defaultValue={stage.end_date ?? ''}
                          onBlur={e => saveStageDate(stage.id, 'end_date', e.target.value)}
                          className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
                        />
                      </div>
                      <button
                        onClick={() => setEditingStageId(null)}
                        className="w-full text-[10px] text-indigo-600 font-semibold py-1 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        ✓ שמור
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Row 2: Quick Checklist + Community ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Quick Checklist */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div>
              <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">מה עכשיו?</p>
              {currentStage && <p className="text-sm font-semibold text-gray-800 mt-0.5">{currentStage.name}</p>}
            </div>
            <Link href={`/projects/${project.id}/stages`} className="text-xs text-indigo-500 font-medium hover:text-indigo-700">
              כל המשימות ←
            </Link>
          </div>

          {nextTasks.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-rounded text-emerald-300 block mb-2" style={{ fontSize: '2rem' }}>check_circle</span>
              <p className="text-sm text-gray-500">כל משימות השלב הנוכחי הושלמו!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {nextTasks.map(task => {
                const isCompleting = completingTask?.id === task.id
                const localTask = localTasks.find(t => t.id === task.id) ?? task
                return (
                  <div key={task.id}>
                    <div className="flex items-start gap-3 px-5 py-3.5">
                      <button
                        onClick={() => handleToggleTask(localTask)}
                        className={cn(
                          'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                          localTask.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-indigo-400'
                        )}>
                        {localTask.is_completed && <span className="material-symbols-rounded text-white filled" style={{ fontSize: '0.75rem' }}>check</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium', localTask.is_completed ? 'text-gray-400 line-through' : 'text-gray-900')}>{task.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {task.priority === 'critical' && <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 rounded">קריטי</span>}
                          {task.priority === 'high' && <span className="text-xs font-bold text-orange-600 bg-orange-50 px-1.5 rounded">גבוה</span>}
                          {task.planned_cost && <span className="text-xs text-gray-400">עלות: {formatNIS(task.planned_cost)}</span>}
                        </div>
                      </div>
                      <Link href="/community" className="text-xs text-gray-300 hover:text-indigo-500 transition-colors flex-shrink-0 mt-0.5 flex items-center gap-0.5">
                        <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>forum</span>
                      </Link>
                    </div>
                    {/* Cost entry when completing */}
                    {isCompleting && (
                      <div className="bg-indigo-50 px-5 py-3 border-t border-indigo-100">
                        <p className="text-xs font-semibold text-indigo-700 mb-2">כמה שולם בפועל?</p>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">₪</span>
                            <input
                              type="number"
                              value={taskCostMap[task.id] ?? ''}
                              onChange={e => setTaskCostMap(m => ({ ...m, [task.id]: e.target.value }))}
                              placeholder={task.planned_cost?.toString() ?? '0'}
                              className="w-full pl-2 pr-7 py-1.5 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white"
                            />
                          </div>
                          <button onClick={() => doToggle(task, true, taskCostMap[task.id] ? parseFloat(taskCostMap[task.id]) : (task.planned_cost ?? null))}
                            className="px-3 py-1.5 rounded-lg text-white text-xs font-medium" style={{ backgroundColor: '#002045' }}>
                            אשר
                          </button>
                          <button onClick={() => setCompletingTask(null)} className="text-xs text-gray-400 hover:text-gray-600">ביטול</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Community */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">קהילה – שאלות חמות</p>
            <Link href="/community" className="text-xs text-indigo-500 font-medium hover:text-indigo-700">לקהילה ←</Link>
          </div>
          {communityPosts.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-rounded text-gray-200 block mb-2" style={{ fontSize: '2rem' }}>forum</span>
              <p className="text-sm text-gray-400">הקהילה עוד ריקה</p>
              <Link href="/community" className="mt-2 inline-block text-xs text-indigo-500 font-medium">היה הראשון לשאול →</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {communityPosts.map(post => {
                const typeIcon = post.post_type === 'tip' ? 'lightbulb' : post.post_type === 'problem' ? 'warning' : 'help'
                const typeColor = post.post_type === 'tip' ? 'text-emerald-500' : post.post_type === 'problem' ? 'text-orange-500' : 'text-blue-500'
                return (
                  <Link key={post.id} href="/community" className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span className={cn('material-symbols-rounded filled flex-shrink-0 mt-0.5', typeColor)} style={{ fontSize: '1rem' }}>{typeIcon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-snug line-clamp-2">{post.title}</p>
                      {post.stage_tag && <span className="text-xs text-gray-400">{post.stage_tag}</span>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-300 flex-shrink-0">
                      <span className="material-symbols-rounded" style={{ fontSize: '0.8rem' }}>favorite</span>
                      {post.likes}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
          <div className="px-5 py-3 border-t border-gray-50">
            <Link href="/community" className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
              <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>add</span>
              שאל את הקהילה
            </Link>
          </div>
        </div>
      </div>

      {/* ── Row 3: Recent Documents + Smart Tips ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Recent Documents */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">מסמכים אחרונים</p>
            <Link href={`/projects/${project.id}/documents`} className="text-xs text-indigo-500 font-medium hover:text-indigo-700">כל המסמכים ←</Link>
          </div>
          {recentDocs.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-rounded text-gray-200 block mb-2" style={{ fontSize: '2rem' }}>folder_open</span>
              <p className="text-sm text-gray-400">אין מסמכים עדיין</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="material-symbols-rounded text-gray-300" style={{ fontSize: '1.1rem' }}>
                    {docCatIcons[doc.category] ?? 'folder'}
                  </span>
                  <p className="text-sm text-gray-700 flex-1 truncate">{doc.name}</p>
                  <p className="text-xs text-gray-300 flex-shrink-0">{new Date(doc.created_at).toLocaleDateString('he-IL')}</p>
                </div>
              ))}
            </div>
          )}
          <div className="px-5 py-3 border-t border-gray-50">
            <Link href={`/projects/${project.id}/documents`} className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
              <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>upload</span>
              העלה מסמך
            </Link>
          </div>
        </div>

        {/* Smart Tips */}
        <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #002045 0%, #0a3a6b 100%)' }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-rounded text-indigo-300 filled" style={{ fontSize: '1rem' }}>auto_awesome</span>
            <p className="text-xs font-bold tracking-widest text-indigo-300 uppercase">המלצות חכמות</p>
          </div>
          <div className="space-y-3">
            {getSmartTips(riskScore, currentStage?.name, progress, budgetUsedPct, criticalPending, overdueTasks).map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5 bg-white/8 rounded-xl p-3">
                <span className="material-symbols-rounded text-indigo-300 flex-shrink-0 mt-0.5" style={{ fontSize: '0.9rem' }}>{tip.icon}</span>
                <p className="text-xs text-white/80 leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>
          <Link href={`/projects/${project.id}/stages`}
            className="mt-4 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-white/20 text-xs text-white/70 hover:bg-white/10 transition-colors">
            <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>checklist</span>
            ראה את כל הצ'קליסט
          </Link>
        </div>
      </div>
    </div>
  )
}

function AlertRow({ icon, color, text }: { icon: string; color: 'red' | 'amber' | 'emerald'; text: string }) {
  const colors = {
    red: 'bg-red-50 text-red-600 border-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  }
  return (
    <div className={cn('flex items-start gap-2 rounded-xl px-3 py-2.5 border text-xs', colors[color])}>
      <span className="material-symbols-rounded flex-shrink-0 mt-0.5" style={{ fontSize: '0.9rem' }}>{icon}</span>
      <span className="leading-relaxed">{text}</span>
    </div>
  )
}

function getSmartTips(risk: string, stageName?: string, progress?: number, budgetPct?: number, criticalPending?: number, overdue?: number) {
  const tips = []
  if (criticalPending && criticalPending > 0)
    tips.push({ icon: 'priority_high', text: `יש לך ${criticalPending} משימות קריטיות שממתינות. התמקד בהן לפני שתמשיך.` })
  if (overdue && overdue > 0)
    tips.push({ icon: 'schedule', text: `${overdue} משימות עברו את תאריך היעד. בדוק אם צריך לעדכן את לוח הזמנים.` })
  if (budgetPct && budgetPct > 70)
    tips.push({ icon: 'payments', text: `ניצלת ${budgetPct}% מהתקציב. מומלץ לבדוק הצעות מחיר לשלבים הבאים.` })
  if (stageName === 'קרקע')
    tips.push({ icon: 'gavel', text: 'בשלב הקרקע חשוב לוודא היתרים ובדיקת גאוטכניקה לפני כל תשלום.' })
  if (stageName === 'היתר בנייה')
    tips.push({ icon: 'description', text: 'תהליך ההיתר לוקח 3-18 חודשים. עקוב אחרי הגשות לועדה.' })
  if (stageName === 'שלד')
    tips.push({ icon: 'engineering', text: 'בשלב השלד מומלץ מפקח מטעמך שיבדוק את עבודת הקבלן.' })
  if (progress && progress > 80)
    tips.push({ icon: 'celebration', text: 'אתה בשלבים הסופיים! הכן את חיבורי החשמל, מים וגז לפני גמר הפנים.' })
  if (tips.length === 0)
    tips.push({ icon: 'lightbulb', text: 'תמשיך לסמן משימות כהושלמות. ככל שתתקדם, הדשבורד יציג המלצות מותאמות.' })
  return tips.slice(0, 3)
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
function AdminDashboard({ projects }: { projects: ProjectWithStages[] }) {
  const supabase = createClient()
  const [clientUsers, setClientUsers] = useState<Record<string, { full_name: string | null; email: string | null; phone: string | null }>>({})

  useEffect(() => {
    const clientIds = projects.map(p => p.client_id).filter(Boolean) as string[]
    if (!clientIds.length) return
    supabase.from('users').select('id, full_name, email, phone').in('id', clientIds)
      .then(({ data }) => {
        if (data) setClientUsers(Object.fromEntries(data.map(u => [u.id, u])))
      })
  }, [projects])

  // Derived data
  const activeProjects   = projects.filter(p => p.status === 'active')
  const completedProjects = projects.filter(p => p.status === 'completed')
  const withClient       = projects.filter(p => p.client_id)
  const leadsProjects    = projects.filter(p => !p.client_id)   // no client yet = lead
  const conversionRate   = projects.length > 0 ? Math.round((withClient.length / projects.length) * 100) : 0

  // Financials
  const totalBudgetManaged = projects.reduce((s, p) => s + (p.total_budget ?? 0), 0)
  const totalApprovedQuotes = projects.reduce((s, p) =>
    s + (p.quotes ?? []).filter(q => q.status === 'approved').reduce((ss, q) => ss + (q.amount ?? 0), 0), 0)
  const totalActualSpend = projects.reduce((s, p) => {
    const stages = p.stages ?? []
    const tasksCost = stages.flatMap(s => s.tasks ?? []).reduce((ss, t) => ss + (t.actual_cost ?? 0), 0)
    return s + Math.max(tasksCost, (p.quotes ?? []).filter(q => q.status === 'approved').reduce((ss, q) => ss + (q.amount ?? 0), 0))
  }, 0)

  const today = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">לוח בקרה</h1>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>
        <Link href="/projects/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#002045' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add</span>
          פרויקט חדש
        </Link>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon="group" label="לקוחות פעילים" value={withClient.length} sub={`${projects.length} פרויקטים`} color="indigo" />
        <KpiCard icon="track_changes" label="המרה" value={`${conversionRate}%`} sub={`${leadsProjects.length} לידים פתוחים`} color="violet" />
        <KpiCard icon="payments" label="תקציב מנוהל" value={formatNIS(totalBudgetManaged)} sub={`${formatNIS(totalApprovedQuotes)} הצעות מאושרות`} color="emerald" />
        <KpiCard icon="check_circle" label="פרויקטים פעילים" value={activeProjects.length} sub={`${completedProjects.length} הושלמו`} color="blue" />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Clients list — 2/3 width */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">לקוחות</h2>
            <span className="text-xs text-gray-400">{withClient.length} לקוחות</span>
          </div>

          {withClient.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center shadow-sm">
              <span className="material-symbols-rounded text-gray-200 block mb-2" style={{ fontSize: '2.5rem' }}>group</span>
              <p className="text-gray-400 text-sm">אין לקוחות עדיין — הזמן לקוחות מעמוד ההגדרות</p>
            </div>
          ) : (
            <div className="space-y-2">
              {withClient.map(p => {
                const client = p.client_id ? clientUsers[p.client_id] : null
                const stages = p.stages ?? []
                const allTasks = stages.flatMap(s => s.tasks ?? [])
                const progress = allTasks.length > 0
                  ? Math.round((allTasks.filter(t => t.is_completed).length / allTasks.length) * 100) : 0
                const currentStage = stages.find(s => s.status === 'in_progress') ?? stages.find(s => s.status === 'pending')
                const approvedQ = (p.quotes ?? []).filter(q => q.status === 'approved').reduce((s, q) => s + (q.amount ?? 0), 0)
                const statusColors: Record<string, string> = {
                  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                  completed: 'bg-gray-50 text-gray-500 border-gray-100',
                  on_hold: 'bg-amber-50 text-amber-700 border-amber-100',
                }
                const statusLabels: Record<string, string> = { active: 'פעיל', completed: 'הושלם', on_hold: 'מושהה' }

                return (
                  <Link key={p.id} href={`/projects/${p.id}/stages`}
                    className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 text-indigo-600 font-bold text-base">
                      {(client?.full_name ?? p.name)?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{client?.full_name ?? 'לקוח'}</p>
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', statusColors[p.status ?? 'active'])}>
                          {statusLabels[p.status ?? 'active']}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{p.name}{p.address ? ` · ${p.address}` : ''}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {currentStage && (
                          <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
                            {currentStage.name}
                          </span>
                        )}
                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                          <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400">{progress}%</span>
                      </div>
                    </div>
                    {/* Financials */}
                    <div className="text-left flex-shrink-0 hidden sm:block">
                      {p.total_budget ? (
                        <>
                          <p className="text-xs font-bold text-gray-800">{formatNIS(p.total_budget)}</p>
                          <p className="text-[10px] text-gray-400">תקציב</p>
                          {approvedQ > 0 && <p className="text-[10px] text-emerald-600 mt-0.5">{formatNIS(approvedQ)} הצעות</p>}
                        </>
                      ) : (
                        <p className="text-xs text-gray-300">ללא תקציב</p>
                      )}
                    </div>
                    <span className="material-symbols-rounded text-gray-200 group-hover:text-indigo-400 transition-colors flex-shrink-0"
                      style={{ fontSize: '1rem' }}>chevron_left</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Right column — funnel + leads */}
        <div className="space-y-4">

          {/* Conversion funnel */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">משפך המרה</h2>
            <div className="space-y-2">
              {[
                { label: 'פרויקטים', count: projects.length, color: 'bg-gray-100 text-gray-600', pct: 100 },
                { label: 'עם לקוח', count: withClient.length, color: 'bg-indigo-50 text-indigo-700', pct: conversionRate },
                { label: 'פעילים', count: activeProjects.length, color: 'bg-blue-50 text-blue-700', pct: projects.length > 0 ? Math.round(activeProjects.length / projects.length * 100) : 0 },
                { label: 'הושלמו', count: completedProjects.length, color: 'bg-emerald-50 text-emerald-700', pct: projects.length > 0 ? Math.round(completedProjects.length / projects.length * 100) : 0 },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-16 text-left">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', row.color)}>{row.count}</span>
                  </div>
                  <div className="flex-1 h-2 bg-gray-50 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${row.pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 w-14 text-right">{row.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-400">שיעור המרה</p>
              <p className="text-lg font-bold text-indigo-600">{conversionRate}%</p>
            </div>
          </div>

          {/* Leads */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">לידים</h2>
              <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-semibold border border-amber-100">
                {leadsProjects.length}
              </span>
            </div>
            {leadsProjects.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-4">כל הפרויקטים מחוברים ללקוח</p>
            ) : (
              <div className="space-y-2">
                {leadsProjects.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                    <span className="material-symbols-rounded text-amber-400 flex-shrink-0" style={{ fontSize: '1rem' }}>home_work</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">{p.address ?? 'ללא כתובת'}</p>
                    </div>
                    <Link href="/settings"
                      className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap">
                      הזמן לקוח
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Finances — future */}
          <div className="rounded-2xl p-5 border border-dashed border-gray-200 bg-gray-50/50">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-rounded text-gray-300" style={{ fontSize: '1.1rem' }}>account_balance</span>
              <h2 className="text-xs font-bold text-gray-300 uppercase tracking-widest">כספים</h2>
              <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">בקרוב</span>
            </div>
            <div className="space-y-2 opacity-50 pointer-events-none">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">תקציב מנוהל</span>
                <span className="font-semibold text-gray-600">{formatNIS(totalBudgetManaged)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">הצעות מאושרות</span>
                <span className="font-semibold text-gray-600">{formatNIS(totalApprovedQuotes)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">שולם בפועל</span>
                <span className="font-semibold text-gray-600">{formatNIS(totalActualSpend)}</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-300 mt-3">חיובים, הכנסות ודוחות — בגרסה הבאה</p>
          </div>

        </div>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub: string; color: string }) {
  const colorMap: Record<string, { bg: string; icon: string; val: string }> = {
    indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-500',  val: 'text-indigo-700'  },
    violet:  { bg: 'bg-violet-50',  icon: 'text-violet-500',  val: 'text-violet-700'  },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', val: 'text-emerald-700' },
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-500',    val: 'text-blue-700'    },
  }
  const c = colorMap[color] ?? colorMap.indigo
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', c.bg)}>
        <span className={cn('material-symbols-rounded', c.icon)} style={{ fontSize: '1.1rem' }}>{icon}</span>
      </div>
      <p className={cn('text-xl font-bold', c.val)}>{value}</p>
      <p className="text-xs font-medium text-gray-600 mt-0.5">{label}</p>
      <p className="text-[10px] text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

function EmptyDashboard({ role }: { role: string | null }) {
  return (
    <div className="max-w-md mx-auto text-center py-20 animate-fade-in">
      <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <span className="material-symbols-rounded text-indigo-400" style={{ fontSize: '2.5rem' }}>home_work</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">אין פרויקטים עדיין</h2>
      <p className="text-gray-500 mb-6">
        {role === 'admin' ? 'צור את הפרויקט הראשון שלך' : 'המנהל שלך עוד לא יצר פרויקט עבורך'}
      </p>
      {role === 'admin' && (
        <Link href="/projects/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold shadow-sm" style={{ backgroundColor: '#002045' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>add_circle</span>
          צור פרויקט חדש
        </Link>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-24 bg-gray-200 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4"><div className="h-40 bg-gray-200 rounded-2xl" /><div className="h-40 bg-gray-200 rounded-2xl" /></div>
      <div className="grid grid-cols-2 gap-4"><div className="h-48 bg-gray-200 rounded-2xl" /><div className="h-48 bg-gray-200 rounded-2xl" /></div>
    </div>
  )
}
