'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { ProgressRing } from '@/components/shared/ProgressRing'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import Link from 'next/link'
import type { Project, Stage, Task } from '@/lib/types/database.types'

interface ProjectWithData extends Project {
  stages?: (Stage & { tasks?: Task[] })[]
}

export default function ProjectsPage() {
  const { user, role } = useAuth()
  const [projects, setProjects] = useState<ProjectWithData[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('admin_id', user!.id)
        .order('created_at', { ascending: false })
      if (!data) { setLoading(false); return }

      const full = await Promise.all(
        data.map(async (p) => {
          const { data: stages } = await supabase
            .from('stages')
            .select('*, tasks(*)')
            .eq('project_id', p.id)
            .order('sort_order')
          return { ...p, stages: stages ?? [] }
        })
      )
      setProjects(full)
      setLoading(false)
    }
    load()
  }, [user])

  if (role && role !== 'admin') {
    return <div className="text-center py-20 text-gray-500">אין לך גישה לעמוד זה</div>
  }

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}</div>

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">פרויקטים</h1>
          <p className="text-gray-500 mt-1">{projects.length} פרויקטים בסך הכל</p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-semibold shadow-sm"
        >
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add</span>
          פרויקט חדש
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-rounded text-indigo-400" style={{ fontSize: '2rem' }}>home_work</span>
          </div>
          <p className="text-gray-500 mb-4">אין פרויקטים עדיין</p>
          <Link href="/projects/new" className="text-indigo-600 font-medium">צור פרויקט ראשון</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => {
            const stages = p.stages ?? []
            const allTasks = stages.flatMap(s => s.tasks ?? [])
            const completedTasks = allTasks.filter(t => t.is_completed).length
            const progress = allTasks.length > 0
              ? Math.round((completedTasks / allTasks.length) * 100)
              : 0
            const currentStage = stages.find(s => s.status === 'in_progress') ?? stages[0]

            return (
              <Link key={p.id} href={`/projects/${p.id}/stages`}>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                      {p.address && <p className="text-sm text-gray-400 mt-0.5 truncate">{p.address}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${
                      p.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      p.status === 'on_hold' ? 'bg-amber-100 text-amber-700' :
                      'bg-indigo-100 text-indigo-700'
                    }`}>
                      {p.status === 'completed' ? 'הושלם' : p.status === 'on_hold' ? 'מושהה' : 'פעיל'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <ProgressRing progress={progress} size={52} strokeWidth={4} color="#6366f1" label={`${progress}%`} />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>התקדמות</span>
                        <span>{completedTasks}/{allTasks.length} משימות</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                      {currentStage && (
                        <p className="text-xs text-gray-400 mt-1">שלב: {currentStage.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <div className="text-xs text-gray-400">
                      {p.total_budget ? (
                        <span>תקציב: <CurrencyDisplay amount={p.total_budget} size="sm" /></span>
                      ) : (
                        <span>ללא תקציב</span>
                      )}
                    </div>
                    <span className="material-symbols-rounded text-gray-300" style={{ fontSize: '1.1rem' }}>arrow_back_ios</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
