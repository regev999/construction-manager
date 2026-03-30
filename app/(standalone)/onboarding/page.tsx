'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_STAGES, getPersonalizedStages } from '@/lib/data/construction-stages'
import { calculatePrices } from '@/lib/utils/price-calculator'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const STAGE_TO_PHASE: Record<string, string> = {
  'קרקע':       'קרקע',
  'היתר בנייה': 'היתר',
  'שלד':        'שלד',
  'גמר':        'גמר',
}

type LocationType = 'city' | 'moshav' | 'kibbutz' | 'other'
type OwnershipType = 'private' | 'rma'
type CurrentStage = 'searching_land' | 'have_land' | 'getting_permit' | 'have_permit' | 'in_construction' | 'finishing'
type BuildType = 'self' | 'turnkey'
type FinishLevel = 'basic' | 'standard' | 'high'
type ConstructionType = 'concrete' | 'light' | 'midtec'

interface OnboardingData {
  projectName: string
  address: string
  locationType: LocationType | null
  ownershipType: OwnershipType | null
  buildType: BuildType | null
  constructionType: ConstructionType | null
  currentStage: CurrentStage | null
  totalBudget: string
  plotSize: string
  houseSize: string
  hasBasement: boolean
  basementSize: string
  finishLevel: FinishLevel | null
}

const STAGE_TO_IDX: Record<CurrentStage, number> = {
  searching_land: 0, have_land: 0, getting_permit: 1,
  have_permit: 2, in_construction: 3, finishing: 3,
}

const PRIMARY = '#002045'
const TOTAL = 5

