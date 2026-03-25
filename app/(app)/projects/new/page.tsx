'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { DEFAULT_STAGES } from '@/lib/data/construction-stages'

export default function NewProjectPage() {
  const { user, role } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    address: '',
    total_budget: '',
    start_date: '',
    target_end_date: '',
    notes: '',
  })

  if (role && role !== 'admin') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">אין לך הרשאה ליצור פרויקטים</p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)

    try {
      // 1. Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          admin_id: user.id,
          name: form.name,
          address: form.address || null,
          total_budget: form.total_budget ? Number(form.total_budget) : null,
          start_date: form.start_date || null,
          target_end_date: form.target_end_date || null,
          notes: form.notes || null,
          status: 'active',
        })
        .select()
        .single()

      if (projectError) throw projectError

      // 2. Create default stages + tasks
      for (const stageTemplate of DEFAULT_STAGES) {
        const { data: stage, error: stageError } = await supabase
          .from('stages')
          .insert({
            project_id: project.id,
            name: stageTemplate.name,
            sort_order: stageTemplate.sort_order,
            planned_cost: stageTemplate.planned_cost,
            status: stageTemplate.sort_order === 1 ? 'in_progress' : 'pending',
          })
          .select()
          .single()

        if (stageError) throw stageError

        // Create tasks for this stage
        const tasksToInsert = stageTemplate.tasks.map((task, idx) => ({
          stage_id: stage.id,
          name: task.name,
          description: task.description,
          priority: task.priority,
          planned_cost: task.planned_cost ?? null,
          why_important: task.why_important,
          what_if_skip: task.what_if_skip,
          pro_tip: task.pro_tip,
          is_required: task.is_required,
          is_completed: false,
          sort_order: idx,
        }))

        const { error: tasksError } = await supabase.from('tasks').insert(tasksToInsert)
        if (tasksError) throw tasksError
      }

      toast.success('הפרויקט נוצר בהצלחה!')
      router.push(`/projects/${project.id}/stages`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה ביצירת הפרויקט')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">פרויקט חדש</h1>
        <p className="text-gray-500 mt-1">פרטי פרויקט הבנייה</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label>שם הפרויקט *</Label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder='למשל: בית משפחת לוי, רחוב הרצל 5'
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label>כתובת</Label>
            <Input
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="עיר, רחוב ומספר"
              className="mt-1"
            />
          </div>

          <div>
            <Label>תקציב כולל (₪)</Label>
            <Input
              type="number"
              value={form.total_budget}
              onChange={e => setForm(f => ({ ...f, total_budget: e.target.value }))}
              placeholder="1,200,000"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>תאריך התחלה</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>תאריך יעד לסיום</Label>
              <Input
                type="date"
                value={form.target_end_date}
                onChange={e => setForm(f => ({ ...f, target_end_date: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>הערות</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="מידע נוסף על הפרויקט..."
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-700">
            <div className="flex items-start gap-2">
              <span className="material-symbols-rounded mt-0.5" style={{ fontSize: '1rem' }}>info</span>
              <p>המערכת תיצור אוטומטית את 4 שלבי הבנייה הסטנדרטיים עם כל המשימות, העלויות המשוערות והטיפים המקצועיים.</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1"
            >
              ביטול
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 gradient-primary text-white border-0"
            >
              {loading ? 'יוצר...' : 'צור פרויקט'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
