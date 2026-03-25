'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Post {
  id: string
  title: string
  body: string
  stage_tag: string | null
  post_type: 'question' | 'tip' | 'problem'
  likes: number
  answers_count: number
  created_at: string
  user_id: string
  author_name: string | null
}

interface Answer {
  id: string
  post_id: string
  body: string
  likes: number
  created_at: string
  author_name: string | null
}

const STAGE_TAGS = ['כולם', 'מגרש', 'היתר בנייה', 'שלד', 'גמר', 'ספקים', 'תקציב', 'אחר']
const POST_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  question: { label: 'שאלה', icon: 'help', color: 'text-blue-600 bg-blue-50' },
  tip: { label: 'טיפ', icon: 'lightbulb', color: 'text-emerald-600 bg-emerald-50' },
  problem: { label: 'בעיה', icon: 'warning', color: 'text-orange-600 bg-orange-50' },
}

export default function CommunityPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTag, setActiveTag] = useState('כולם')
  const [showForm, setShowForm] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [form, setForm] = useState({ title: '', body: '', stage_tag: 'אחר', post_type: 'question' as const })
  const [submitting, setSubmitting] = useState(false)
  const [answerText, setAnswerText] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState(false)

  useEffect(() => { loadPosts() }, [activeTag])

  async function loadPosts() {
    setLoading(true)
    let query = supabase.from('community_posts').select('*').order('created_at', { ascending: false })
    if (activeTag !== 'כולם') query = query.eq('stage_tag', activeTag)
    const { data } = await query
    if (data) setPosts(data)
    setLoading(false)
  }

  async function loadAnswers(postId: string) {
    const { data } = await supabase.from('community_answers').select('*').eq('post_id', postId).order('likes', { ascending: false })
    if (data) setAnswers(data)
  }

  async function openPost(post: Post) {
    setSelectedPost(post)
    await loadAnswers(post.id)
  }

  async function submitPost() {
    if (!user || !form.title.trim() || !form.body.trim()) return
    setSubmitting(true)
    const { data, error } = await supabase.from('community_posts').insert({
      title: form.title.trim(),
      body: form.body.trim(),
      stage_tag: form.stage_tag,
      post_type: form.post_type,
      user_id: user.id,
      author_name: user.email?.split('@')[0] ?? 'משתמש',
      likes: 0,
      answers_count: 0,
    }).select().single()
    if (error) { toast.error('שגיאה בפרסום'); setSubmitting(false); return }
    if (data) setPosts(prev => [data, ...prev])
    setForm({ title: '', body: '', stage_tag: 'אחר', post_type: 'question' })
    setShowForm(false)
    toast.success('הפוסט פורסם!')
    setSubmitting(false)
  }

  async function submitAnswer() {
    if (!user || !answerText.trim() || !selectedPost) return
    setSubmittingAnswer(true)
    const { data, error } = await supabase.from('community_answers').insert({
      post_id: selectedPost.id,
      body: answerText.trim(),
      user_id: user.id,
      author_name: user.email?.split('@')[0] ?? 'משתמש',
      likes: 0,
    }).select().single()
    if (error) { toast.error('שגיאה בשליחה'); setSubmittingAnswer(false); return }
    if (data) setAnswers(prev => [...prev, data])
    setAnswerText('')
    toast.success('תשובה נשלחה!')
    setSubmittingAnswer(false)
  }

  async function likePost(post: Post) {
    await supabase.from('community_posts').update({ likes: (post.likes ?? 0) + 1 }).eq('id', post.id)
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: (p.likes ?? 0) + 1 } : p))
    if (selectedPost?.id === post.id) setSelectedPost(p => p ? { ...p, likes: (p.likes ?? 0) + 1 } : p)
  }

  async function likeAnswer(answer: Answer) {
    await supabase.from('community_answers').update({ likes: (answer.likes ?? 0) + 1 }).eq('id', answer.id)
    setAnswers(prev => prev.map(a => a.id === answer.id ? { ...a, likes: (a.likes ?? 0) + 1 } : a))
  }

  if (selectedPost) {
    const pt = POST_TYPES[selectedPost.post_type]
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={() => setSelectedPost(null)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>arrow_forward</span>
          חזרה לקהילה
        </button>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1', pt.color)}>
                  <span className="material-symbols-rounded filled" style={{ fontSize: '0.75rem' }}>{pt.icon}</span>
                  {pt.label}
                </span>
                {selectedPost.stage_tag && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{selectedPost.stage_tag}</span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{selectedPost.title}</h2>
              <p className="text-sm text-gray-400 mt-1">{selectedPost.author_name} • {new Date(selectedPost.created_at).toLocaleDateString('he-IL')}</p>
            </div>
            <button onClick={() => likePost(selectedPost)} className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-indigo-600 transition-colors">
              <span className="material-symbols-rounded" style={{ fontSize: '1.3rem' }}>favorite</span>
              <span className="text-xs font-medium">{selectedPost.likes}</span>
            </button>
          </div>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedPost.body}</p>
        </div>

        {/* Answers */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-500">{answers.length} תשובות</p>
          {answers.map(ans => (
            <div key={ans.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-2">{ans.author_name} • {new Date(ans.created_at).toLocaleDateString('he-IL')}</p>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{ans.body}</p>
                </div>
                <button onClick={() => likeAnswer(ans)} className="flex flex-col items-center gap-0.5 text-gray-300 hover:text-indigo-500 transition-colors flex-shrink-0">
                  <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>thumb_up</span>
                  <span className="text-xs">{ans.likes}</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Write answer */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-3">כתוב תשובה</p>
          <textarea
            value={answerText}
            onChange={e => setAnswerText(e.target.value)}
            placeholder="שתף מניסיונך..."
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-indigo-400 bg-gray-50"
          />
          <button onClick={submitAnswer} disabled={submittingAnswer || !answerText.trim()}
            className="mt-2 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: '#002045' }}>
            {submittingAnswer ? 'שולח...' : 'פרסם תשובה'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">קהילה</h1>
          <p className="text-sm text-gray-400 mt-0.5">שאל שאלות, שתף ניסיון, קבל עזרה מאנשים באותו שלב</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium shadow-sm"
          style={{ backgroundColor: '#002045' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add</span>
          פרסם שאלה
        </button>
      </div>

      {/* New post form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-100">
          <h3 className="font-semibold text-gray-800 mb-4">פוסט חדש</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(POST_TYPES).map(([type, cfg]) => (
                <button key={type} onClick={() => setForm(f => ({ ...f, post_type: type as any }))}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all',
                    form.post_type === type ? cn(cfg.color, 'border-current/20') : 'border-gray-100 bg-gray-50 text-gray-500')}>
                  <span className="material-symbols-rounded filled" style={{ fontSize: '0.9rem' }}>{cfg.icon}</span>
                  {cfg.label}
                </button>
              ))}
            </div>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="כותרת (למשל: איך בוחרים מפקח בנייה?)"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 bg-gray-50" />
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="פרט את השאלה / הבעיה / הטיפ שלך..."
              rows={4} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-indigo-400 bg-gray-50" />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">שלב רלוונטי</label>
              <div className="flex flex-wrap gap-2">
                {STAGE_TAGS.slice(1).map(tag => (
                  <button key={tag} onClick={() => setForm(f => ({ ...f, stage_tag: tag }))}
                    className={cn('px-3 py-1 rounded-full text-xs font-medium transition-all border',
                      form.stage_tag === tag ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 bg-gray-50')}
                    style={form.stage_tag === tag ? { backgroundColor: '#002045' } : {}}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={submitPost} disabled={submitting || !form.title.trim() || !form.body.trim()}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-40"
                style={{ backgroundColor: '#002045' }}>
                {submitting ? 'מפרסם...' : 'פרסם'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STAGE_TAGS.map(tag => (
          <button key={tag} onClick={() => setActiveTag(tag)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
              activeTag === tag ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 bg-white')}
            style={activeTag === tag ? { backgroundColor: '#002045' } : {}}>
            {tag}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
          <span className="material-symbols-rounded text-gray-200 block mb-3" style={{ fontSize: '3rem' }}>forum</span>
          <p className="text-gray-500 font-medium">אין פוסטים עדיין בקטגוריה זו</p>
          <p className="text-sm text-gray-400 mt-1">היה הראשון לשאול שאלה!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => {
            const pt = POST_TYPES[post.post_type] ?? POST_TYPES.question
            return (
              <button key={post.id} onClick={() => openPost(post)}
                className="w-full text-right bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-100 transition-all">
                <div className="flex items-start gap-3">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', pt.color)}>
                    <span className="material-symbols-rounded filled" style={{ fontSize: '1.1rem' }}>{pt.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('text-xs font-semibold', pt.color.split(' ')[0])}>{pt.label}</span>
                      {post.stage_tag && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{post.stage_tag}</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug">{post.title}</h3>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{post.body}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 flex-shrink-0 text-gray-300">
                    <div className="flex items-center gap-0.5">
                      <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>favorite</span>
                      <span className="text-xs">{post.likes}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>chat_bubble</span>
                      <span className="text-xs">{post.answers_count ?? 0}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2.5 pr-12">
                  <span className="text-xs text-gray-400">{post.author_name}</span>
                  <span className="text-gray-200">•</span>
                  <span className="text-xs text-gray-400">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