const STEP_META = [
  { title: 'ברוכים הבאים', sub: 'נבנה לך צ\'קליסט מותאם אישית' },
  { title: 'פרטי המגרש', sub: 'מיקום, בעלות ושטח' },
  { title: 'שלב הפרויקט', sub: 'נסמן מה כבר השלמת' },
  { title: 'פרטי הפרויקט', sub: 'שם, כתובת ותקציב' },
  { title: 'סיכום', sub: 'הכל מוכן להתחיל' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<OnboardingData>({
    projectName: '', address: '', locationType: null,
    ownershipType: null, buildType: null, constructionType: null, currentStage: null,
    totalBudget: '', plotSize: '',
    houseSize: '', hasBasement: false, basementSize: '', finishLevel: null,
  })

  function set<K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) {
    setData(d => ({ ...d, [key]: val }))
  }

  async function handleFinish() {
    if (!user) return
    setSaving(true)
    try {
      if (user.id === 'dev-user') {
        const mockProject = {
          id: 'dev-project-1',
          name: data.projectName || 'הפרויקט שלי',
          address: data.address || '',
          location_type: data.locationType,
          build_type: data.buildType,
          total_budget: data.totalBudget ? parseFloat(data.totalBudget.replace(/[,\s]/g, '')) : null,
          status: 'active',
          currentStage: data.currentStage,
          plotSize: data.plotSize,
          ownershipType: data.ownershipType,
        }
        localStorage.setItem('bm_dev_project', JSON.stringify(mockProject))
        sessionStorage.setItem('bm_onboarding_done', '1')
        router.push('/dashboard')
        return
      }

      const startIdx = data.currentStage ? STAGE_TO_IDX[data.currentStage] : 0
      const budget = data.totalBudget ? parseFloat(data.totalBudget.replace(/[,\s]/g, '')) : null

      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          admin_id: user.id,
          client_id: user.id,
          name: data.projectName || 'הפרויקט שלי',
          address: data.address || null,
          location_type: data.locationType,
          build_type: data.buildType,
          construction_type: data.constructionType || null,
          total_budget: budget,
          status: 'active',
          house_size: data.houseSize ? parseFloat(data.houseSize) : null,
          has_basement: data.hasBasement,
          basement_size: data.basementSize ? parseFloat(data.basementSize) : null,
          finish_level: data.finishLevel || null,
          notes: [
            data.ownershipType === 'rma' ? 'קרקע רמ"י' : data.ownershipType === 'private' ? 'קרקע פרטית' : null,
            data.plotSize ? `שטח מגרש: ${data.plotSize} מ"ר` : null,
          ].filter(Boolean).join(' | ') || null,
        })
        .select()
        .single()

      if (error || !project) throw error

      // Build price estimate map for calculated planned_costs
      const house_size = data.houseSize ? parseFloat(data.houseSize) : null
      const basement_size = data.basementSize ? parseFloat(data.basementSize) : null
      const priceItems = calculatePrices({ house_size, has_basement: data.hasBasement, basement_size, finish_level: data.finishLevel, construction_type: data.constructionType })
      const byPhase: Record<string, { min: number; max: number }> = {}
      for (const item of priceItems) {
        if (!byPhase[item.phase]) byPhase[item.phase] = { min: 0, max: 0 }
        byPhase[item.phase].min += item.adjusted_min
        byPhase[item.phase].max += item.adjusted_max
      }

      const personalizedStages = getPersonalizedStages(data.locationType, data.ownershipType, data.buildType)
      for (let si = 0; si < personalizedStages.length; si++) {
        const sd = personalizedStages[si]
        const status = si < startIdx ? 'completed' : si === startIdx ? 'in_progress' : 'pending'
        const phase = STAGE_TO_PHASE[sd.name]
        const range = phase ? byPhase[phase] : null
        const planned_cost = range && house_size
          ? Math.round((range.min + range.max) / 2)
          : sd.planned_cost
        const { data: stage } = await supabase.from('stages').insert({
          project_id: project.id, name: sd.name, sort_order: si,
          status, planned_cost,
        }).select().single()
        if (!stage) continue
        for (let ti = 0; ti < sd.tasks.length; ti++) {
          const t = sd.tasks[ti]
          const done = si < startIdx
          await supabase.from('tasks').insert({
            stage_id: stage.id, name: t.name, description: t.description,
            sort_order: ti, priority: t.priority, planned_cost: t.planned_cost,
            is_required: t.is_required, why_important: t.why_important,
            what_if_skip: t.what_if_skip, pro_tip: t.pro_tip,
            is_completed: done, completed_at: done ? new Date().toISOString() : null,
          })
        }
      }
      sessionStorage.setItem('bm_onboarding_done', '1')
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('שגיאה ביצירת הפרויקט. נסה שוב.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-row-reverse bg-white" dir="rtl">
      {/* Left: visual panel */}
      <LeftPanel step={step} />

      {/* Right: form panel */}
      <div className="flex-1 flex flex-col min-h-screen items-center justify-center">
        <div className="flex flex-col justify-center px-8 md:px-16 py-12 w-full max-w-lg">

          {/* Step badge */}
          <div className="flex items-center gap-3 mb-8">
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-sm font-medium tracking-wide">
              {step} / {TOTAL}
            </span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          {step === 1 && <StepWelcome onNext={() => setStep(2)} />}
          {step === 2 && (
            <StepLand
              locationType={data.locationType}
              ownershipType={data.ownershipType}
              plotSize={data.plotSize}
              onChangeLocation={v => set('locationType', v)}
              onChangeOwnership={v => set('ownershipType', v)}
              onChangePlotSize={v => set('plotSize', v)}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepCurrentStage
              value={data.currentStage}
              onChange={v => set('currentStage', v)}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <StepProjectDetails
              projectName={data.projectName}
              address={data.address}
              buildType={data.buildType}
              constructionType={data.constructionType}
              totalBudget={data.totalBudget}
              houseSize={data.houseSize}
              hasBasement={data.hasBasement}
              basementSize={data.basementSize}
              finishLevel={data.finishLevel}
              onChange={(f, v) => setData(d => ({ ...d, [f]: v }))}
              onChangeHasBasement={v => setData(d => ({ ...d, hasBasement: v, basementSize: v ? d.basementSize : '' }))}
              onChangeFinishLevel={v => setData(d => ({ ...d, finishLevel: v }))}
              onChangeConstructionType={v => setData(d => ({ ...d, constructionType: v }))}
              onNext={() => setStep(5)}
              onBack={() => setStep(3)}
            />
          )}
          {step === 5 && (
            <StepSummary
              data={data}
              saving={saving}
              onBack={() => setStep(4)}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Left visual panel ────────────────────────────────────────────────────────
const STEP_HEADLINES = [
  'ניהול הבנייה\nשלך במקום אחד',
  'פרטי המגרש\nמשפיעים על הכל',
  'נסמן מה\nכבר עשית',
  'פרטים בסיסיים\nלמעקב מלא',
  'הפרויקט שלך\nמוכן להתחיל!',
]
const STEP_DESCS = [
  'צ\'קליסט חכם, תקציב, קבלנים — הכל מסונכרן ומעודכן בזמן אמת',
  'מושב, קיבוץ ורמ"י דורשים צ\'קליסט שונה ובדיקות ייחודיות',
  'לא מתחילים מאפס — נבנה צ\'קליסט מהנקודה שבה אתה נמצא',
  'שם הפרויקט, כתובת ותקציב — הבסיס לכל הניהול שלנו',
  'הכל מוגדר. ממשיכים לדשבורד ומנהלים את הבנייה',
]

function LeftPanel({ step }: { step: number }) {
  return (
    <div className="relative hidden md:flex w-5/12 min-h-screen flex-col overflow-hidden flex-shrink-0">
      {/* Background */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(160deg, #0d1b2e 0%, #1a3855 45%, #0a1628 100%)'
      }} />

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.05]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      {/* Glow accent */}
      <div className="absolute top-1/3 -left-24 w-72 h-72 rounded-full opacity-20" style={{
        background: 'radial-gradient(circle, #6366f1, transparent 70%)'
      }} />
      <div className="absolute bottom-1/4 right-0 w-48 h-48 rounded-full opacity-10" style={{
        background: 'radial-gradient(circle, #3b82f6, transparent 70%)'
      }} />

      {/* Right accent border */}
      <div className="absolute top-0 right-0 w-px h-full" style={{
        background: 'linear-gradient(to bottom, transparent, rgba(99,102,241,0.6) 40%, rgba(139,92,246,0.4) 70%, transparent)'
      }} />

      {/* Logo */}
      <div className="relative z-10 p-8 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.25)' }}>
          <span className="material-symbols-rounded text-white filled" style={{ fontSize: '1rem' }}>home_work</span>
        </div>
        <span className="text-white/70 font-semibold text-sm tracking-wide">בנה חכם</span>
      </div>

      {/* Center icon */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-10">
        <StepIcon step={step} />
      </div>

      {/* Bottom content */}
      <div className="relative z-10 p-8 pb-10">
        <p className="text-white/30 text-xs font-semibold tracking-[0.2em] uppercase mb-5">BENA HAKHAM NEXT-GEN</p>
        <h2 className="text-white font-bold text-3xl leading-tight mb-3 whitespace-pre-line">
          {STEP_HEADLINES[step - 1]}
        </h2>
        <p className="text-white/45 text-sm leading-relaxed mb-8">
          {STEP_DESCS[step - 1]}
        </p>
        <div className="flex gap-8 pt-6 border-t border-white/10">
          <div>
            <p className="text-white font-bold text-2xl">99.9%</p>
            <p className="text-white/35 text-xs mt-0.5">דיוק בניהול</p>
          </div>
          <div>
            <p className="text-white font-bold text-2xl">+500</p>
            <p className="text-white/35 text-xs mt-0.5">משימות מנוהלות</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StepIcon({ step }: { step: number }) {
  const icons = ['home_work', 'landscape', 'flag', 'edit_note', 'rocket_launch']
  return (
    <div className="text-center">
      <div className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-4" style={{ background: 'rgba(99,102,241,0.2)' }}>
        <span className="material-symbols-rounded text-indigo-300 filled" style={{ fontSize: '2.5rem' }}>
          {icons[step - 1]}
        </span>
      </div>
      <div className="flex gap-1.5 justify-center">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div key={i} className={cn(
            'h-1 rounded-full transition-all duration-300',
            i + 1 === step ? 'w-6 bg-indigo-400' : i + 1 < step ? 'w-3 bg-indigo-600' : 'w-3 bg-white/15'
          )} />
        ))}
      </div>
    </div>
  )
}

// ─── Shared form components ───────────────────────────────────────────────────
function StepTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-7">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="h-0.5 w-10 rounded-full" style={{ backgroundColor: PRIMARY }} />
        <p className="text-sm text-gray-400">{sub}</p>
      </div>
    </div>
  )
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-6 transition-colors group">
      <span className="material-symbols-rounded group-hover:translate-x-0.5 transition-transform" style={{ fontSize: '0.9rem' }}>arrow_forward</span>
      חזרה לשלב הקודם
    </button>
  )
}

