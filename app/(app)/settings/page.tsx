'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useVatRate } from '@/lib/hooks/useVatRate'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { calculatePrices } from '@/lib/utils/price-calculator'

const STAGE_TO_PHASE: Record<string, string> = {
  'קרקע':       'קרקע',
  'היתר בנייה': 'היתר',
  'שלד':        'שלד',
  'גמר':        'גמר',
}

interface Project {
  id: string
  name: string
  address: string | null
  total_budget: number | null
  location_type: string | null
  build_type: string | null
  construction_type: string | null
  start_date: string | null
  target_end_date: string | null
  notes: string | null
  client_id: string | null
  house_size: number | null
  has_basement: boolean
  basement_size: number | null
  finish_level: string | null
}

const LOCATION_TYPES = [
  { value: 'city',    label: 'עיר',         icon: 'location_city' },
  { value: 'moshav',  label: 'מושב',         icon: 'cottage' },
  { value: 'kibbutz', label: 'קיבוץ',        icon: 'park' },
  { value: 'other',   label: 'אחר',          icon: 'place' },
]

const BUILD_TYPES = [
  { value: 'self',    label: 'בניה עצמית',   icon: 'construction', desc: 'אתה מנהל את הפרויקט ישירות' },
  { value: 'turnkey', label: 'מפתח בידיים',  icon: 'key',          desc: 'קבלן ראשי אחראי על הכל' },
]

const CONSTRUCTION_TYPES = [
  { value: 'concrete', label: 'בנייה רגילה', icon: 'foundation',    desc: 'בטון ובלוקים — הסטנדרט הנפוץ', color: 'text-slate-600' },
  { value: 'light',    label: 'בנייה קלה',   icon: 'home_storage',  desc: 'פלדה / עץ / מודולרי — עלות נמוכה יותר', color: 'text-emerald-600' },
]

