'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Doc {
  id: string
  name: string
  category: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  created_at: string
}

const CATS: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  plan:     { label: 'תוכניות בנייה',  icon: 'architecture',   color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200'    },
  permit:   { label: 'היתרים ואישורים', icon: 'gavel',          color: 'text-red-600',     bg: 'bg-red-50 border-red-200'      },
  receipt:  { label: 'קבלות ותשלומים', icon: 'receipt',        color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  contract: { label: 'חוזים',          icon: 'description',    color: 'text-orange-600',  bg: 'bg-orange-50 border-orange-200' },
  photo:    { label: 'תמונות אתר',     icon: 'photo_camera',   color: 'text-purple-600',  bg: 'bg-purple-50 border-purple-200' },
  other:    { label: 'אחר',            icon: 'folder',         color: 'text-gray-500',    bg: 'bg-gray-50 border-gray-200'    },
}

const DOC_TYPES = [
  { label: 'תוכנית אדריכלית',    icon: 'architecture',        category: 'plan',     desc: 'שרטוטים ותוכניות אדריכל'    },
  { label: 'תוכנית קונסטרוקציה', icon: 'foundation',          category: 'plan',     desc: 'תוכניות מהנדס שלד'           },
  { label: 'תוכנית חשמל',        icon: 'electrical_services', category: 'plan',     desc: 'תוכניות חשמל ותקשורת'        },
  { label: 'תוכנית אינסטלציה',   icon: 'plumbing',            category: 'plan',     desc: 'תוכניות מים וביוב'           },
  { label: 'היתר בנייה',         icon: 'gavel',               category: 'permit',   desc: 'היתר מהוועדה המקומית'        },
  { label: 'אישור היטל / אגרה',  icon: 'receipt_long',        category: 'permit',   desc: 'היטל השבחה, כיבוי אש, ביוב' },
  { label: 'אישור מהנדס / מפקח', icon: 'verified',            category: 'permit',   desc: 'אישור שלד, יסודות, גג'       },
  { label: 'מסמכי רמ"י',         icon: 'domain',              category: 'permit',   desc: 'רשות מקרקעי ישראל'           },
  { label: 'קבלה / חשבונית',     icon: 'receipt',             category: 'receipt',  desc: 'אישור תשלום לקבלן'           },
  { label: 'אישור תשלום בנקאי',  icon: 'account_balance',     category: 'receipt',  desc: 'אסמכתא להעברה בנקאית'        },
  { label: 'חוזה קבלן',          icon: 'description',         category: 'contract', desc: 'הסכם עבודה עם קבלן'          },
  { label: 'הצעת מחיר',          icon: 'request_quote',       category: 'contract', desc: 'הצעת מחיר מקבלן'             },
  { label: 'חוזה רכישת קרקע',    icon: 'home_work',           category: 'contract', desc: 'הסכם רכישה עם מוכר'          },
  { label: 'תמונת אתר',          icon: 'photo_camera',        category: 'photo',    desc: 'צילום התקדמות הבנייה'        },
  { label: 'מסמך אחר',           icon: 'folder',              category: 'other',    desc: 'כל מסמך אחר'                 },
]

function fmtSize(b: number | null) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fileIcon(mime: string | null) {
  if (!mime) return 'description'
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'picture_as_pdf'
  if (mime.includes('word')) return 'description'
  if (mime.includes('excel') || mime.includes('sheet')) return 'table_chart'
  return 'description'
}

export default function DocumentsPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params
  const { user } = useAuth()
  const supabase = createClient()

  const [docs, setDocs]         = useState<Doc[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  // Upload modal
  const [modalOpen, setModalOpen] = useState(false)
  const [docType,   setDocType]   = useState('')
  const [docName,   setDocName]   = useState('')
  const [file,      setFile]      = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { load() }, [projectId])

  async function load() {
    const { data } = await supabase
      .from('documents').select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (data) setDocs(data)
    setLoading(false)
  }

  function openModal() {
    setDocType(''); setDocName(''); setFile(null); setUploading(false)
    setModalOpen(true)
  }
  function closeModal() {
    setModalOpen(false)
    setDocType(''); setDocName(''); setFile(null); setUploading(false)
  }
  function onTypeSelected(dt: typeof DOC_TYPES[0]) {
    setDocType(dt.label)
    if (!docName || DOC_TYPES.some(d => d.label === docName)) setDocName(dt.label)
  }
  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!docName || DOC_TYPES.some(d => d.label === docName)) setDocName(f.name.replace(/\.[^.]+$/, ''))
    e.target.value = ''
  }

  async function handleUpload() {
    if (!file || !user || !docType) return
    setUploading(true)
    try {
      const cat = DOC_TYPES.find(d => d.label === docType)?.category ?? 'other'
      const ext = file.name.split('.').pop()
      const path = `documents/${projectId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('build-manager-files').upload(path, file)
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('build-manager-files').getPublicUrl(path)
      const { data: doc, error: dbErr } = await supabase.from('documents').insert({
        project_id: projectId, name: docName.trim() || file.name,
        category: cat, file_url: publicUrl,
        file_size: file.size, mime_type: file.type, uploaded_by: user.id,
      }).select().single()
      if (dbErr) throw dbErr
      if (doc) setDocs(prev => [doc, ...prev])
      toast.success('המסמך הועלה בהצלחה!')
      closeModal()
    } catch (err: any) {
      toast.error(`שגיאה: ${err?.message ?? 'נסה שוב'}`)
      setUploading(false)
    }
  }

  async function handleDelete(doc: Doc) {
    if (!confirm(`למחוק את "${doc.name}"?`)) return
    const { error } = await supabase.from('documents').delete().eq('id', doc.id)
    if (error) { toast.error('שגיאה במחיקה'); return }
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    toast.success('המסמך נמחק')
  }

  const filtered = useMemo(() => {
    let res = docs
    if (filter !== 'all') res = res.filter(d => d.category === filter)
    if (search.trim()) res = res.filter(d => d.name.toLowerCase().includes(search.trim().toLowerCase()))
    return res
  }, [docs, filter, search])

  if (loading) return (
    <div className="animate-pulse space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ══ Top bar ══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">מסמכים</h1>
          <p className="text-sm text-gray-400 mt-0.5">{docs.length} קבצים • {Object.keys(CATS).filter(k => docs.some(d => d.category === k)).length} קטגוריות</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity self-start sm:self-auto"
          style={{ backgroundColor: '#002045' }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>upload</span>
          העלה מסמך
        </button>
      </div>

      {/* ══ Category stats cards ══ */}
      {docs.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {Object.entries(CATS).map(([key, cat]) => {
            const count = docs.filter(d => d.category === key).length
            const active = filter === key
            return (
              <button
                key={key}
                onClick={() => setFilter(active ? 'all' : key)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all text-center',
                  count === 0 ? 'opacity-30 cursor-default' : 'cursor-pointer hover:shadow-sm',
                  active ? `${cat.bg} border-2` : 'bg-white border-gray-100'
                )}
                disabled={count === 0}
              >
                <span className={cn('material-symbols-rounded', active ? cat.color : 'text-gray-400')}
                  style={{ fontSize: '1.3rem' }}>{cat.icon}</span>
                <span className={cn('text-lg font-bold leading-none', active ? cat.color : 'text-gray-700')}>{count}</span>
                <span className="text-[10px] text-gray-400 leading-tight">{cat.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ══ Search + view toggle ══ */}
      {docs.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              style={{ fontSize: '1rem' }}>search</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש מסמך..."
              className="w-full pr-9 pl-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 text-right bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>close</span>
              </button>
            )}
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            <button onClick={() => setViewMode('list')}
              className={cn('p-1.5 rounded-md transition-colors', viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
              <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>list</span>
            </button>
            <button onClick={() => setViewMode('grid')}
              className={cn('p-1.5 rounded-md transition-colors', viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
              <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>grid_view</span>
            </button>
          </div>
        </div>
      )}

      {/* ══ Active filter chip ══ */}
      {filter !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">מסנן לפי:</span>
          <span className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border', CATS[filter]?.bg, CATS[filter]?.color)}>
            <span className="material-symbols-rounded" style={{ fontSize: '0.8rem' }}>{CATS[filter]?.icon}</span>
            {CATS[filter]?.label}
            <button onClick={() => setFilter('all')} className="mr-1 hover:opacity-70">
              <span className="material-symbols-rounded" style={{ fontSize: '0.8rem' }}>close</span>
            </button>
          </span>
          <span className="text-xs text-gray-400">{filtered.length} תוצאות</span>
        </div>
      )}

      {/* ══ Empty state ══ */}
      {docs.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-rounded text-gray-300" style={{ fontSize: '2.2rem' }}>folder_open</span>
          </div>
          <p className="text-gray-700 font-semibold text-lg">אין מסמכים עדיין</p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
            העלה חוזים, היתרים, תוכניות, קבלות ותמונות מהאתר
          </p>
          <button onClick={openModal}
            className="mt-5 px-6 py-3 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            style={{ backgroundColor: '#002045' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>upload</span>
            העלה מסמך ראשון
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
          <span className="material-symbols-rounded text-gray-200 block mb-2" style={{ fontSize: '2.5rem' }}>search_off</span>
          <p className="text-gray-500 font-medium">לא נמצאו מסמכים</p>
          <p className="text-sm text-gray-400 mt-1">נסה לשנות את החיפוש או הסנן</p>
          <button onClick={() => { setFilter('all'); setSearch('') }}
            className="mt-3 text-indigo-500 text-sm font-medium hover:underline">
            נקה סינון
          </button>
        </div>

      /* ══ LIST view ══ */
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {filtered.map(doc => {
            const cat = CATS[doc.category] ?? CATS.other
            const isImg = doc.mime_type?.startsWith('image/')
            return (
              <div key={doc.id}
                className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                {/* Icon */}
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border', cat.bg)}>
                  <span className={cn('material-symbols-rounded', cat.color)} style={{ fontSize: '1.2rem' }}>
                    {fileIcon(doc.mime_type)}
                  </span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-md border', cat.bg, cat.color)}>
                      {cat.label}
                    </span>
                    {doc.file_size && <span className="text-xs text-gray-400">{fmtSize(doc.file_size)}</span>}
                    <span className="text-xs text-gray-400">{fmtDate(doc.created_at)}</span>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                    title="פתח">
                    <span className="material-symbols-rounded text-gray-400" style={{ fontSize: '1rem' }}>open_in_new</span>
                  </a>
                  <a href={doc.file_url} download
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                    title="הורד">
                    <span className="material-symbols-rounded text-gray-400" style={{ fontSize: '1rem' }}>download</span>
                  </a>
                  <button onClick={() => handleDelete(doc)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                    title="מחק">
                    <span className="material-symbols-rounded text-gray-300 hover:text-red-400" style={{ fontSize: '1rem' }}>delete</span>
                  </button>
                </div>
                {/* Always-visible open link on mobile */}
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-400">
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>open_in_new</span>
                </a>
              </div>
            )
          })}
        </div>

      /* ══ GRID view ══ */
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(doc => {
            const cat = CATS[doc.category] ?? CATS.other
            const isImg = doc.mime_type?.startsWith('image/')
            return (
              <div key={doc.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                {/* Preview area */}
                {isImg ? (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={doc.file_url} alt={doc.name}
                      className="w-full h-32 object-cover bg-gray-100" />
                  </a>
                ) : (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className={cn('flex items-center justify-center h-32 border-b', cat.bg)}>
                    <span className={cn('material-symbols-rounded', cat.color)} style={{ fontSize: '2.5rem' }}>
                      {fileIcon(doc.mime_type)}
                    </span>
                  </a>
                )}
                {/* Card footer */}
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-800 truncate leading-snug">{doc.name}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', cat.bg, cat.color)}>
                      {cat.label}
                    </span>
                    <span className="text-[10px] text-gray-400">{fmtDate(doc.created_at)}</span>
                  </div>
                  {/* actions */}
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-50">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition-colors">
                      <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>open_in_new</span>
                      פתח
                    </a>
                    <a href={doc.file_url} download
                      className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition-colors">
                      <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>download</span>
                      הורד
                    </a>
                    <button onClick={() => handleDelete(doc)}
                      className="p-1 rounded-lg hover:bg-red-50 transition-colors">
                      <span className="material-symbols-rounded text-gray-300 hover:text-red-400" style={{ fontSize: '0.85rem' }}>delete</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════
          UPLOAD MODAL
      ══════════════════════════════════════ */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl overflow-hidden">

            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">העלאת מסמך</h2>
                <p className="text-xs text-gray-400 mt-0.5">בחר סוג, קובץ ושם</p>
              </div>
              <button onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                <span className="material-symbols-rounded text-gray-400" style={{ fontSize: '1.2rem' }}>close</span>
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">

              {/* Step 1 — type */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  שלב 1 — סוג מסמך
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DOC_TYPES.map(dt => {
                    const sel = docType === dt.label
                    return (
                      <button key={dt.label} type="button" onClick={() => onTypeSelected(dt)}
                        className={cn(
                          'flex items-start gap-2.5 p-3 rounded-xl border-2 text-right transition-all w-full',
                          sel ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                        )}>
                        <span className={cn('material-symbols-rounded flex-shrink-0 mt-0.5',
                          sel ? 'text-indigo-600' : 'text-gray-400')} style={{ fontSize: '1.1rem' }}>
                          {dt.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-xs font-semibold leading-snug', sel ? 'text-indigo-700' : 'text-gray-700')}>
                            {dt.label}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{dt.desc}</p>
                        </div>
                        {sel && (
                          <span className="material-symbols-rounded text-indigo-500 flex-shrink-0" style={{ fontSize: '1rem' }}>check_circle</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Step 2 — file */}
              {docType && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    שלב 2 — בחר קובץ
                  </p>
                  <label className={cn(
                    'flex items-center justify-center gap-2 w-full py-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                    file
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600'
                  )}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1.4rem' }}>
                      {file ? 'check_circle' : 'upload_file'}
                    </span>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{file ? file.name : 'לחץ לבחירת קובץ'}</p>
                      {!file && <p className="text-xs opacity-60">PDF, Word, Excel, תמונות</p>}
                      {file && <p className="text-xs opacity-60">{fmtSize(file.size)}</p>}
                    </div>
                    <input type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.dwg"
                      className="sr-only" onChange={onFileChosen} />
                  </label>
                </div>
              )}

              {/* Step 3 — name */}
              {file && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    שלב 3 — שם המסמך
                  </p>
                  <input type="text" value={docName} onChange={e => setDocName(e.target.value)}
                    placeholder="לדוגמה: תוכנית אדריכלית שלב א'"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={handleUpload}
                  disabled={uploading || !docType || !file}
                  className={cn(
                    'flex-1 py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all',
                    (!docType || !file || uploading) ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'
                  )}
                  style={{ backgroundColor: '#002045' }}>
                  {uploading ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> מעלה...</>
                  ) : (
                    <><span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>upload</span> העלה מסמך</>
                  )}
                </button>
                <button type="button" onClick={closeModal} disabled={uploading}
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