function SubmitBtn({ onClick, disabled, loading, children }: {
  onClick: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed mt-6 flex items-center justify-center gap-2 shadow-sm"
      style={{ backgroundColor: PRIMARY }}
    >
      {children}
    </button>
  )
}

const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none transition-all bg-gray-50/50"

function FInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        className={inputClass}
        onFocus={e => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.backgroundColor = 'white' }}
        onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.backgroundColor = '' }}
        {...props}
      />
    </div>
  )
}

function OptionBtn({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-right transition-all',
        selected ? '' : 'border-gray-150 bg-gray-50/50 hover:border-gray-200'
      )}
      style={selected ? { borderColor: `${PRIMARY}35`, backgroundColor: `${PRIMARY}07` } : {}}
    >
      {children}
    </button>
  )
}

function CheckIcon({ selected }: { selected: boolean }) {
  if (!selected) return null
  return <span className="material-symbols-rounded filled mr-auto flex-shrink-0 text-indigo-600" style={{ fontSize: '1rem', color: PRIMARY }}>check_circle</span>
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <StepTitle title="ברוכים הבאים 👋" sub="4 שאלות קצרות לצ'קליסט מותאם אישית" />

      <div className="space-y-2.5 mb-2">
        {[
          { n: '01', t: 'פרטי המגרש ובעלות' },
          { n: '02', t: 'שלב הפרויקט הנוכחי' },
          { n: '03', t: 'שם, כתובת ותקציב' },
          { n: '04', t: 'סיכום והפעלה' },
        ].map(i => (
          <div key={i.n} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-xs font-bold w-6 flex-shrink-0 text-gray-300">{i.n}</span>
            <span className="text-sm text-gray-600">{i.t}</span>
          </div>
        ))}
      </div>

      <SubmitBtn onClick={onNext}>
        בואו נתחיל
        <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>arrow_back</span>
      </SubmitBtn>
    </div>
  )
}

