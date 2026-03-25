'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatNIS } from '@/components/shared/CurrencyDisplay'

interface Lead {
  id: string
  name: string
  phone: string | null
  email: string | null
  project_type: string | null
  location: string | null
  budget_estimate: number | null
  source: string | null
  status: string
  notes: string | null
  created_at: string
  converted_project_id: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  new:       { label: 'חדש',        color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',    dot: 'bg-blue-500'    },
  contacted: { label: 'נוצר קשר',   color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-500'   },
  meeting:   { label: 'פגישה',      color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500'  },
  proposal:  { label: 'הצעה נשלחה', color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500'  },
  converted: { label: 'הומר ✓',     color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  lost:      { label: 'אבוד',       color: 'text-gray-400',    bg: 'bg-gray-50 border-gray-200',     dot: 'bg-gray-300'    },
}

const PROJECT_TYPES: Record<string, string> = {
  new_build:   'בנייה חדשה',
  renovation:  'שיפוץ',
  addition:    'תוספת בנייה',
  commercial:  'מסחרי',
}

const SOURCES: Record<string, string> = {
  referral:  'המלצה',
  website:   'אתר',
  social:    'רשתות חברתיות',
  ad:        'פרסום',
  other:     'אחר',
}

const STATUSES = Object.keys(STATUS_CONFIG)

const EMPTY_FORM = {
  name: '', phone: '', email: '', project_type: 'new_build',
  location: '', budget_estimate: '', source: 'referral', notes: '', status: 'new',
}

export default function LeadsPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [leads, setLeads]           = useState<Lead[]>([])
  const [loading, setLoading]       = useState(true)
  const [filterStatus, setFilter]   = useState('all')
  const [search, setSearch]         = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [editingLead, setEditing]   = useState<Lead | null>(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [expandedId, setExpanded]   = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('leads').select('*')
      .order('created_at', { ascending: false })
    if (data) setLeads(data)
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(lead: Lead) {
    setEditing(lead)
    setForm({
      name: lead.name,
      phone: lead.phone ?? '',
      email: lead.email ?? '',
      project_type: lead.project_type ?? 'new_build',
      location: lead.location ?? '',
      budget_estimate: lead.budget_estimate?.toString() ?? '',
      source: lead.source ?? 'referral',
      notes: lead.notes ?? '',
      status: lead.status,
    })
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditing(null) }

  async function saveLead() {
    if (!form.name.trim() || !user) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      project_type: form.project_type || null,
      location: form.location || null,
      budget_estimate: form.budget_estimate ? parseFloat(form.budget_estimate) : null,
      source: form.source || null,
      notes: form.notes || null,
      status: form.status,
    }

    if (editingLead) {
      const { error } = await supabase.from('leads').update(payload).eq('id', editingLead.id)
      if (error) { toast.error('שגיאה בשמירה'); setSaving(false); return }
      setLeads(prev => prev.map(l => l.id === editingLead.id ? { ...l, ...payload } : l))
      toast.success('הליד עודכן')
    } else {
      const { data, error } = await supabase.from('leads')
        .insert({ ...payload, admin_id: user.id })
        .select().single()
      if (error) { toast.error('שגיאה ביצירת ליד'); setSaving(false); return }
      if (data) setLeads(prev => [data, ...prev])
      toast.success('ליד חדש נוצר!')
    }
    setSaving(false)
    closeForm()
  }

  async function updateStatus(id: string, status: string) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    const { error } = await supabase.from('leads').update({ status }).eq('id', id)
    if (error) toast.error('שגיאה בעדכון')
    else toast.success(status === 'converted' ? 'מזל טוב! ליד הומר ללקוח 🎉' : 'סטטוס עודכן')
  }

  async function deleteLead(id: string) {
    if (!confirm('למחוק ליד זה?')) return
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) { toast.error('שגיאה במחיקה'); return }
    setLeads(prev => prev.filter(l => l.id !== id))
    toast.success('הליד נמחק')
  }

  // Stats
  const total     = leads.length
  const converted = leads.filter(l => l.status === 'converted').length
  const active    = leads.filter(l => !['converted','lost'].includes(l.status)).length
  const convRate  = total > 0 ? Math.round(converted / total * 100) : 0
  const pipeline  = leads.filter(l => !['converted','lost'].includes(l.status))
    .reduce((s, l) => s + (l.budget_estimate ?? 0), 0)

  const filtered = leads.filter(l => {
    const matchStatus = filterStatus === 'all' || l.status === filterStatus
    const matchSearch = !search || l.name.includes(search) ||
      (l.phone ?? '').includes(search) || (l.location ?? '').includes(search)
    return matchStatus && matchSearch
  })

  if (loading) return (
    <div className="animate-pulse space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">לידים</h1>
          <p className="text-sm text-gray-400 mt-0.5">לקוחות פוטנציאלים ומעקב מכירות</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#002045' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add</span>
          ליד חדש
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: 'person_search',  label: 'סה"כ לידים',    value: total,            color: 'text-indigo-600 bg-indigo-50'  },
          { icon: 'autorenew',      label: 'פעילים',         value: active,           color: 'text-blue-600 bg-blue-50'      },
          { icon: 'check_circle',   label: 'הומרו',          value: `${converted} (${convRate}%)`, color: 'text-emerald-600 bg-emerald-50' },
          { icon: 'payments',       label: 'צפי הכנסות',     value: formatNIS(pipeline), color: 'text-violet-600 bg-violet-50'  },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-2', k.color.split(' ')[1])}>
              <span className={cn('material-symbols-rounded', k.color.split(' ')[0])} style={{ fontSize: '1.1rem' }}>{k.icon}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Pipeline funnel ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">משפך לידים</p>
        <div className="flex items-end gap-1.5 h-16">
          {STATUSES.filter(s => s !== 'lost').map(s => {
            const count = leads.filter(l => l.status === s).length
            const maxCount = Math.max(...STATUSES.map(ss => leads.filter(l => l.status === ss).length), 1)
            const pct = Math.round(count / maxCount * 100)
            const cfg = STATUS_CONFIG[s]
            return (
              <button key={s} onClick={() => setFilter(filterStatus === s ? 'all' : s)}
                className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-xs font-bold text-gray-600">{count}</span>
                <div className={cn('w-full rounded-t-lg transition-all', filterStatus === s ? cfg.dot : 'bg-gray-100 group-hover:bg-gray-200')}
                  style={{ height: `${Math.max(pct, 8)}%` }} />
                <span className="text-[9px] text-gray-400 text-center leading-tight">{cfg.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Filters + Search ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" style={{ fontSize: '1rem' }}>search</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, טלפון, מיקום..."
            className="w-full pr-9 pl-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 text-right bg-white" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilter('all')}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              filterStatus === 'all' ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}
            style={filterStatus === 'all' ? { backgroundColor: '#002045' } : {}}>
            הכל ({total})
          </button>
          {STATUSES.map(s => {
            const count = leads.filter(l => l.status === s).length
            if (!count && filterStatus !== s) return null
            const cfg = STATUS_CONFIG[s]
            return (
              <button key={s} onClick={() => setFilter(filterStatus === s ? 'all' : s)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  filterStatus === s ? `${cfg.bg} ${cfg.color}` : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100')}>
                {cfg.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Leads list ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 border border-gray-100 shadow-sm text-center">
          <span className="material-symbols-rounded text-gray-200 block mb-3" style={{ fontSize: '3rem' }}>person_search</span>
          <p className="text-gray-500 font-medium">{search || filterStatus !== 'all' ? 'לא נמצאו תוצאות' : 'אין לידים עדיין'}</p>
          {!search && filterStatus === 'all' && (
            <button onClick={openNew}
              className="mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 inline-flex items-center gap-2"
              style={{ backgroundColor: '#002045' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>add</span>
              הוסף ליד ראשון
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => {
            const cfg = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.new
            const isExpanded = expandedId === lead.id
            return (
              <div key={lead.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center flex-shrink-0 text-base">
                    {lead.name[0]?.toUpperCase()}
                  </div>
                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{lead.name}</p>
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                      {lead.project_type && (
                        <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                          {PROJECT_TYPES[lead.project_type] ?? lead.project_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {lead.phone && <span className="text-xs text-gray-400">📞 {lead.phone}</span>}
                      {lead.location && <span className="text-xs text-gray-400">📍 {lead.location}</span>}
                      {lead.budget_estimate && <span className="text-xs text-gray-400">💰 {formatNIS(lead.budget_estimate)}</span>}
                      <span className="text-xs text-gray-300">{new Date(lead.created_at).toLocaleDateString('he-IL')}</span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(lead)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                      <span className="material-symbols-rounded text-gray-400" style={{ fontSize: '1rem' }}>edit</span>
                    </button>
                    <button onClick={() => setExpanded(isExpanded ? null : lead.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                      <span className="material-symbols-rounded text-gray-400 transition-transform"
                        style={{ fontSize: '1rem', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                    </button>
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-gray-50 pt-4 space-y-4">
                    {/* Status pipeline */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">עדכן סטטוס</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {STATUSES.map(s => {
                          const c = STATUS_CONFIG[s]
                          return (
                            <button key={s} onClick={() => updateStatus(lead.id, s)}
                              className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                lead.status === s ? `${c.bg} ${c.color}` : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                              )}>
                              {c.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'מקור', value: SOURCES[lead.source ?? ''] ?? lead.source ?? '—' },
                        { label: 'סוג פרויקט', value: PROJECT_TYPES[lead.project_type ?? ''] ?? lead.project_type ?? '—' },
                        { label: 'תקציב משוער', value: lead.budget_estimate ? formatNIS(lead.budget_estimate) : '—' },
                        { label: 'מיקום', value: lead.location ?? '—' },
                      ].map(d => (
                        <div key={d.label} className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] text-gray-400 mb-0.5">{d.label}</p>
                          <p className="text-xs font-semibold text-gray-700">{d.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    {lead.notes && (
                      <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                        <p className="text-xs font-semibold text-amber-700 mb-1">📝 הערות</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{lead.notes}</p>
                      </div>
                    )}

                    {/* Delete */}
                    <div className="flex justify-end">
                      <button onClick={() => deleteLead(lead.id)}
                        className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors">
                        <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>delete</span>
                        מחק ליד
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════ LEAD FORM MODAL ══════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) closeForm() }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl overflow-hidden">

            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editingLead ? 'עריכת ליד' : 'ליד חדש'}</h2>
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                <span className="material-symbols-rounded text-gray-400" style={{ fontSize: '1.2rem' }}>close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Name */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">שם *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="שם מלא"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">טלפון</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="05X-XXXXXXX"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">אימייל</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-left" dir="ltr" />
                </div>
              </div>

              {/* Location + Budget */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">מיקום</label>
                  <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="עיר / ישוב"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">תקציב משוער (₪)</label>
                  <input type="number" value={form.budget_estimate} onChange={e => setForm(f => ({ ...f, budget_estimate: e.target.value }))}
                    placeholder="2000000"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                </div>
              </div>

              {/* Project type + Source */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">סוג פרויקט</label>
                  <select value={form.project_type} onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-right">
                    {Object.entries(PROJECT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">מקור</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-right">
                    {Object.entries(SOURCES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">סטטוס</label>
                <div className="flex gap-1.5 flex-wrap">
                  {STATUSES.map(s => {
                    const c = STATUS_CONFIG[s]
                    return (
                      <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                        className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                          form.status === s ? `${c.bg} ${c.color}` : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100')}>
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">הערות</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3} placeholder="הערות פנימיות, דרישות מיוחדות..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right resize-none" />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={saveLead} disabled={saving || !form.name.trim()}
                  className={cn('flex-1 py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all',
                    (!form.name.trim() || saving) ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90')}
                  style={{ backgroundColor: '#002045' }}>
                  {saving
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> שומר...</>
                    : <><span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>save</span> {editingLead ? 'שמור שינויים' : 'צור ליד'}</>
                  }
                </button>
                <button onClick={closeForm} disabled={saving}
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