function extractPlotSize(notes: string | null): string {
  if (!notes) return ''
  const match = notes.match(/שטח מגרש: (\d+(?:\.\d+)?) מ"ר/)
  return match ? match[1] : ''
}

export default function SettingsPage() {
  const { user, role, signOut } = useAuth()
  const supabase = createClient()
  const [projectVatRate, setProjectVatRate] = useState<number | null>(null)
  const { vatRate, setVatRate } = useVatRate(projectVatRate)

  // Profile
  const [profile, setProfile] = useState({ full_name: '', phone: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Project
  const [project, setProject] = useState<Project | null>(null)
  const [projectForm, setProjectForm] = useState({
    name: '', address: '', location_type: '', build_type: '', construction_type: '',
    total_budget: '', start_date: '', target_end_date: '', plot_size: '',
    house_size: '', has_basement: false, basement_size: '', finish_level: '',
  })
  const [savingProject, setSavingProject] = useState(false)

  // Invite
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [currentClient, setCurrentClient] = useState<{ email: string } | null>(null)

  // Active section
  const [section, setSection] = useState<'account' | 'project' | 'invite' | 'vat' | 'danger'>('account')

  useEffect(() => {
    if (!user || user.id === 'dev-user') return
    loadData()
  }, [user])

  async function loadData() {
    // Load profile
    const { data: profileData } = await supabase.from('users').select('full_name, phone').eq('id', user!.id).single()
    if (profileData) setProfile({ full_name: profileData.full_name ?? '', phone: profileData.phone ?? '' })

    // Load project
    const { data: proj } = await supabase.from('projects')
      .select('id,name,address,total_budget,location_type,build_type,construction_type,start_date,target_end_date,notes,client_id,house_size,has_basement,basement_size,finish_level,vat_rate')
      .eq('admin_id', user!.id).order('created_at', { ascending: false }).limit(1).single()

    if (proj) {
      setProject(proj)
      if (proj.vat_rate != null) setProjectVatRate(proj.vat_rate)
      setProjectForm({
        name: proj.name ?? '',
        address: proj.address ?? '',
        location_type: proj.location_type ?? '',
        build_type: proj.build_type ?? '',
        construction_type: proj.construction_type ?? '',
        total_budget: proj.total_budget ? String(proj.total_budget) : '',
        start_date: proj.start_date ?? '',
        target_end_date: proj.target_end_date ?? '',
        plot_size: extractPlotSize(proj.notes),
        house_size: proj.house_size ? String(proj.house_size) : '',
        has_basement: proj.has_basement ?? false,
        basement_size: proj.basement_size ? String(proj.basement_size) : '',
        finish_level: proj.finish_level ?? '',
      })

      // Load current client
      if (proj.client_id && proj.client_id !== user!.id) {
        const { data: authUser } = await supabase.auth.getUser()
        // Look up client email from users/auth
        const { data: clientProfile } = await supabase.from('users').select('id').eq('id', proj.client_id).single()
        if (clientProfile) setCurrentClient({ email: '(מוגדר)' })
      }
    }
  }

  async function saveVatRate(rate: number) {
    setVatRate(rate)
    setProjectVatRate(rate)
    if (project) {
      await supabase.from('projects').update({ vat_rate: rate }).eq('id', project.id)
    }
  }

  async function saveProfile() {
    if (!user) return
    setSavingProfile(true)
    const { error } = await supabase.from('users').update({
      full_name: profile.full_name,
      phone: profile.phone,
    }).eq('id', user.id)
    setSavingProfile(false)
    if (error) toast.error('שגיאה בשמירה')
    else toast.success('הפרופיל עודכן')
  }

  async function saveProject() {
    if (!project) return
    setSavingProject(true)

    // Rebuild notes with plot_size
    const noteParts = []
    const existingNotes = project.notes ?? ''
    const withoutPlot = existingNotes.replace(/שטח מגרש: \d+(?:\.\d+)? מ"ר\s*\|?\s*/g, '').replace(/\|\s*$/, '').trim()
    if (withoutPlot) noteParts.push(withoutPlot)
    if (projectForm.plot_size) noteParts.push(`שטח מגרש: ${projectForm.plot_size} מ"ר`)

    const { error } = await supabase.from('projects').update({
      name: projectForm.name,
      address: projectForm.address || null,
      location_type: projectForm.location_type || null,
      build_type: projectForm.build_type || null,
      construction_type: projectForm.construction_type || null,
      total_budget: projectForm.total_budget ? parseFloat(projectForm.total_budget.replace(/,/g, '')) : null,
      start_date: projectForm.start_date || null,
      target_end_date: projectForm.target_end_date || null,
      notes: noteParts.join(' | ') || null,
      house_size: projectForm.house_size ? parseFloat(projectForm.house_size) : null,
      has_basement: projectForm.has_basement,
      basement_size: projectForm.basement_size ? parseFloat(projectForm.basement_size) : null,
      finish_level: projectForm.finish_level || null,
    }).eq('id', project.id)

    setSavingProject(false)
    if (error) { toast.error('שגיאה בשמירה'); return }

    // Sync stage planned_costs if estimate params changed
    const house_size = projectForm.house_size ? parseFloat(projectForm.house_size) : null
    const has_basement = projectForm.has_basement
    const basement_size = projectForm.basement_size ? parseFloat(projectForm.basement_size) : null
    const finish_level = projectForm.finish_level || null
    if (house_size || finish_level) {
      const items = calculatePrices({ house_size, has_basement, basement_size, finish_level: finish_level as 'basic' | 'standard' | 'high' | null, construction_type: projectForm.construction_type as 'concrete' | 'light' | null || null })
      const byPhase: Record<string, { min: number; max: number }> = {}
      for (const item of items) {
        if (!byPhase[item.phase]) byPhase[item.phase] = { min: 0, max: 0 }
        byPhase[item.phase].min += item.adjusted_min
        byPhase[item.phase].max += item.adjusted_max
      }
      const { data: stagesData } = await supabase.from('stages').select('id, name').eq('project_id', project.id)
      for (const stage of stagesData ?? []) {
        const phase = STAGE_TO_PHASE[stage.name]
        const range = phase ? byPhase[phase] : null
        if (!range) continue
        const midpoint = Math.round((range.min + range.max) / 2)
        await supabase.from('stages').update({ planned_cost: midpoint }).eq('id', stage.id)
      }
    }

    toast.success('פרטי הפרויקט עודכנו')
    loadData()
  }

  async function inviteClient() {
    if (!inviteEmail.trim() || !project) return
    setInviting(true)
    try {
      const email = inviteEmail.trim().toLowerCase()

      // Check if user already exists (by email stored in users table)
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existingUser) {
        // User exists — link them directly to the project
        const { error } = await supabase.from('projects')
          .update({ client_id: existingUser.id })
          .eq('id', project.id)
        if (error) throw error
        toast.success(`הלקוח ${email} חובר לפרויקט!`)
      } else {
        // User doesn't exist yet — save pending invite email in project notes
        const notes = [project.notes, `הוזמן: ${email}`].filter(Boolean).join(' | ')
        const { error } = await supabase.from('projects').update({ notes }).eq('id', project.id)
        if (error) throw error
        toast.success(`ההזמנה נשמרה — שלח ללקוח את הלינק לאפליקציה`)
      }

      setCurrentClient({ email })
      setInviteEmail('')
    } catch (err: any) {
      toast.error(`שגיאה: ${err?.message ?? 'נסה שוב'}`)
    }
    setInviting(false)
  }

  const SECTIONS = [
    { id: 'account', icon: 'person', label: 'פרופיל' },
    { id: 'project', icon: 'home_work', label: 'פרטי פרויקט' },
    { id: 'invite',  icon: 'person_add', label: 'הזמנת לקוח' },
    { id: 'vat',     icon: 'percent', label: 'מע"מ' },
    { id: 'danger',  icon: 'logout', label: 'יציאה' },
  ] as const

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">הגדרות</h1>
        <p className="text-sm text-gray-400 mt-0.5">ניהול חשבון, פרויקט ואפשרויות</p>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">

        {/* ── Sidebar nav ── */}
        <div className="lg:w-52 flex-shrink-0">
          <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                  section === s.id
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
                style={section === s.id ? { backgroundColor: '#002045' } : {}}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── Account / Profile ── */}
          {section === 'account' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
                  style={{ backgroundColor: '#002045' }}>
                  {(profile.full_name || user?.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{profile.full_name || 'ללא שם'}</p>
                  <p className="text-sm text-gray-400">{user?.email}</p>
                </div>
                <span className={cn('mr-auto text-xs font-bold px-3 py-1 rounded-full', role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700')}>
                  {role === 'admin' ? 'מנהל' : 'לקוח'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">שם מלא</label>
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="הכנס שם מלא"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">טלפון</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                    placeholder="05X-XXXXXXX"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">אימייל</label>
                  <input
                    type="email"
                    value={user?.email ?? ''}
                    disabled
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-100 text-sm bg-gray-50 text-gray-400"
                    dir="ltr"
                  />
                </div>
              </div>

              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="mt-5 px-6 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#002045' }}
              >
                {savingProfile
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />שומר...</>
                  : <><span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>save</span>שמור שינויים</>}
              </button>
            </div>
          )}

          {/* ── Project Settings ── */}
          {section === 'project' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                <span className="material-symbols-rounded text-indigo-500" style={{ fontSize: '1.2rem' }}>home_work</span>
                פרטי הפרויקט
              </h2>

              {!project ? (
                <p className="text-gray-400 text-sm">לא נמצא פרויקט</p>
              ) : (
                <div className="space-y-5">
                  {/* Basic */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">שם הפרויקט</label>
                      <input type="text" value={projectForm.name}
                        onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">כתובת</label>
                      <input type="text" value={projectForm.address}
                        onChange={e => setProjectForm(f => ({ ...f, address: e.target.value }))}
                        placeholder="רחוב, עיר"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">תקציב כולל (₪)</label>
                      <input type="number" value={projectForm.total_budget}
                        onChange={e => setProjectForm(f => ({ ...f, total_budget: e.target.value }))}
                        placeholder="1,500,000"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" dir="ltr" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">שטח מגרש (מ"ר)</label>
                      <input type="number" value={projectForm.plot_size}
                        onChange={e => setProjectForm(f => ({ ...f, plot_size: e.target.value }))}
                        placeholder="500"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" dir="ltr" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">שטח בנייה על-קרקעי (מ"ר)</label>
                      <input type="number" value={projectForm.house_size}
                        onChange={e => setProjectForm(f => ({ ...f, house_size: e.target.value }))}
                        placeholder="150"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" dir="ltr" />
                      <p className="text-xs text-gray-400 mt-1">קומות הבית בלבד — לא כולל מרתף</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">תאריך התחלה</label>
                      <input type="date" value={projectForm.start_date}
                        onChange={e => setProjectForm(f => ({ ...f, start_date: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">תאריך יעד לסיום</label>
                      <input type="date" value={projectForm.target_end_date}
                        onChange={e => setProjectForm(f => ({ ...f, target_end_date: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                  </div>

                  {/* Location type */}
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">מיקום</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {LOCATION_TYPES.map(lt => (
                        <button key={lt.value}
                          onClick={() => setProjectForm(f => ({ ...f, location_type: f.location_type === lt.value ? '' : lt.value }))}
                          className={cn(
                            'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all',
                            projectForm.location_type === lt.value
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                          )}>
                          <span className="material-symbols-rounded" style={{ fontSize: '1.3rem' }}>{lt.icon}</span>
                          {lt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Build type */}
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">סוג בנייה</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {BUILD_TYPES.map(bt => (
                        <button key={bt.value}
                          onClick={() => setProjectForm(f => ({ ...f, build_type: f.build_type === bt.value ? '' : bt.value }))}
                          className={cn(
                            'flex items-start gap-3 p-3.5 rounded-xl border-2 text-right transition-all',
                            projectForm.build_type === bt.value
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                          )}>
                          <span className={cn('material-symbols-rounded mt-0.5', projectForm.build_type === bt.value ? 'text-indigo-600' : 'text-gray-400')} style={{ fontSize: '1.2rem' }}>{bt.icon}</span>
                          <div>
                            <p className={cn('text-sm font-semibold', projectForm.build_type === bt.value ? 'text-indigo-700' : 'text-gray-700')}>{bt.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{bt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Construction type */}
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">סוג קונסטרוקציה</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CONSTRUCTION_TYPES.map(ct => (
                        <button key={ct.value}
                          onClick={() => setProjectForm(f => ({ ...f, construction_type: f.construction_type === ct.value ? '' : ct.value }))}
                          className={cn(
                            'flex items-start gap-3 p-3.5 rounded-xl border-2 text-right transition-all',
                            projectForm.construction_type === ct.value
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                          )}>
                          <span className={cn('material-symbols-rounded mt-0.5', projectForm.construction_type === ct.value ? 'text-indigo-600' : 'text-gray-400')} style={{ fontSize: '1.2rem' }}>{ct.icon}</span>
                          <div>
                            <p className={cn('text-sm font-semibold', projectForm.construction_type === ct.value ? 'text-indigo-700' : 'text-gray-700')}>{ct.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{ct.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* מרתף */}
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">מרתף</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        [true, 'domain', 'כן, יש מרתף'],
                        [false, 'crop_square', 'אין מרתף'],
                      ] as const).map(([val, icon, label]) => (
                        <button key={String(val)}
                          onClick={() => setProjectForm(f => ({ ...f, has_basement: val, basement_size: val ? f.basement_size : '' }))}
                          className={cn(
                            'flex items-center gap-2.5 p-3 rounded-xl border-2 text-sm font-medium transition-all',
                            projectForm.has_basement === val
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                          )}>
                          <span className={cn('material-symbols-rounded', projectForm.has_basement === val ? 'text-indigo-500' : 'text-gray-300')} style={{ fontSize: '1.1rem' }}>{icon}</span>
                          {label}
                        </button>
                      ))}
                    </div>
                    {projectForm.has_basement && (
                      <div className="mt-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">שטח מרתף (מ"ר)</label>
                        <input
                          type="number"
                          value={projectForm.basement_size}
                          onChange={e => setProjectForm(f => ({ ...f, basement_size: e.target.value }))}
                          placeholder="למשל 80"
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          dir="ltr"
                        />
                        <p className="text-xs text-gray-400 mt-1">שטח תת-קרקעי בלבד — נחשב בנפרד מהבנייה</p>
                      </div>
                    )}
                  </div>

                  {/* רמת גמר */}
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">רמת גמר</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ['basic',    'בסיסי',    'פונקציונלי'],
                        ['standard', 'רגיל',     'מקובל בשוק'],
                        ['high',     'גבוה',     'חומרים יוקרתיים'],
                      ] as const).map(([val, label, desc]) => (
                        <button key={val}
                          onClick={() => setProjectForm(f => ({ ...f, finish_level: f.finish_level === val ? '' : val }))}
                          className={cn(
                            'flex flex-col items-start gap-0.5 p-3 rounded-xl border-2 transition-all text-right',
                            projectForm.finish_level === val
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                          )}>
                          <p className={cn('text-xs font-semibold', projectForm.finish_level === val ? 'text-indigo-700' : 'text-gray-700')}>{label}</p>
                          <p className="text-[10px] text-gray-400">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={saveProject} disabled={savingProject}
                    className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
                    style={{ backgroundColor: '#002045' }}>
                    {savingProject
                      ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />שומר...</>
                      : <><span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>save</span>שמור שינויים</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Invite Client ── */}
          {section === 'invite' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                <span className="material-symbols-rounded text-indigo-500" style={{ fontSize: '1.2rem' }}>person_add</span>
                הזמנת לקוח לפרויקט
              </h2>
              <p className="text-sm text-gray-400 mb-6">הלקוח יוכל לצפות בהתקדמות, לסמן משימות ולהעלות מסמכים</p>

              {currentClient && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-5">
                  <span className="material-symbols-rounded text-emerald-500 filled" style={{ fontSize: '1.2rem' }}>check_circle</span>
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">לקוח מוגדר לפרויקט</p>
                    <p className="text-xs text-emerald-500 mt-0.5">{currentClient.email}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">כתובת אימייל של הלקוח</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    dir="ltr"
                  />
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-indigo-600">מה הלקוח יוכל לראות?</p>
                  {[
                    'התקדמות כוללת של הפרויקט',
                    'משימות בשלב הנוכחי — ולסמן אותן',
                    'מסמכים ותמונות',
                    'תקציב בסיסי (ללא עלויות פנימיות)',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs text-indigo-700">
                      <span className="material-symbols-rounded text-indigo-400 filled" style={{ fontSize: '0.9rem' }}>check</span>
                      {item}
                    </div>
                  ))}
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-amber-600">מה הלקוח לא יכול לעשות?</p>
                  {[
                    'עריכת תקציב, עלויות ומחירים',
                    'הוספת / מחיקת שלבים ומשימות',
                    'גישה לדף קבלנים ותשלומים',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs text-amber-700">
                      <span className="material-symbols-rounded text-amber-400 filled" style={{ fontSize: '0.9rem' }}>close</span>
                      {item}
                    </div>
                  ))}
                </div>

                <button
                  onClick={inviteClient}
                  disabled={inviting || !inviteEmail.trim() || !project}
                  className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-40"
                  style={{ backgroundColor: '#002045' }}>
                  {inviting
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />שולח הזמנה...</>
                    : <><span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>send</span>שלח הזמנה</>}
                </button>

                {/* Manual invite */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">הזמנה ידנית — שלח ללקוח:</p>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <code className="text-xs text-gray-600 flex-1 dir-ltr" dir="ltr">
                      {typeof window !== 'undefined' ? window.location.origin : 'https://your-app.com'}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.origin : '')
                        toast.success('הלינק הועתק!')
                      }}
                      className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium flex-shrink-0">
                      <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>content_copy</span>
                      העתק
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">הלקוח נכנס עם Google ואתה מוסיף אותו לפרויקט</p>
                </div>
              </div>
            </div>
          )}

          {/* ── VAT ── */}
          {section === 'vat' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                <span className="material-symbols-rounded text-indigo-500" style={{ fontSize: '1.2rem' }}>percent</span>
                הגדרות מע"מ
              </h2>
              <p className="text-sm text-gray-400 mb-5">אחוז המע"מ שיחושב כאשר מחיר מסומן "לא כולל מע"מ"</p>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={100} step={0.1}
                    value={vatRate}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0 && v <= 100) saveVatRate(v) }}
                    className="w-24 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center font-bold"
                    dir="ltr"
                  />
                  <span className="text-sm text-gray-600 font-medium">%</span>
                </div>
                <div className="flex gap-2">
                  {[17, 18].map(v => (
                    <button key={v} onClick={() => saveVatRate(v)}
                      className={cn('px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all', vatRate === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-indigo-300')}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
                <span className="material-symbols-rounded text-emerald-500 filled" style={{ fontSize: '1.1rem' }}>check_circle</span>
                <p className="text-sm text-emerald-700">
                  מע"מ נוכחי: <strong>{vatRate}%</strong> — יחושב אוטומטית בהצעות מחיר וקבלנים
                </p>
              </div>

              <div className="mt-5 bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-500 mb-3">דוגמה לחישוב</p>
                {[100000, 250000, 500000].map(price => (
                  <div key={price} className="flex justify-between text-sm">
                    <span className="text-gray-500">₪{price.toLocaleString()} לפני מע"מ</span>
                    <span className="font-semibold text-gray-900">₪{Math.round(price * (1 + vatRate / 100)).toLocaleString()} כולל מע"מ</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Danger / Logout ── */}
          {section === 'danger' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                <span className="material-symbols-rounded text-red-400" style={{ fontSize: '1.2rem' }}>logout</span>
                יציאה
              </h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">התנתקות מהמערכת</p>
                    <p className="text-xs text-gray-400 mt-0.5">תצא מהחשבון ותוחזר לעמוד הכניסה</p>
                  </div>
                  <button
                    onClick={signOut}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-red-600 border-2 border-red-200 hover:bg-red-50 transition-colors flex items-center gap-2">
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>logout</span>
                    התנתק
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