// ─── Step 2: Land ─────────────────────────────────────────────────────────────
function StepLand({ locationType, ownershipType, plotSize, onChangeLocation, onChangeOwnership, onChangePlotSize, onNext, onBack }: {
  locationType: LocationType | null; ownershipType: OwnershipType | null; plotSize: string
  onChangeLocation: (v: LocationType) => void; onChangeOwnership: (v: OwnershipType) => void
  onChangePlotSize: (v: string) => void; onNext: () => void; onBack: () => void
}) {
  const locationOpts: { value: LocationType; icon: string; label: string }[] = [
    { value: 'city', icon: 'location_city', label: 'עיר / ישוב עירוני' },
    { value: 'moshav', icon: 'agriculture', label: 'מושב' },
    { value: 'kibbutz', icon: 'park', label: 'קיבוץ' },
    { value: 'other', icon: 'place', label: 'כפר / ישוב קהילתי' },
  ]

  return (
    <div>
      <BackBtn onBack={onBack} />
      <StepTitle title="פרטי המגרש" sub="שאלה 1 מתוך 4" />

      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">מיקום המגרש</p>
          <div className="space-y-1.5">
            {locationOpts.map(opt => (
              <OptionBtn key={opt.value} selected={locationType === opt.value} onClick={() => onChangeLocation(opt.value)}>
                <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: '1.1rem', color: locationType === opt.value ? PRIMARY : '#d1d5db' }}>{opt.icon}</span>
                <span className="text-sm font-medium" style={{ color: locationType === opt.value ? PRIMARY : '#374151' }}>{opt.label}</span>
                <CheckIcon selected={locationType === opt.value} />
              </OptionBtn>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">סוג הבעלות</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['private', 'lock_open', 'קרקע פרטית', 'טאבו / רשות'],
              ['rma', 'account_balance', 'קרקע רמ"י', 'מינהל מקרקעי ישראל'],
            ] as const).map(([val, icon, label, sub]) => (
              <button key={val} onClick={() => onChangeOwnership(val)}
                className={cn('flex flex-col items-start gap-1 p-3.5 rounded-xl border transition-all',
                  ownershipType === val ? '' : 'border-gray-150 bg-gray-50/50 hover:border-gray-200')}
                style={ownershipType === val ? { borderColor: `${PRIMARY}35`, backgroundColor: `${PRIMARY}07` } : {}}>
                <span className="material-symbols-rounded" style={{ fontSize: '1.2rem', color: ownershipType === val ? PRIMARY : '#d1d5db' }}>{icon}</span>
                <p className="text-xs font-semibold" style={{ color: ownershipType === val ? PRIMARY : '#374151' }}>{label}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </button>
            ))}
          </div>
          {ownershipType === 'rma' && (
            <div className="mt-2 flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
              <span className="material-symbols-rounded text-amber-500 flex-shrink-0 mt-0.5" style={{ fontSize: '0.9rem' }}>warning</span>
              <p className="text-xs text-amber-700 leading-relaxed">קרקע רמ"י דורשת בדיקת דמי היוון ואישורים מיוחדים</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            שטח המגרש <span className="text-gray-300 font-normal normal-case">(אופציונלי)</span>
          </label>
          <div className="relative">
            <input
              type="text" inputMode="numeric" value={plotSize}
              onChange={e => onChangePlotSize(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="500" className={inputClass}
              onFocus={e => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.backgroundColor = 'white' }}
              onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.backgroundColor = '' }}
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">מ"ר</span>
          </div>
        </div>
      </div>

      <SubmitBtn onClick={onNext} disabled={!locationType || !ownershipType}>
        המשך לשלב הבא
        <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>arrow_back</span>
      </SubmitBtn>
    </div>
  )
}

