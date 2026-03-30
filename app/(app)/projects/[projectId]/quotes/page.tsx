'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatNIS } from '@/components/shared/CurrencyDisplay'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Quote, QuoteCategory, QuoteStatus } from '@/lib/types/database.types'
import { useAuth } from '@/lib/hooks/useAuth'
import { useVatRate } from '@/lib/hooks/useVatRate'
import Link from 'next/link'

const CATEGORIES: { value: QuoteCategory; label: string; icon: string }[] = [
  { value: 'land', label: 'מגרש', icon: 'landscape' },
  { value: 'planning', label: 'תכנון ואדריכלות', icon: 'architecture' },
  { value: 'excavation', label: 'עבודות עפר', icon: 'excavator' },
  { value: 'concrete', label: 'בטון ושלד', icon: 'foundation' },
  { value: 'structure', label: 'שלד ובנייה', icon: 'construction' },
  { value: 'plumbing', label: 'אינסטלציה', icon: 'plumbing' },
  { value: 'electrical', label: 'חשמל', icon: 'electrical_services' },
  { value: 'drywall', label: 'גבס וגבסית', icon: 'straighten' },
  { value: 'flooring', label: 'ריצוף וחיפויים', icon: 'grid_on' },
  { value: 'aluminum', label: 'אלומיניום', icon: 'window' },
  { value: 'kitchen', label: 'מטבח', icon: 'kitchen' },
  { value: 'painting', label: 'צביעה', icon: 'format_paint' },
  { value: 'other', label: 'אחר', icon: 'more_horiz' },
]

const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'ממתין', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: 'pending' },
  approved: { label: 'מאושר', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: 'check_circle' },
  rejected: { label: 'נדחה', color: 'text-red-500', bg: 'bg-red-50 border-red-200', icon: 'cancel' },
}

interface QuoteForm {
  category: QuoteCategory
  contractor_name: string
  amount: string
  vat_included: boolean
  notes: string
  document_name: string
  document_url: string
}

const emptyForm: QuoteForm = {
  category: 'structure',
  contractor_name: '',
  amount: '',
  vat_included: true,
  notes: '',
  document_name: '',
  document_url: '',
}

