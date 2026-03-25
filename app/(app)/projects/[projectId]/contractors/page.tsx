'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatNIS } from '@/components/shared/CurrencyDisplay'
import { useVatRate } from '@/lib/hooks/useVatRate'

/* ─── Types ─────────────────────────────────────────────────── */
type WorkStatus = 'not_started' | 'in_progress' | 'completed'
type PaymentMethod = 'cash' | 'bank_transfer' | 'credit'

interface Payment {
  id: string
  contractor_id: string
  label: string
  amount: number
  is_paid: boolean
  paid_date: string | null
  pre_check_done: boolean
  notes: string | null
  payment_method: PaymentMethod | null
  receipt_url: string | null
  due_date: string | null
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string; color: string }[] = [
  { value: 'cash',          label: 'מזומן',       icon: 'payments',       color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { value: 'bank_transfer', label: 'העברה בנקאית', icon: 'account_balance', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'credit',        label: 'אשראי',        icon: 'credit_card',    color: 'text-purple-600 bg-purple-50 border-purple-200' },
]

interface Extra {
  id: string
  contractor_id: string
  description: string
  amount: number | null
  approved_by: string | null
  approved_date: string | null
}

interface Contractor {
  id: string
  name: string
  trade: string | null
  phone: string | null
  email: string | null
  notes: string | null
  rating: number | null
  status: WorkStatus
  progress_pct: number
  quote_amount: number | null
  actual_amount: number | null
  advance_amount: number | null
  start_date: string | null
  planned_end_date: string | null
  actual_end_date: string | null
  contract_url: string | null
  payments?: Payment[]
  extras?: Extra[]
}

/* ─── Constants ──────────────────────────────────────────────── */
const TRADES: { value: string; label: string; icon: string }[] = [
  { value: 'קבלן ראשי',  label: 'קבלן ראשי',       icon: 'construction'        },
  { value: 'מגרש',       label: 'מגרש',             icon: 'landscape'           },
  { value: 'תכנון',      label: 'תכנון ואדריכלות',  icon: 'architecture'        },
  { value: 'עבודות עפר', label: 'עבודות עפר',       icon: 'excavator'           },
  { value: 'בטון ושלד',  label: 'בטון ושלד',        icon: 'foundation'          },
  { value: 'שלד ובנייה', label: 'שלד ובנייה',       icon: 'handyman'            },
  { value: 'אינסטלציה',  label: 'אינסטלציה',        icon: 'plumbing'            },
  { value: 'חשמל',       label: 'חשמל',             icon: 'electrical_services' },
  { value: 'גבסן',       label: 'גבס וגבסית',       icon: 'straighten'          },
  { value: 'ריצוף',      label: 'ריצוף וחיפויים',   icon: 'grid_on'             },
  { value: 'אלומיניום',  label: 'אלומיניום',        icon: 'window'              },
  { value: 'מטבחים',     label: 'מטבח',             icon: 'kitchen'             },
  { value: 'צבע',        label: 'צביעה',             icon: 'format_paint'        },
  { value: 'מסגר',       label: 'מסגרות',            icon: 'fence'               },
  { value: 'נגר',        label: 'נגרות',             icon: 'carpenter'           },
  { value: 'גג',         label: 'גג ואיטום',         icon: 'roofing'             },
  { value: 'מיזוג',      label: 'מיזוג',             icon: 'ac_unit'             },
  { value: 'אחר',        label: 'אחר',               icon: 'more_horiz'          },
]

const STATUS_LABELS: Record<WorkStatus, { label: string; color: string; bg: string; icon: string }> = {
  not_started: { label: 'לא התחיל', color: 'text-gray-500', bg: 'bg-gray-100', icon: 'schedule' },
  in_progress:  { label: 'בתהליך',   color: 'text-blue-600',  bg: 'bg-blue-50',  icon: 'construction' },
  completed:    { label: 'הושלם',    color: 'text-emerald-600',bg: 'bg-emerald-50',icon: 'check_circle' },
}

const RISK_LABELS = {
  low:    { label: 'נמוך',   color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-400' },
  medium: { label: 'בינוני', color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-400'   },
  high:   { label: 'גבוה',   color: 'text-red-600',     bg: 'bg-red-50 border-red-200',        dot: 'bg-red-500'     },
}

/* ─── Helpers ────────────────────────────────────────────────── */
function calcRisk(c: Contractor): 'low' | 'medium' | 'high' {
  let score = 0
  if (!c.contract_url) score++
  if (c.quote_amount && c.actual_amount && c.actual_amount > c.quote_amount * 1.1) score++
  if (c.planned_end_date && !c.actual_end_date && c.status !== 'completed') {
    const overdue = (Date.now() - new Date(c.planned_end_date).getTime()) / (1000 * 60 * 60 * 24)
    if (overdue > 14) score += 2
    else if (overdue > 0) score++
  }
  if (c.advance_amount && c.quote_amount && c.actual_amount !== null) {
    const paid = (c.advance_amount ?? 0) + (c.actual_amount ?? 0)
    const paymentPct = c.quote_amount > 0 ? paid / c.quote_amount : 0
    if (paymentPct > c.progress_pct / 100 + 0.2) score++
  }
  return score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low'
}

function daysOverdue(planned: string | null): number {
  if (!planned) return 0
  return Math.floor((Date.now() - new Date(planned).getTime()) / (1000 * 60 * 60 * 24))
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function ContractorsPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const supabase = createClient()
  const { vatRate, applyVat } = useVatRate()

  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Record<string, string>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ name: '', trade: '', phone: '', email: '', notes: '', quote_amount: '', quote_vat_included: true })
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState<WorkStatus | 'all'>('all')
  const [filterRisk, setFilterRisk] = useState<'all' | 'high'>('all')
  const [preCheckModal, setPreCheckModal] = useState<{
    payment: Payment; contractor: Contractor
    method: PaymentMethod | null; paid_date: string; receipt_url: string | null; receipt_uploading: boolean
  } | null>(null)
  const [preChecks, setPreChecks] = useState({ work_done: false, work_inspected: false, no_overruns: false })
  const [uploading, setUploading] = useState<string | null>(null)
  const [addPaymentForm, setAddPaymentForm] = useState<{ contractorId: string; label: string; amount: string; due_date: string; vat_included: boolean } | null>(null)
  const paymentReceiptRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [projectId])

  async function load() {
    const { data: ctrs } = await supabase
      .from('contractors')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at')

    if (!ctrs) { setLoading(false); return }

    const ids = ctrs.map(c => c.id)
    const [{ data: pays }, { data: exts }] = await Promise.all([
      supabase.from('contractor_payments').select('*').in('contractor_id', ids.length ? ids : ['x']),
      supabase.from('contractor_extras').select('*').in('contractor_id', ids.length ? ids : ['x']),
    ])

    setContractors(ctrs.map(c => ({
      ...c,
      status: c.status ?? 'not_started',
      progress_pct: c.progress_pct ?? 0,
      payments: pays?.filter(p => p.contractor_id === c.id) ?? [],
      extras: exts?.filter(e => e.contractor_id === c.id) ?? [],
    })))
    setLoading(false)
  }

  /* ── Add Contractor ── */
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('contractors').insert({
      project_id: projectId,
      name: form.name.trim(),
      trade: form.trade || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
      quote_amount: form.quote_amount ? Math.round(applyVat(parseFloat(form.quote_amount), form.quote_vat_included)) : null,
      status: 'not_started',
      progress_pct: 0,
    }).select().single()
    if (error) { toast.error('שגיאה בשמירה'); setSaving(false); return }
    if (data) setContractors(p => [...p, { ...data, status: 'not_started', progress_pct: 0, payments: [], extras: [] }])
    setForm({ name: '', trade: '', phone: '', email: '', notes: '', quote_amount: '', quote_vat_included: true })
    setShowAddForm(false)
    setSaving(false)
    toast.success('קבלן נוסף!')
  }

  /* ── Update contractor field ── */
  async function updateField(id: string, field: string, value: unknown) {
    setContractors(p => p.map(c => c.id === id ? { ...c, [field]: value } as Contractor : c))
    await supabase.from('contractors').update({ [field]: value }).eq('id', id)
  }

  /* ── Upload contract ── */
  function openContractUpload(contractorId: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.jpg,.jpeg,.png'
    input.onchange = async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0]
      if (!file) return
      setUploading(contractorId)
      const ext = file.name.split('.').pop()
      const path = `contracts/${projectId}/${contractorId}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('build-manager-files').upload(path, file, { upsert: true })
      if (error) {
        toast.error(`שגיאה בהעלאה: ${error.message}`)
        setUploading(null)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('build-manager-files').getPublicUrl(path)
      await updateField(contractorId, 'contract_url', publicUrl)
      setUploading(null)
      toast.success('חוזה הועלה בהצלחה!')
    }
    input.click()
  }

  /* ── Payments ── */
  function openAddPaymentForm(contractorId: string) {
    setAddPaymentForm({ contractorId, label: '', amount: '', due_date: '', vat_included: true })
  }

  async function submitAddPayment() {
    if (!addPaymentForm) return
    const { contractorId, label, amount, due_date, vat_included } = addPaymentForm
    if (!label.trim() || !amount) return
    const rawAmount = parseFloat(amount)
    if (isNaN(rawAmount)) return
    const finalAmount = Math.round(applyVat(rawAmount, vat_included))
    // Try inserting with due_date field; fallback to notes if column doesn't exist
    let data: Payment | null = null
    const baseInsert = {
      contractor_id: contractorId, project_id: projectId,
      label: label.trim(), amount: finalAmount, is_paid: false, pre_check_done: false,
    }
    const { data: d1, error: e1 } = await supabase.from('contractor_payments').insert({
      ...baseInsert,
      due_date: due_date || null,
      notes: due_date ? `תאריך יעד: ${due_date}` : null,
    }).select().single()
    if (e1) {
      // Fallback: without due_date column
      const { data: d2, error: e2 } = await supabase.from('contractor_payments').insert({
        ...baseInsert,
        notes: due_date ? `תאריך יעד: ${due_date}` : null,
      }).select().single()
      if (e2) { toast.error('שגיאה'); return }
      data = d2 as Payment
    } else {
      data = d1 as Payment
    }
    setContractors(p => p.map(c => c.id === contractorId
      ? { ...c, payments: [...(c.payments ?? []), data!] }
      : c))
    setAddPaymentForm(null)
    toast.success('תשלום נוסף!')
  }

  function openPreCheck(payment: Payment, contractor: Contractor) {
    setPreChecks({ work_done: false, work_inspected: false, no_overruns: false })
    setPreCheckModal({
      payment, contractor,
      method: null,
      paid_date: new Date().toISOString().split('T')[0],
      receipt_url: null,
      receipt_uploading: false,
    })
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !preCheckModal) return
    setPreCheckModal(m => m ? { ...m, receipt_uploading: true } : null)
    try {
      const ext = file.name.split('.').pop()
      const path = `receipts/${projectId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('build-manager-files').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('build-manager-files').getPublicUrl(path)
      setPreCheckModal(m => m ? { ...m, receipt_url: publicUrl, receipt_uploading: false } : null)
      toast.success('הקבלה הועלתה')
    } catch {
      toast.error('שגיאה בהעלאת הקבלה')
      setPreCheckModal(m => m ? { ...m, receipt_uploading: false } : null)
    }
  }

  async function approvePayment() {
    if (!preCheckModal) return
    const { payment, contractor, method, paid_date, receipt_url } = preCheckModal
    const updateData: Record<string, unknown> = {
      is_paid: true,
      paid_date: paid_date || new Date().toISOString().split('T')[0],
      pre_check_done: true,
    }
    // Try to save new fields, handle gracefully if columns don't exist
    try {
      await supabase.from('contractor_payments').update({
        ...updateData,
        payment_method: method,
        receipt_url,
      }).eq('id', payment.id)
    } catch {
      await supabase.from('contractor_payments').update(updateData).eq('id', payment.id)
    }
    setContractors(p => p.map(c => c.id === contractor.id
      ? { ...c, payments: c.payments?.map(pay => pay.id === payment.id
          ? { ...pay, is_paid: true, pre_check_done: true, paid_date, payment_method: method, receipt_url }
          : pay) ?? [] }
      : c))
    setPreCheckModal(null)
    toast.success('תשלום אושר! ✓')
  }

  /* ── Extras ── */
  async function addExtra(contractor: Contractor) {
    const description = prompt('תיאור התוספת')
    const amtStr = prompt('סכום (₪) - השאר ריק אם לא ידוע')
    if (!description) return
    const amount = amtStr ? parseFloat(amtStr) : null
    const { data, error } = await supabase.from('contractor_extras').insert({
      contractor_id: contractor.id, project_id: projectId,
      description, amount: isNaN(amount as number) ? null : amount,
    }).select().single()
    if (error) { toast.error('שגיאה'); return }
    setContractors(p => p.map(c => c.id === contractor.id
      ? { ...c, extras: [...(c.extras ?? []), data] }
      : c))
    toast.success('תוספת נוספה!')
  }

  /* ── Filter & stats ── */
  const filtered = contractors.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterRisk === 'high' && calcRisk(c) !== 'high') return false
    return true
  })

  const totalQuote = contractors.reduce((s, c) => s + (c.quote_amount ?? 0), 0)
  const totalActual = contractors.reduce((s, c) => s + (c.actual_amount ?? 0) + (c.advance_amount ?? 0), 0)
  const atRiskCount = contractors.filter(c => calcRisk(c) === 'high').length

  function getTab(id: string) { return activeTab[id] ?? 'overview' }
  function setTab(id: string, tab: string) { setActiveTab(p => ({ ...p, [id]: tab })) }

  /* ─── Loading ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
      </div>
    )
  }

  /* ─── Render ──────────────────────────────────────────────── */
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">קבלנים וספקים</h1>
          <p className="text-sm text-gray-400 mt-0.5">{contractors.length} קבלנים בפרויקט</p>
        </div>
        <button onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium shadow-sm flex-shrink-0"
          style={{ backgroundColor: '#002045' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add</span>
          קבלן חדש
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'קבלנים', value: contractors.length, icon: 'engineering', color: 'text-indigo-500' },
          { label: 'שווי הצעות', value: formatNIS(totalQuote), icon: 'request_quote', color: 'text-blue-500' },
          { label: 'שולם בפועל', value: formatNIS(totalActual), icon: 'payments', color: 'text-emerald-500' },
          { label: 'בסיכון גבוה', value: atRiskCount, icon: 'warning', color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn('material-symbols-rounded filled', s.color)} style={{ fontSize: '1rem' }}>{s.icon}</span>
              <span className="text-xs text-gray-400">{s.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-semibold text-gray-800">קבלן / ספק חדש</h3>
          {/* Trade grid */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">תחום</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {TRADES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setForm(f => ({ ...f, trade: t.value }))}
                  className={cn(
                    'flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-xs font-medium transition-all',
                    form.trade === t.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  )}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1.2rem' }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">שם *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                placeholder="שם הקבלן" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">טלפון</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="050-0000000" dir="ltr"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">הצעת מחיר (₪)</label>
              <input type="number" value={form.quote_amount} onChange={e => setForm(f => ({ ...f, quote_amount: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                <input type="checkbox" checked={form.quote_vat_included}
                  onChange={e => setForm(f => ({ ...f, quote_vat_included: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded accent-indigo-600" />
                <span className="text-[11px] text-gray-400">
                  כולל מע"מ ({vatRate}%)
                  {!form.quote_vat_included && form.quote_amount && (
                    <span className="text-indigo-500 font-medium"> ← יתווסף {formatNIS(Math.round(parseFloat(form.quote_amount || '0') * vatRate / 100))}</span>
                  )}
                </span>
              </label>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">אימייל</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com" dir="ltr"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: '#002045' }}>
              {saving ? 'שומר...' : 'שמור'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)}
              className="px-5 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100">
              ביטול
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-xl overflow-hidden border border-gray-200 text-sm">
          {(['all', 'not_started', 'in_progress', 'completed'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('px-3 py-1.5 transition-colors', filterStatus === s ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50')}>
              {s === 'all' ? 'כולם' : STATUS_LABELS[s].label}
            </button>
          ))}
        </div>
        <button onClick={() => setFilterRisk(v => v === 'all' ? 'high' : 'all')}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors',
            filterRisk === 'high' ? 'bg-red-50 border-red-200 text-red-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}>
          <span className="material-symbols-rounded filled" style={{ fontSize: '0.9rem' }}>warning</span>
          סיכון גבוה {atRiskCount > 0 && `(${atRiskCount})`}
        </button>
      </div>

      {/* Contractors list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <span className="material-symbols-rounded text-gray-300" style={{ fontSize: '3rem' }}>engineering</span>
          <p className="text-gray-500 mt-3 font-medium">אין קבלנים</p>
          <p className="text-gray-400 text-sm mt-1">לחץ "קבלן חדש" כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const risk = calcRisk(c)
            const riskCfg = RISK_LABELS[risk]
            const statusCfg = STATUS_LABELS[c.status]
            const isExpanded = expandedId === c.id
            const tab = getTab(c.id)
            const overdue = daysOverdue(c.planned_end_date)
            const paidTotal = (c.payments ?? []).filter(p => p.is_paid).reduce((s, p) => s + p.amount, 0)
            const extrasTotal = (c.extras ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
            const actualWithExtras = (c.actual_amount ?? 0) + extrasTotal
            const overshoot = c.quote_amount ? actualWithExtras - c.quote_amount : 0

            return (
              <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card header — always visible */}
                <div className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-50">
                      <span className="material-symbols-rounded text-indigo-600" style={{ fontSize: '1.3rem' }}>engineering</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{c.name}</p>
                        {c.trade && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">{c.trade}</span>}
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-0.5', statusCfg.bg, statusCfg.color)}>
                          <span className="material-symbols-rounded filled" style={{ fontSize: '0.75rem' }}>{statusCfg.icon}</span>
                          {statusCfg.label}
                        </span>
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1', riskCfg.bg, riskCfg.color)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full inline-block', riskCfg.dot)} />
                          סיכון {riskCfg.label}
                        </span>
                        {!c.contract_url && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-500 border border-red-100">אין חוזה</span>
                        )}
                        {overdue > 0 && c.status !== 'completed' && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-600">איחור {overdue} ימים</span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>התקדמות</span>
                          <span>{c.progress_pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all',
                            c.progress_pct >= 100 ? 'bg-emerald-500' : c.progress_pct > 50 ? 'bg-blue-500' : 'bg-amber-400')}
                            style={{ width: `${c.progress_pct}%` }} />
                        </div>
                      </div>

                      {/* Financial mini row */}
                      <div className="flex gap-4 mt-2 flex-wrap">
                        {c.quote_amount != null && (
                          <span className="text-xs text-gray-400">הצעה: <span className="font-medium text-gray-700">{formatNIS(c.quote_amount)}</span></span>
                        )}
                        {actualWithExtras > 0 && (
                          <span className={cn('text-xs', overshoot > 0 ? 'text-red-500' : 'text-gray-400')}>
                            בפועל: <span className="font-medium">{formatNIS(actualWithExtras)}</span>
                            {overshoot > 0 && ` (+${formatNIS(overshoot)})`}
                          </span>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1 mr-auto">
                            <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}
                              className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-indigo-100 transition-colors">
                              <span className="material-symbols-rounded text-gray-500" style={{ fontSize: '0.9rem' }}>call</span>
                            </a>
                            <a href={`https://wa.me/972${c.phone.replace(/\D/g,'').replace(/^0/,'')}`}
                              target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-green-100 transition-colors">
                              <span className="text-gray-500 text-xs font-bold">W</span>
                            </a>
                            {c.email && (
                              <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-blue-100 transition-colors">
                                <span className="material-symbols-rounded text-gray-500" style={{ fontSize: '0.9rem' }}>mail</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <span className="material-symbols-rounded text-gray-300 flex-shrink-0 mt-1" style={{ fontSize: '1.1rem' }}>
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-100 px-4">
                      {[
                        { key: 'overview', label: 'סקירה', icon: 'dashboard' },
                        { key: 'payments', label: 'תשלומים', icon: 'payments', badge: (c.payments ?? []).filter(p => !p.is_paid).length },
                        { key: 'extras', label: 'תוספות', icon: 'add_circle', badge: (c.extras ?? []).length },
                        { key: 'files', label: 'מסמכים', icon: 'folder' },
                      ].map(t => (
                        <button key={t.key} onClick={() => setTab(c.id, t.key)}
                          className={cn('flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors relative',
                            tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600')}>
                          <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>{t.icon}</span>
                          {t.label}
                          {t.badge != null && t.badge > 0 && (
                            <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{t.badge}</span>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="p-4 space-y-4">

                      {/* ── TAB: Overview ── */}
                      {tab === 'overview' && (
                        <div className="space-y-4">
                          {/* Status + Progress */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">סטטוס עבודה</label>
                              <select value={c.status}
                                onChange={e => updateField(c.id, 'status', e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                                <option value="not_started">לא התחיל</option>
                                <option value="in_progress">בתהליך</option>
                                <option value="completed">הושלם</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">התקדמות: {c.progress_pct}%</label>
                              <input type="range" min="0" max="100" step="5"
                                value={c.progress_pct}
                                onChange={e => updateField(c.id, 'progress_pct', parseInt(e.target.value))}
                                className="w-full accent-indigo-600" />
                            </div>
                          </div>

                          {/* Financial summary */}
                          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-semibold text-gray-500 mb-3">השוואת כספים</p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                              {[
                                { label: 'הצעת מחיר', val: c.quote_amount, color: 'text-gray-900' },
                                { label: 'בפועל + תוספות', val: actualWithExtras || null, color: overshoot > 0 ? 'text-red-600' : 'text-emerald-600' },
                                { label: 'מקדמה ששולמה', val: c.advance_amount, color: 'text-gray-700' },
                                { label: 'תשלומים שאושרו', val: paidTotal, color: 'text-gray-700' },
                              ].map(row => (
                                <div key={row.label} className="flex justify-between items-center py-1 border-b border-gray-100">
                                  <span className="text-xs text-gray-500">{row.label}</span>
                                  <span className={cn('text-sm font-semibold', row.color)}>{row.val != null ? formatNIS(row.val) : '—'}</span>
                                </div>
                              ))}
                            </div>
                            {overshoot > 0 && (
                              <div className="mt-2 px-3 py-2 bg-red-50 rounded-lg flex items-center gap-2">
                                <span className="material-symbols-rounded text-red-500 filled" style={{ fontSize: '1rem' }}>warning</span>
                                <span className="text-xs text-red-600 font-medium">חריגה של {formatNIS(overshoot)} מעל ההצעה</span>
                              </div>
                            )}
                          </div>

                          {/* Editable financial fields */}
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { key: 'quote_amount', label: 'הצעת מחיר (₪)' },
                              { key: 'actual_amount', label: 'בפועל (₪)' },
                              { key: 'advance_amount', label: 'מקדמה (₪)' },
                            ].map(f => (
                              <div key={f.key}>
                                <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                                <input type="number"
                                  defaultValue={(c as unknown as Record<string, unknown>)[f.key] as number ?? ''}
                                  onBlur={e => updateField(c.id, f.key, e.target.value ? parseFloat(e.target.value) : null)}
                                  placeholder="0"
                                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                              </div>
                            ))}
                          </div>

                          {/* Timeline */}
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { key: 'start_date', label: 'התחלה' },
                              { key: 'planned_end_date', label: 'סיום מתוכנן' },
                              { key: 'actual_end_date', label: 'סיום בפועל' },
                            ].map(f => (
                              <div key={f.key}>
                                <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                                <input type="date"
                                  defaultValue={(c as unknown as Record<string, unknown>)[f.key] as string ?? ''}
                                  onBlur={e => updateField(c.id, f.key, e.target.value || null)}
                                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                              </div>
                            ))}
                          </div>

                          {/* Rating */}
                          <div>
                            <label className="text-xs text-gray-400 mb-1.5 block">דירוג אישי</label>
                            <div className="flex gap-1">
                              {[1,2,3,4,5].map(star => (
                                <button key={star} onClick={() => updateField(c.id, 'rating', star)}
                                  className={cn('text-2xl transition-transform hover:scale-110',
                                    (c.rating ?? 0) >= star ? 'text-amber-400' : 'text-gray-200')}>
                                  ★
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Notes */}
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">הערות</label>
                            <textarea defaultValue={c.notes ?? ''}
                              onBlur={e => updateField(c.id, 'notes', e.target.value || null)}
                              rows={2} placeholder="הערות כלליות..."
                              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                          </div>
                        </div>
                      )}

                      {/* ── TAB: Payments ── */}
                      {tab === 'payments' && (
                        <div className="space-y-3">
                          {/* Advance section */}
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-semibold text-blue-700">מקדמה</p>
                                <p className="text-sm font-bold text-blue-900">
                                  {c.advance_amount ? formatNIS(c.advance_amount) : 'לא הוגדרה'}
                                </p>
                              </div>
                              {(() => {
                                const advPay = (c.payments ?? []).find(p => p.label === 'מקדמה')
                                return advPay?.is_paid ? (
                                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold bg-emerald-100 px-2.5 py-1 rounded-full">
                                    <span className="material-symbols-rounded filled" style={{ fontSize: '0.85rem' }}>check_circle</span>
                                    שולמה {advPay.paid_date ?? ''}
                                  </span>
                                ) : c.advance_amount ? (
                                  <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">טרם שולמה</span>
                                ) : null
                              })()}
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">סדר תשלומים</p>
                            <button onClick={() => openAddPaymentForm(c.id)}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
                              <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>add</span>
                              הוסף תשלום
                            </button>
                          </div>

                          {/* Add Payment inline form */}
                          {addPaymentForm?.contractorId === c.id && (
                            <div className="bg-gray-50 rounded-xl p-3 space-y-2.5 border border-gray-200">
                              <p className="text-xs font-semibold text-gray-600">תשלום חדש</p>
                              <input
                                value={addPaymentForm.label}
                                onChange={e => setAddPaymentForm(f => f ? { ...f, label: e.target.value } : null)}
                                placeholder="שם השלב (מקדמה, יציקה, גמר...)"
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <input type="number"
                                    value={addPaymentForm.amount}
                                    onChange={e => setAddPaymentForm(f => f ? { ...f, amount: e.target.value } : null)}
                                    placeholder="סכום (₪)"
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                  />
                                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                                    <input type="checkbox" checked={addPaymentForm.vat_included}
                                      onChange={e => setAddPaymentForm(f => f ? { ...f, vat_included: e.target.checked } : null)}
                                      className="w-3.5 h-3.5 rounded accent-indigo-600" />
                                    <span className="text-[11px] text-gray-400">
                                      כולל מע"מ ({vatRate}%)
                                      {!addPaymentForm.vat_included && addPaymentForm.amount && (
                                        <span className="text-indigo-500"> +{formatNIS(Math.round(parseFloat(addPaymentForm.amount || '0') * vatRate / 100))}</span>
                                      )}
                                    </span>
                                  </label>
                                </div>
                                <div>
                                  <label className="text-[11px] text-gray-400 mb-1 block">תאריך יעד לתשלום</label>
                                  <input type="date"
                                    value={addPaymentForm.due_date}
                                    onChange={e => setAddPaymentForm(f => f ? { ...f, due_date: e.target.value } : null)}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={submitAddPayment}
                                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">
                                  שמור תשלום
                                </button>
                                <button onClick={() => setAddPaymentForm(null)}
                                  className="px-4 py-2 rounded-xl text-xs text-gray-500 hover:bg-gray-100">
                                  ביטול
                                </button>
                              </div>
                            </div>
                          )}

                          {(c.payments ?? []).length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">אין תשלומים. לחץ "הוסף תשלום" להתחיל.</p>
                          ) : (
                            <div className="space-y-2">
                              {(c.payments ?? []).map(pay => {
                                const dueDateMatch = pay.notes?.match(/תאריך יעד: (\d{4}-\d{2}-\d{2})/)
                                const dueDate = dueDateMatch ? dueDateMatch[1] : null
                                const isOverduePay = dueDate && !pay.is_paid && new Date(dueDate) < new Date()
                                return (
                                  <div key={pay.id} className={cn('rounded-xl p-3 border flex items-center gap-3',
                                    pay.is_paid ? 'bg-emerald-50 border-emerald-200' : isOverduePay ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200')}>
                                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                      pay.is_paid ? 'bg-emerald-100' : isOverduePay ? 'bg-red-100' : 'bg-gray-100')}>
                                      <span className={cn('material-symbols-rounded filled',
                                        pay.is_paid ? 'text-emerald-600' : isOverduePay ? 'text-red-500' : 'text-gray-400')}
                                        style={{ fontSize: '1rem' }}>
                                        {pay.is_paid ? 'check_circle' : isOverduePay ? 'warning' : 'radio_button_unchecked'}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900">{pay.label}</p>
                                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                        <span className="text-xs text-gray-500">{formatNIS(pay.amount)}</span>
                                        {pay.is_paid && pay.payment_method && (() => {
                                          const m = PAYMENT_METHODS.find(x => x.value === pay.payment_method)
                                          return m ? (
                                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', m.color)}>
                                              {m.label}
                                            </span>
                                          ) : null
                                        })()}
                                        {pay.paid_date && <span className="text-xs text-gray-400">• {pay.paid_date}</span>}
                                        {dueDate && !pay.is_paid && (
                                          <span className={cn('text-xs', isOverduePay ? 'text-red-500 font-medium' : 'text-gray-400')}>
                                            • יעד: {dueDate}{isOverduePay && ' ⚠'}
                                          </span>
                                        )}
                                        {pay.receipt_url && (
                                          <a href={pay.receipt_url} target="_blank" rel="noopener noreferrer"
                                            className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5">
                                            <span className="material-symbols-rounded" style={{ fontSize: '0.75rem' }}>receipt_long</span>קבלה
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    {!pay.is_paid && (
                                      <button onClick={() => openPreCheck(pay, c)}
                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 flex-shrink-0">
                                        אשר תשלום
                                      </button>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
                            <span className="text-gray-500">שולם:</span>
                            <span className="font-semibold text-emerald-600">{formatNIS(paidTotal)}</span>
                          </div>
                        </div>
                      )}

                      {/* ── TAB: Extras ── */}
                      {tab === 'extras' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">תוספות</p>
                            <button onClick={() => addExtra(c)}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
                              <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>add</span>
                              הוסף תוספת
                            </button>
                          </div>

                          {(c.extras ?? []).length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">אין תוספות לקבלן זה</p>
                          ) : (
                            <div className="space-y-2">
                              {(c.extras ?? []).map(ex => (
                                <div key={ex.id} className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-start gap-3">
                                  <span className="material-symbols-rounded text-orange-400 filled flex-shrink-0" style={{ fontSize: '1rem' }}>add_circle</span>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">{ex.description}</p>
                                    {ex.amount && <p className="text-xs text-orange-600 font-semibold mt-0.5">{formatNIS(ex.amount)}</p>}
                                    {ex.approved_by && <p className="text-xs text-gray-400 mt-0.5">אישר: {ex.approved_by}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {extrasTotal > 0 && (
                            <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
                              <span className="text-gray-500">סה"כ תוספות:</span>
                              <span className="font-semibold text-orange-600">{formatNIS(extrasTotal)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── TAB: Files ── */}
                      {tab === 'files' && (
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-gray-700">חוזה ומסמכים</p>

                          {/* Contract */}
                          {c.contract_url ? (
                            <a href={c.contract_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors">
                              <span className="material-symbols-rounded text-emerald-600 filled" style={{ fontSize: '1.2rem' }}>description</span>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-emerald-700">חוזה חתום</p>
                                <p className="text-xs text-emerald-500">פתח מסמך</p>
                              </div>
                              <span className="material-symbols-rounded text-emerald-400" style={{ fontSize: '0.9rem' }}>open_in_new</span>
                            </a>
                          ) : (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-rounded text-red-500 filled" style={{ fontSize: '1rem' }}>warning</span>
                                <p className="text-sm font-medium text-red-600">אין חוזה — סיכון!</p>
                              </div>
                              <button onClick={() => openContractUpload(c.id)}
                                disabled={uploading === c.id}
                                className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800">
                                <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>upload</span>
                                {uploading === c.id ? 'מעלה...' : 'העלה חוזה'}
                              </button>
                            </div>
                          )}

                          {c.contract_url && (
                            <button onClick={() => openContractUpload(c.id)}
                              disabled={uploading === c.id}
                              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                              <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>upload</span>
                              {uploading === c.id ? 'מעלה...' : 'החלף חוזה'}
                            </button>
                          )}

                          {/* Risk checklist */}
                          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                            <p className="text-xs font-semibold text-gray-500">מדד סיכון</p>
                            {[
                              { ok: !!c.contract_url, text: 'חוזה חתום קיים' },
                              { ok: !c.quote_amount || actualWithExtras <= c.quote_amount * 1.1, text: 'ללא חריגת תקציב' },
                              { ok: overdue <= 0 || c.status === 'completed', text: 'עומד בלוח זמנים' },
                            ].map((item, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className={cn('material-symbols-rounded filled', item.ok ? 'text-emerald-500' : 'text-red-400')}
                                  style={{ fontSize: '1rem' }}>
                                  {item.ok ? 'check_circle' : 'cancel'}
                                </span>
                                <span className={cn('text-xs', item.ok ? 'text-gray-500' : 'text-red-500 font-medium')}>{item.text}</span>
                              </div>
                            ))}
                            <div className={cn('mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-center', riskCfg.bg, riskCfg.color)}>
                              רמת סיכון: {riskCfg.label}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pre-payment check modal */}
      {preCheckModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setPreCheckModal(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-rounded text-indigo-600 filled" style={{ fontSize: '1.2rem' }}>fact_check</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">אישור תשלום</p>
                <p className="text-xs text-gray-400">{preCheckModal.contractor.name} — {preCheckModal.payment.label}</p>
              </div>
              <p className="mr-auto font-bold text-indigo-700">{formatNIS(preCheckModal.payment.amount)}</p>
            </div>

            <div className="p-5 space-y-4">
              {/* Checklist */}
              <div className="space-y-2.5">
                {[
                  { key: 'work_done',      label: 'העבודה בוצעה במלואה?' },
                  { key: 'work_inspected', label: 'נבדקה ואושרה?' },
                  { key: 'no_overruns',    label: 'אין חריגות לא מוסכמות?' },
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                    <div onClick={() => setPreChecks(p => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }))}
                      className={cn('w-5 h-5 rounded flex items-center justify-center border-2 transition-all flex-shrink-0',
                        preChecks[item.key as keyof typeof preChecks]
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'border-gray-300 group-hover:border-indigo-400')}>
                      {preChecks[item.key as keyof typeof preChecks] && (
                        <span className="material-symbols-rounded text-white" style={{ fontSize: '0.8rem' }}>check</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-700">{item.label}</span>
                  </label>
                ))}
              </div>

              {/* Payment Method */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">אמצעי תשלום</p>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m.value}
                      onClick={() => setPreCheckModal(pm => pm ? { ...pm, method: m.value } : null)}
                      className={cn('flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all',
                        preCheckModal.method === m.value ? m.color + ' border-current' : 'border-gray-200 text-gray-400 hover:bg-gray-50')}>
                      <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Date */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">תאריך תשלום</label>
                <input type="date"
                  value={preCheckModal.paid_date}
                  onChange={e => setPreCheckModal(pm => pm ? { ...pm, paid_date: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              {/* Receipt Upload */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">קבלה / אסמכתא</p>
                {preCheckModal.receipt_url ? (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="material-symbols-rounded text-emerald-600 filled" style={{ fontSize: '1rem' }}>receipt_long</span>
                    <span className="text-xs text-emerald-700 flex-1">קבלה הועלתה</span>
                    <a href={preCheckModal.receipt_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-emerald-600 hover:underline">פתח</a>
                    <button onClick={() => setPreCheckModal(pm => pm ? { ...pm, receipt_url: null } : null)}
                      className="text-gray-400 hover:text-red-500">
                      <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>close</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => paymentReceiptRef.current?.click()}
                    disabled={preCheckModal.receipt_uploading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  >
                    {preCheckModal.receipt_uploading ? (
                      <><div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />מעלה...</>
                    ) : (
                      <><span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>upload_file</span>העלה קבלה / אסמכתא (אופציונלי)</>
                    )}
                  </button>
                )}
                <input ref={paymentReceiptRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleReceiptUpload} className="hidden" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 p-5 pt-0">
              <button
                onClick={approvePayment}
                disabled={!preChecks.work_done || !preChecks.work_inspected || !preChecks.no_overruns}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                אשר תשלום ✓
              </button>
              <button onClick={() => setPreCheckModal(null)}
                className="px-4 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