// ─── Step 3: Current stage ────────────────────────────────────────────────────
function StepCurrentStage({ value, onChange, onNext, onBack }: {
  value: CurrentStage | null; onChange: (v: CurrentStage) => void; onNext: () => void; onBack: () => void
}) {
  const opts: { value: CurrentStage; icon: string; label: string; sub: string }[] = [
    { value: 'searching_land', icon: 'search', label: 'מחפש מגרש', sub: 'טרם רכשתי קרקע' },
    { value: 'have_land', icon: 'landscape', label: 'יש לי מגרש', sub: 'לפני תהליך ההיתר' },
    { value: 'getting_permit', icon: 'description', label: 'בתהליך היתר', sub: 'הגשתי לועדה' },
    { value: 'have_permit', icon: 'verified', label: 'יש לי היתר', sub: 'לפני תחילת בנייה' },
    { value: 'in_construction', icon: 'construction', label: 'בבנייה פעילה', sub: 'עבודות מתבצעות' },
    { value: 'finishing', icon: 'format_paint', label: 'שלבי גמר', sub: 'שלד הושלם' },
  ]
  return (
    <div>
      <BackBtn onBack={onBack} />
      <StepTitle title="באיזה שלב אתה?" sub="שאלה 2 מתוך 4" />

      <div className="grid grid-cols-2 gap-2">
        {opts.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className={cn('flex flex-col items-center gap-2 p-3.5 rounded-xl border transition-all text-center',
              value === opt.value ? '' : 'border-gray-150 bg-gray-50/50 hover:border-gray-200')}
            style={value === opt.value ? { borderColor: `${PRIMARY}35`, backgroundColor: `${PRIMARY}07` } : {}}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: value === opt.value ? `${PRIMARY}15` : '#f9fafb' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '1.15rem', color: value === opt.value ? PRIMARY : '#d1d5db' }}>{opt.icon}</span>
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight" style={{ color: value === opt.value ? PRIMARY : '#374151' }}>{opt.label}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-tight">{opt.sub}</p>
            </div>
          </button>
        ))}
      </div>

      <SubmitBtn onClick={onNext} disabled={!value}>
        המשך לשלב הבא
        <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>arrow_back</span>
      </SubmitBtn>
    </div>
  )
}