export default function QuotesPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { role } = useAuth()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [project, setProject] = useState<{ name: string; total_budget?: number; vat_rate?: number } | null>(null)
  const { vatRate, applyVat } = useVatRate(project?.vat_rate)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<QuoteForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState<QuoteCategory | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<QuoteStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editingStatus, setEditingStatus] = useState<string | null>(null)
  const [contractorModal, setContractorModal] = useState<{ quote: Quote; phone: string; advance_pct: string } | null>(null)
  const [creatingContractor, setCreatingContractor] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [projectId])

  async function load() {
    const [{ data: proj }, { data: quotesData }] = await Promise.all([
      supabase.from('projects').select('name, total_budget, vat_rate').eq('id', projectId).single(),
      supabase.from('quotes').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    ])
    setProject(proj)
    setQuotes(quotesData ?? [])
    setLoading(false)
  }

  const approvedQuotes = quotes.filter(q => q.status === 'approved')
  const approvedTotal = approvedQuotes.reduce((s, q) => s + (q.amount ?? 0), 0)
  const pendingTotal = quotes.filter(q => q.status === 'pending').reduce((s, q) => s + (q.amount ?? 0), 0)
  const budgetRemaining = (project?.total_budget ?? 0) - approvedTotal

  const filtered = quotes.filter(q => {
    if (filterCategory !== 'all' && q.category !== filterCategory) return false
    if (filterStatus !== 'all' && q.status !== filterStatus) return false
    return true
  })

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `quotes/${projectId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('build-manager-files').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('build-manager-files').getPublicUrl(path)
      setForm(f => ({ ...f, document_url: publicUrl, document_name: file.name }))
      toast.success('המסמך הועלה בהצלחה')
    } catch {
      toast.error('שגיאה בהעלאת המסמך')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!form.contractor_name && !form.amount) {
      toast.error('נא למלא לפחות שם קבלן או סכום')
      return
    }
    setSaving(true)
    try {
      const rawAmount = form.amount ? parseFloat(form.amount) : null
      const finalAmount = rawAmount != null ? Math.round(applyVat(rawAmount, form.vat_included)) : null
      const { data, error } = await supabase.from('quotes').insert({
        project_id: projectId,
        category: form.category,
        contractor_name: form.contractor_name || null,
        amount: finalAmount,
        notes: form.notes || null,
        document_url: form.document_url || null,
        document_name: form.document_name || null,
        status: 'pending',
      }).select().single()
      if (error) throw error
      setQuotes(prev => [data, ...prev])
      setShowForm(false)
      setForm(emptyForm)
      toast.success('הצעת המחיר נוספה')
    } catch {
      toast.error('שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(quoteId: string, newStatus: QuoteStatus) {
    const prev = [...quotes]
    setQuotes(q => q.map(x => x.id === quoteId ? { ...x, status: newStatus } : x))
    setEditingStatus(null)
    const { error } = await supabase.from('quotes').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', quoteId)
    if (error) {
      setQuotes(prev)
      toast.error('שגיאה בעדכון סטטוס')
    } else {
      toast.success(newStatus === 'approved' ? 'ההצעה אושרה ✓' : newStatus === 'rejected' ? 'ההצעה נדחתה' : 'הסטטוס עודכן')
      if (newStatus === 'approved') {
        const quote = quotes.find(q => q.id === quoteId)
        if (quote) setContractorModal({ quote, phone: '', advance_pct: '30' })
      }
    }
  }

  async function createContractorFromQuote() {
    if (!contractorModal) return
    const { quote, phone, advance_pct } = contractorModal
    setCreatingContractor(true)
    try {
      const advancePct = parseFloat(advance_pct) || 0
      const advanceAmount = quote.amount && advancePct > 0 ? Math.round(quote.amount * advancePct / 100) : null
      const catToTrade: Record<string, string> = {
        land: 'מגרש', planning: 'תכנון', excavation: 'עבודות עפר',
        concrete: 'בטון ושלד', structure: 'שלד ובנייה', plumbing: 'אינסטלציה',
        electrical: 'חשמל', drywall: 'גבסן', flooring: 'ריצוף',
        aluminum: 'אלומיניום', kitchen: 'מטבחים', painting: 'צבע', other: 'אחר',
      }
      // נסה עם העמודות החדשות, אם לא — ללא advance_amount
      let contractor = null
      const baseCtr = {
        project_id: projectId,
        name: quote.contractor_name || catToTrade[quote.category] || 'קבלן',
        trade: catToTrade[quote.category] || null,
        phone: phone || null,
        quote_amount: quote.amount ?? null,
        status: 'not_started',
        progress_pct: 0,
      }
      const { data: d1, error: e1 } = await supabase.from('contractors').insert({
        ...baseCtr, advance_amount: advanceAmount,
      }).select().single()
      if (e1) {
        // fallback without advance_amount
        const { data: d2, error: e2 } = await supabase.from('contractors').insert(baseCtr).select().single()
        if (e2) { toast.error(`שגיאה: ${e2.message}`); setCreatingContractor(false); return }
        contractor = d2
      } else {
        contractor = d1
      }
      if (advanceAmount && contractor) {
        await supabase.from('contractor_payments').insert({
          contractor_id: contractor.id,
          project_id: projectId,
          label: 'מקדמה',
          amount: advanceAmount,
          is_paid: false,
          pre_check_done: false,
        })
      }
      setContractorModal(null)
      toast.success('הקבלן נוצר! עבור לניהול קבלנים לניהול תשלומים.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה'
      toast.error(`שגיאה: ${msg}`)
    } finally {
      setCreatingContractor(false)
    }
  }

  async function deleteQuote(quoteId: string) {
    const prev = quotes
    setQuotes(q => q.filter(x => x.id !== quoteId))
    setDeleteConfirmId(null)
    const { error } = await supabase.from('quotes').delete().eq('id', quoteId)
    if (error) {
      setQuotes(prev)
      toast.error('שגיאה במחיקה')
    }
  }

  const getCategoryLabel = (val: QuoteCategory) => CATEGORIES.find(c => c.value === val)?.label ?? val
  const getCategoryIcon = (val: QuoteCategory) => CATEGORIES.find(c => c.value === val)?.icon ?? 'help'

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-28 bg-gray-200 rounded-2xl" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ─── Create Contractor Modal ─── */}
      {contractorModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <span className="material-symbols-rounded text-emerald-600">engineering</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">הצעה אושרה — צור קבלן</h3>
                <p className="text-xs text-gray-400">צור קבלן אוטומטית מהצעה זו</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="text-xs text-gray-500">הצעה</p>
              <p className="font-semibold text-gray-900">{contractorModal.quote.contractor_name || getCategoryLabel(contractorModal.quote.category)}</p>
              {contractorModal.quote.amount && (
                <p className="text-sm text-indigo-600 font-medium">{formatNIS(contractorModal.quote.amount)}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">טלפון קבלן</label>
                <input
                  type="tel" dir="ltr"
                  value={contractorModal.phone}
                  onChange={e => setContractorModal(m => m ? { ...m, phone: e.target.value } : null)}
                  placeholder="050-0000000"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">מקדמה (%)</label>
                <input
                  type="number" min={0} max={100}
                  value={contractorModal.advance_pct}
                  onChange={e => setContractorModal(m => m ? { ...m, advance_pct: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                {contractorModal.quote.amount && (
                  <p className="text-xs text-gray-400 mt-1">
                    = {formatNIS(Math.round(contractorModal.quote.amount * (parseFloat(contractorModal.advance_pct || '0') / 100)))}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={createContractorFromQuote}
                disabled={creatingContractor}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {creatingContractor ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add_circle</span>
                )}
                צור קבלן
              </button>
              <button
                onClick={() => setContractorModal(null)}
                className="px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors"
              >
                דלג
              </button>
            </div>
            <Link href={`/projects/${projectId}/contractors`}
              className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors py-1">
              <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>engineering</span>
              לניהול קבלנים קיימים
            </Link>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">הצעות מחיר</h1>
          <p className="text-sm text-gray-400 mt-0.5">{project?.name}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setExpandedId(null) }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>add</span>
          הצעה חדשה
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-rounded text-indigo-500 filled" style={{ fontSize: '1.1rem' }}>request_quote</span>
            <span className="text-xs text-gray-400">סה"כ הצעות</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{quotes.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-rounded text-emerald-500 filled" style={{ fontSize: '1.1rem' }}>check_circle</span>
            <span className="text-xs text-gray-400">מאושר</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">{formatNIS(approvedTotal)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-rounded text-amber-500 filled" style={{ fontSize: '1.1rem' }}>pending</span>
            <span className="text-xs text-gray-400">ממתין לאישור</span>
          </div>
          <p className="text-xl font-bold text-amber-600">{formatNIS(pendingTotal)}</p>
        </div>
        <div className={cn("rounded-2xl p-4 shadow-sm border", budgetRemaining < 0 ? "bg-red-50 border-red-100" : "bg-white border-gray-100")}>
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("material-symbols-rounded filled", budgetRemaining < 0 ? "text-red-500" : "text-blue-500")} style={{ fontSize: '1.1rem' }}>account_balance_wallet</span>
            <span className="text-xs text-gray-400">יתרת תקציב</span>
          </div>
          <p className={cn("text-xl font-bold", budgetRemaining < 0 ? "text-red-600" : "text-gray-900")}>
            {project?.total_budget ? formatNIS(budgetRemaining) : '—'}
          </p>
        </div>
      </div>

      {/* Budget bar */}
      {project?.total_budget && project.total_budget > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>הצעות מאושרות מתוך תקציב</span>
            <span>{Math.round((approvedTotal / project.total_budget) * 100)}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", approvedTotal > project.total_budget ? "bg-red-500" : "bg-emerald-500")}
              style={{ width: `${Math.min((approvedTotal / project.total_budget) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1.5">
            <span>מאושר: {formatNIS(approvedTotal)}</span>
            <span>תקציב: {formatNIS(project.total_budget)}</span>
          </div>
        </div>
      )}

      {/* New Quote Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">הצעת מחיר חדשה</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <span className="material-symbols-rounded" style={{ fontSize: '1.2rem' }}>close</span>
            </button>
          </div>
          <div className="p-5 space-y-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">קטגוריה</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                    className={cn(
                      "flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-xs font-medium transition-all",
                      form.category === cat.value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '1.2rem' }}>{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Contractor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">שם קבלן / ספק</label>
                <input
                  type="text"
                  value={form.contractor_name}
                  onChange={e => setForm(f => ({ ...f, contractor_name: e.target.value }))}
                  placeholder="למשל: דוד אינסטלציה בעמ"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">סכום ההצעה (₪)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.vat_included}
                    onChange={e => setForm(f => ({ ...f, vat_included: e.target.checked }))}
                    className="w-4 h-4 rounded accent-indigo-600"
                  />
                  <span className="text-xs text-gray-500">
                    כולל מע"מ {!form.vat_included && form.amount
                      ? <span className="text-indigo-600 font-medium">← יתווסף {vatRate}% ({formatNIS(Math.round(parseFloat(form.amount || '0') * vatRate / 100))})</span>
                      : `(${vatRate}%)`}
                  </span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">הערות</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="פרטים נוספים על ההצעה, תנאים, גרסאות שונות..."
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>

            {/* Document Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">קובץ ההצעה</label>
              {form.document_url ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="material-symbols-rounded text-emerald-600 filled" style={{ fontSize: '1.2rem' }}>description</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-700 truncate">{form.document_name}</p>
                    <p className="text-xs text-emerald-500">הועלה בהצלחה</p>
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, document_url: '', document_name: '' }))} className="text-emerald-400 hover:text-red-500">
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>close</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  {uploading ? (
                    <><div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />מעלה...</>
                  ) : (
                    <><span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>upload_file</span>העלה מסמך PDF / תמונה</>
                  )}
                </button>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} className="hidden" />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                שמור הצעה
              </button>
              <button onClick={() => { setShowForm(false); setForm(emptyForm) }} className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as QuoteStatus | 'all')}
          className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="pending">ממתין</option>
          <option value="approved">מאושר</option>
          <option value="rejected">נדחה</option>
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value as QuoteCategory | 'all')}
          className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        >
          <option value="all">כל הקטגוריות</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <span className="flex items-center text-xs text-gray-400 mr-auto">{filtered.length} הצעות</span>
      </div>

      {/* Quotes List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <span className="material-symbols-rounded text-gray-300 filled" style={{ fontSize: '3rem' }}>request_quote</span>
          <p className="text-gray-500 mt-3 font-medium">אין הצעות מחיר עדיין</p>
          <p className="text-gray-400 text-sm mt-1">לחץ על "הצעה חדשה" כדי להוסיף את הראשונה</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(quote => {
            const status = STATUS_CONFIG[quote.status]
            const isExpanded = expandedId === quote.id
            const catIcon = getCategoryIcon(quote.category as QuoteCategory)
            const catLabel = getCategoryLabel(quote.category as QuoteCategory)

            return (
              <div key={quote.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : quote.id)}
                >
                  {/* Category icon */}
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-rounded text-indigo-500" style={{ fontSize: '1.2rem' }}>{catIcon}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm truncate">{quote.contractor_name || catLabel}</p>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1", status.bg, status.color)}>
                        <span className="material-symbols-rounded filled" style={{ fontSize: '0.75rem' }}>{status.icon}</span>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{catLabel}</p>
                  </div>

                  {/* Amount */}
                  <div className="text-left flex-shrink-0">
                    {quote.amount ? (
                      <p className="font-bold text-gray-900 text-sm">{formatNIS(quote.amount)}</p>
                    ) : (
                      <p className="text-xs text-gray-400">ללא סכום</p>
                    )}
                  </div>

                  <span className="material-symbols-rounded text-gray-400" style={{ fontSize: '1rem' }}>
                    {isExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                    {quote.notes && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 font-medium mb-1">הערות</p>
                        <p className="text-sm text-gray-700">{quote.notes}</p>
                      </div>
                    )}

                    {quote.document_url && (
                      <a
                        href={quote.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors"
                      >
                        <span className="material-symbols-rounded text-blue-500 filled" style={{ fontSize: '1.1rem' }}>description</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-700 truncate">{quote.document_name || 'הצעת מחיר'}</p>
                          <p className="text-xs text-blue-500">פתח קובץ</p>
                        </div>
                        <span className="material-symbols-rounded text-blue-400" style={{ fontSize: '0.9rem' }}>open_in_new</span>
                      </a>
                    )}

                    {/* Status actions (admin only or all?) */}
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">שנה סטטוס</p>
                      <div className="flex gap-2">
                        {(['pending', 'approved', 'rejected'] as QuoteStatus[]).map(s => {
                          const sc = STATUS_CONFIG[s]
                          return (
                            <button
                              key={s}
                              onClick={() => updateStatus(quote.id, s)}
                              disabled={quote.status === s}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all",
                                quote.status === s
                                  ? cn(sc.bg, sc.color, "border-current")
                                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
                              )}
                            >
                              <span className="material-symbols-rounded filled" style={{ fontSize: '0.9rem' }}>{sc.icon}</span>
                              {sc.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => setDeleteConfirmId(quote.id)}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>delete</span>
                        מחק
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-right">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-rounded text-red-500" style={{ fontSize: '1.4rem' }}>delete_forever</span>
              <p className="font-semibold text-gray-800">מחיקת הצעת מחיר</p>
            </div>
            <p className="text-gray-500 text-sm mb-5">האם למחוק את הצעת המחיר? פעולה זו לא ניתנת לביטול.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                בטל
              </button>
              <button
                onClick={() => deleteQuote(deleteConfirmId)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
