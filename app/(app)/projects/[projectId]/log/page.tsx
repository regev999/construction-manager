'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const LOG_TYPE_CONFIG = {
  update:     { label: 'עדכון שוטף',   icon: 'edit_note',     color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200'    },
  inspection: { label: 'ביקורת',        icon: 'fact_check',    color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200' },
  issue:      { label: 'בעיה / ליקוי', icon: 'error',         color: 'text-red-700',     bg: 'bg-red-50 border-red-200'      },
  payment:    { label: 'תשלום',         icon: 'payments',      color: 'text-green-700',   bg: 'bg-green-50 border-green-200'  },
  delay:      { label: 'עיכוב',         icon: 'schedule',      color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200'},
  addition:   { label: 'תוספת / שינוי', icon: 'add_circle',    color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200'  },
  completion: { label: 'הושלם',         icon: 'check_circle',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200'},
  note:       { label: 'הערה',          icon: 'sticky_note_2', color: 'text-gray-700',    bg: 'bg-gray-50 border-gray-200'    },
} as const

interface Log {
  id: string
  project_id: string
  user_id: string | null
  contractor_id: string | null
  stage_id: string | null
  task_id: string | null
  type: keyof typeof LOG_TYPE_CONFIG
  title: string
  description: string | null
  status: 'normal' | 'warning' | 'critical'
  source: 'manual' | 'auto'
  created_at: string
  contractor?: { name: string } | null
  stage?: { name: string } | null
}

interface LogForm {
  type: string
  stage_id: string
  contractor_id: string
  title: string
  description: string
  status: string
}

const EMPTY_FORM: LogForm = {
  type: 'update',
  stage_id: '',
  contractor_id: '',
  title: '',
  description: '',
  status: 'normal',
}

function relativeTime(dateStr: string): string {
  const now = new Date()
  const d = new Date(dateStr)
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'עכשיו'
  if (mins < 60) return `לפני ${mins} דק'`
  if (hours < 24) return `לפני ${hours} שע'`
  if (days === 1) return 'אתמול'
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'היום'
  if (d.toDateString() === yesterday.toDateString()) return 'אתמול'
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function LogPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { user } = useAuth()
  const supabase = createClient()

  const [logs, setLogs]               = useState<Log[]>([])
  const [stages, setStages]           = useState<{ id: string; name: string }[]>([])
  const [contractors, setContractors] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [form, setForm]               = useState<LogForm>(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [filterType, setFilterType]   = useState('all')
  const [filterStage, setFilterStage] = useState('all')
  const [issuesOnly, setIssuesOnly]   = useState(false)

  useEffect(() => { load() }, [projectId])

  async function load() {
    setLoading(true)
    const [logsRes, stagesRes, contractorsRes] = await Promise.all([
      supabase
        .from('logs')
        .select('*, contractor:contractors(name), stage:stages(name)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase.from('stages').select('id, name').eq('project_id', projectId),
      supabase.from('contractors').select('id, name').eq('project_id', projectId),
    ])
    if (logsRes.data) setLogs(logsRes.data as Log[])
    if (stagesRes.data) setStages(stagesRes.data)
    if (contractorsRes.data) setContractors(contractorsRes.data)
    setLoading(false)
  }

  async function saveLog() {
    if (!form.title.trim() || !user) return
    setSaving(true)
    const payload = {
      project_id: projectId,
      user_id: user.id === 'dev-user' ? null : user.id,
      stage_id: form.stage_id || null,
      contractor_id: form.contractor_id || null,
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      source: 'manual' as const,
    }
    const { data, error } = await supabase.from('logs').insert(payload).select('*, contractor:contractors(name), stage:stages(name)').single()
    if (error) {
      toast.error('שגיאה בשמירת הרשומה')
      setSaving(false)
      return
    }
    if (data) setLogs(prev => [data as Log, ...prev])
    toast.success('רשומה נוספה בהצלחה')
    setSaving(false)
    setShowModal(false)
    setForm(EMPTY_FORM)
  }

  // Filtering
  const filtered = logs.filter(log => {
    if (filterType !== 'all' && log.type !== filterType) return false
    if (filterStage !== 'all' && log.stage_id !== filterStage) return false
    if (issuesOnly && log.status === 'normal' && log.type !== 'issue') return false
    return true
  })

  // Group by day
  const groups: { label: string; logs: Log[] }[] = []
  for (const log of filtered) {
    const label = dayLabel(log.created_at)
    const existing = groups.find(g => g.label === label)
    if (existing) {
      existing.logs.push(log)
    } else {
      groups.push({ label, logs: [log] })
    }
  }

  if (loading) return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">יומן עבודה</h1>
          <p className="text-sm text-gray-400 mt-0.5">מעקב פעילות ואירועים בפרויקט</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#002045' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add</span>
          + הוסף עדכון
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        {/* Type filter */}
        <div className="flex-1 min-w-[160px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">סוג</label>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white text-right">
            <option value="all">הכל</option>
            {Object.entries(LOG_TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Stage filter */}
        {stages.length > 0 && (
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">שלב</label>
            <select
              value={filterStage}
              onChange={e => setFilterStage(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white text-right">
              <option value="all">כל השלבים</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Issues only toggle */}
        <div className="flex items-center gap-2 pt-5">
          <button
            onClick={() => setIssuesOnly(v => !v)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
              issuesOnly
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
            )}>
            <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>
              {issuesOnly ? 'error' : 'filter_alt'}
            </span>
            בעיות בלבד
          </button>
        </div>
      </div>

      {/* ── Timeline ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 border border-gray-100 shadow-sm text-center">
          <span className="material-symbols-rounded text-gray-200 block mb-3" style={{ fontSize: '3rem' }}>event_note</span>
          <p className="text-gray-500 font-medium">אין פעילות עדיין</p>
          <p className="text-sm text-gray-400 mt-1">לחץ + הוסף עדכון להוסיף את הרשומה הראשונה.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-5 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 inline-flex items-center gap-2"
            style={{ backgroundColor: '#002045' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>add</span>
            הוסף עדכון ראשון
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.label}>
              {/* Day label */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{group.label}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Log cards */}
              <div className="space-y-2">
                {group.logs.map(log => {
                  const cfg = LOG_TYPE_CONFIG[log.type] ?? LOG_TYPE_CONFIG.note
                  const isCritical = log.status === 'critical'
                  const isWarning  = log.status === 'warning'
                  return (
                    <div
                      key={log.id}
                      className={cn(
                        'bg-white rounded-2xl border shadow-sm p-4 overflow-hidden',
                        isCritical ? 'border-l-4 border-red-400 border-gray-100'
                          : isWarning  ? 'border-l-4 border-orange-400 border-gray-100'
                          : 'border-gray-100'
                      )}>
                      {/* Top row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Type badge */}
                          <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border', cfg.bg, cfg.color)}>
                            <span className="material-symbols-rounded" style={{ fontSize: '0.75rem' }}>{cfg.icon}</span>
                            {cfg.label}
                          </span>

                          {/* Status badge */}
                          {isCritical && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
                              קריטי
                            </span>
                          )}
                          {isWarning && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700">
                              אזהרה
                            </span>
                          )}

                          {/* Auto badge */}
                          {log.source === 'auto' && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-400">
                              אוטומטי
                            </span>
                          )}
                        </div>

                        {/* Time */}
                        <span className="text-[10px] text-gray-400">{relativeTime(log.created_at)}</span>
                      </div>

                      {/* Title */}
                      <p className="font-semibold text-gray-900 text-sm mb-1">{log.title}</p>

                      {/* Description */}
                      {log.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{log.description}</p>
                      )}

                      {/* Bottom: stage + contractor */}
                      {(log.stage?.name || log.contractor?.name) && (
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50">
                          {log.stage?.name && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                              <span className="material-symbols-rounded" style={{ fontSize: '0.75rem' }}>layers</span>
                              {log.stage.name}
                            </span>
                          )}
                          {log.contractor?.name && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                              <span className="material-symbols-rounded" style={{ fontSize: '0.75rem' }}>engineering</span>
                              {log.contractor.name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════ ADD LOG MODAL ══════════════ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setForm(EMPTY_FORM) } }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl overflow-hidden">

            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">הוסף עדכון ליומן</h2>
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                <span className="material-symbols-rounded text-gray-400" style={{ fontSize: '1.2rem' }}>close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">

              {/* Type */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">סוג רשומה *</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-right">
                  {Object.entries(LOG_TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {/* Stage + Contractor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">שלב</label>
                  <select
                    value={form.stage_id}
                    onChange={e => setForm(f => ({ ...f, stage_id: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-right">
                    <option value="">ללא שלב</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">קבלן</label>
                  <select
                    value={form.contractor_id}
                    onChange={e => setForm(f => ({ ...f, contractor_id: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-right">
                    <option value="">ללא קבלן</option>
                    {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">כותרת *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="תיאור קצר של האירוע..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">פרטים</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="פרטים נוספים, הערות..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right resize-none" />
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">דרגת חומרה</label>
                <div className="flex gap-2">
                  {[
                    { value: 'normal',   label: 'רגיל',   color: 'bg-gray-50 border-gray-200 text-gray-600',       active: 'bg-gray-100 border-gray-400 text-gray-800'     },
                    { value: 'warning',  label: 'אזהרה',  color: 'bg-orange-50 border-orange-200 text-orange-600', active: 'bg-orange-100 border-orange-500 text-orange-800' },
                    { value: 'critical', label: 'קריטי',  color: 'bg-red-50 border-red-200 text-red-600',          active: 'bg-red-100 border-red-500 text-red-800'         },
                  ].map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, status: s.value }))}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-xs font-semibold border transition-all',
                        form.status === s.value ? s.active : s.color
                      )}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveLog}
                  disabled={saving || !form.title.trim()}
                  className={cn(
                    'flex-1 py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all',
                    (!form.title.trim() || saving) ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'
                  )}
                  style={{ backgroundColor: '#002045' }}>
                  {saving
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> שומר...</>
                    : <><span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>save</span> שמור רשומה</>
                  }
                </button>
                <button
                  onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                  disabled={saving}
                  className="px-5 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