// ─── Step 4: Project details ──────────────────────────────────────────────────
function StepProjectDetails({
  projectName, address, buildType, constructionType, totalBudget,
  houseSize, hasBasement, basementSize, finishLevel,
  onChange, onChangeHasBasement, onChangeFinishLevel, onChangeConstructionType, onNext, onBack,
}: {
  projectName: string; address: string; buildType: BuildType | null; constructionType: ConstructionType | null; totalBudget: string
  houseSize: string; hasBasement: boolean; basementSize: string; finishLevel: FinishLevel | null
  onChange: (f: string, v: string) => void
  onChangeHasBasement: (v: boolean) => void
  onChangeFinishLevel: (v: FinishLevel | null) => void
  onChangeConstructionType: (v: ConstructionType | null) => void
  onNext: () => void; onBack: () => void
}) {
  function handleBudgetChange(raw: string) {
    const digits = raw.replace(/[^\d]/g, '')
    if (!digits) { onChange('totalBudget', ''); return }
    onChange('totalBudget', parseInt(digits).toLocaleString('he-IL'))
  }

  return (
    <div>
      <BackBtn onBack={onBack} />
      <StepTitle title="פרטי הפרויקט" sub="שאלה 3 מתוך 4" />

      <div className="space-y-4">
        <FInput label="שם הפרויקט" type="text" value={projectName}
          onChange={e => onChange('projectName', e.target.value)}
          placeholder="הבית החדש שלנו" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">כתובת</label>
          <div className="relative">
            <input type="text" value={address} onChange={e => onChange('address', e.target.value)}
              placeholder="רחוב הרצל 5, ראשון לציון"
              className={inputClass + ' pl-10'}
              onFocus={e => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.backgroundColor = 'white' }}
              onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.backgroundColor = '' }} />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-rounded text-gray-300" style={{ fontSize: '1rem' }}>location_on</span>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1.5">סוג בנייה</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['self', 'engineering', 'פיקוח עצמי', 'אני מנהל הקבלנים'],
              ['turnkey', 'villa', 'מפתח בידיים', 'קבלן ראשי אחראי'],
            ] as const).map(([val, icon, label, sub]) => (
              <button key={val} onClick={() => onChange('buildType', val)}
                className={cn('flex items-center gap-2.5 px-3 py-3 rounded-xl border text-right transition-all',
                  buildType === val ? '' : 'border-gray-150 bg-gray-50/50 hover:border-gray-200')}
                style={buildType === val ? { borderColor: `${PRIMARY}35`, backgroundColor: `${PRIMARY}07` } : {}}>
                <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: '1.1rem', color: buildType === val ? PRIMARY : '#d1d5db' }}>{icon}</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: buildType === val ? PRIMARY : '#374151' }}>{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* סוג קונסטרוקציה */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1.5">סוג קונסטרוקציה</p>
          <div className="flex flex-col gap-2">
            {([
              ['concrete', 'foundation',   'בנייה רגילה (בטון)',  'בטון ובלוקים — הסטנדרט הנפוץ'],
              ['light',    'home_storage',  'פלדה עבת דופן',       'שלד פלדה מבני — עלות נמוכה משמעותית'],
              ['midtec',   'grid_on',       'מידטק / LSF',          'פרופילי פלדה דקים — עלות דומה לבטון'],
            ] as const).map(([val, icon, label, sub]) => (
              <button key={val} onClick={() => onChangeConstructionType(constructionType === val ? null : val)}
                className={cn('flex items-center gap-2.5 px-3 py-3 rounded-xl border text-right transition-all',
                  constructionType === val ? '' : 'border-gray-150 bg-gray-50/50 hover:border-gray-200')}
                style={constructionType === val ? { borderColor: `${PRIMARY}35`, backgroundColor: `${PRIMARY}07` } : {}}>
                <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: '1.1rem', color: constructionType === val ? PRIMARY : '#d1d5db' }}>{icon}</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: constructionType === val ? PRIMARY : '#374151' }}>{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            תקציב כולל <span className="text-gray-300 font-normal text-xs">(אופציונלי)</span>
          </label>
          <div className="relative">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">₪</span>
            <input type="text" inputMode="numeric" value={totalBudget}
              onChange={e => handleBudgetChange(e.target.value)}
              placeholder="1,500,000" className={inputClass + ' pr-8'}
              onFocus={e => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.backgroundColor = 'white' }}
              onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.backgroundColor = '' }} />
          </div>
        </div>

        {/* שטח בנייה */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            שטח בנייה על-קרקעי <span className="text-gray-300 font-normal text-xs">(אופציונלי — לאומדן עלויות)</span>
          </label>
          <div className="relative">
            <input type="text" inputMode="numeric" value={houseSize}
              onChange={e => onChange('houseSize', e.target.value.replace(/[^\d]/g, ''))}
              placeholder="150"
              className={inputClass + ' pl-10'}
              onFocus={e => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.backgroundColor = 'white' }}
              onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.backgroundColor = '' }} />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">מ"ר</span>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">קומות הבית בלבד — לא כולל מרתף</p>
        </div>

        {/* מרתף */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1.5">האם יש מרתף?</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              [true, 'domain', 'כן, יש מרתף'],
              [false, 'crop_square', 'לא'],
            ] as const).map(([val, icon, label]) => (
              <button key={String(val)} onClick={() => onChangeHasBasement(val)}
                className={cn('flex items-center gap-2.5 px-3 py-3 rounded-xl border text-right transition-all',
                  hasBasement === val ? '' : 'border-gray-150 bg-gray-50/50 hover:border-gray-200')}
                style={hasBasement === val ? { borderColor: `${PRIMARY}35`, backgroundColor: `${PRIMARY}07` } : {}}>
                <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: '1.1rem', color: hasBasement === val ? PRIMARY : '#d1d5db' }}>{icon}</span>
                <p className="text-xs font-semibold" style={{ color: hasBasement === val ? PRIMARY : '#374151' }}>{label}</p>
              </button>
            ))}
          </div>
          {hasBasement && (
            <div className="mt-3">
              <div className="relative">
                <input
                  type="text" inputMode="numeric" value={basementSize}
                  onChange={e => onChange('basementSize', e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="שטח מרתף, למשל 80"
                  className={inputClass + ' pl-10'}
                  onFocus={e => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.backgroundColor = 'white' }}
                  onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.backgroundColor = '' }}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">מ"ר</span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">שטח תת-קרקעי בלבד — נחשב בנפרד מהבנייה</p>
            </div>
          )}
        </div>

        {/* רמת גמר */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1.5">
            רמת גמר <span className="text-gray-300 font-normal text-xs">(אופציונלי)</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([
              ['basic', 'Aa', 'בסיסי', 'פונקציונלי'],
              ['standard', 'Aa', 'רגיל', 'מקובל בשוק'],
              ['high', 'Aa', 'גבוה', 'חומרים יוקרתיים'],
            ] as const).map(([val, , label, sub]) => (
              <button key={val} onClick={() => onChangeFinishLevel(finishLevel === val ? null : val)}
                className={cn('flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border transition-all',
                  finishLevel === val ? '' : 'border-gray-150 bg-gray-50/50 hover:border-gray-200')}
                style={finishLevel === val ? { borderColor: `${PRIMARY}35`, backgroundColor: `${PRIMARY}07` } : {}}>
                <p className="text-xs font-semibold" style={{ color: finishLevel === val ? PRIMARY : '#374151' }}>{label}</p>
                <p className="text-[10px] text-gray-400">{sub}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <SubmitBtn onClick={onNext}>
        המשך לשלב הבא
        <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>arrow_back</span>
      </SubmitBtn>
    </div>
  )
}

// ─── Step 5: Summary ──────────────────────────────────────────────────────────
const STAGE_LABELS: Record<CurrentStage, string> = {
  searching_land: 'מחפש מגרש', have_land: 'יש מגרש', getting_permit: 'בתהליך היתר',
  have_permit: 'יש היתר', in_construction: 'בבנייה פעילה', finishing: 'שלבי גמר',
}
const LOC_LABELS: Record<LocationType, string> = {
  city: 'עיר / עירוני', moshav: 'מושב', kibbutz: 'קיבוץ', other: 'ישוב קהילתי',
}

function StepSummary({ data, saving, onBack, onFinish }: {
  data: OnboardingData; saving: boolean; onBack: () => void; onFinish: () => void
}) {
  const completedStages = data.currentStage ? STAGE_TO_IDX[data.currentStage] : 0
  const rows = [
    { icon: 'home_work', label: 'שם', value: data.projectName || 'הפרויקט שלי' },
    data.address ? { icon: 'location_on', label: 'כתובת', value: data.address } : null,
    data.locationType ? { icon: 'place', label: 'מיקום', value: LOC_LABELS[data.locationType] } : null,
    data.ownershipType ? { icon: 'gavel', label: 'בעלות', value: data.ownershipType === 'rma' ? 'קרקע רמ"י' : 'קרקע פרטית' } : null,
    data.plotSize ? { icon: 'straighten', label: 'שטח', value: `${data.plotSize} מ"ר` } : null,
    data.currentStage ? { icon: 'flag', label: 'שלב', value: STAGE_LABELS[data.currentStage] } : null,
    data.totalBudget ? { icon: 'payments', label: 'תקציב', value: `₪${data.totalBudget}` } : null,
  ].filter(Boolean) as { icon: string; label: string; value: string }[]

  return (
    <div>
      <BackBtn onBack={onBack} />
      <StepTitle title="הכל מוכן! 🎉" sub="סיכום הפרויקט שלך" />

      <div className="border border-gray-100 rounded-2xl p-4 space-y-3 mb-4 bg-gray-50/50">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="material-symbols-rounded flex-shrink-0 text-gray-300" style={{ fontSize: '1rem' }}>{r.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400">{r.label}</p>
              <p className="text-sm font-medium text-gray-800 truncate">{r.value}</p>
            </div>
          </div>
        ))}
      </div>

      {completedStages > 0 && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 mb-2">
          <span className="material-symbols-rounded text-emerald-500 filled flex-shrink-0" style={{ fontSize: '1rem' }}>check_circle</span>
          <p className="text-xs text-emerald-700">{completedStages} שלבים יסומנו כהושלמו אוטומטית</p>
        </div>
      )}

      <SubmitBtn onClick={onFinish} loading={saving}>
        {saving
          ? <><span className="material-symbols-rounded text-sm animate-spin">progress_activity</span>יוצר פרויקט...</>
          : <><span className="material-symbols-rounded filled text-sm">rocket_launch</span>צור את הפרויקט שלי</>
        }
      </SubmitBtn>
    </div>
  )
}
