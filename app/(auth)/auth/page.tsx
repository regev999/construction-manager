'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { setDevRole } from '@/lib/hooks/useAuth'
import { toast } from 'sonner'

const PRIMARY = '#002045'

export default function AuthPage() {
  if (!isSupabaseConfigured()) return <SetupPage />
  return <LoginPage />
}

// ─── Left panel (brand) ───────────────────────────────────────────────────────
function BrandPanel() {
  return (
    <div
      className="hidden md:flex w-5/12 min-h-screen flex-col justify-between p-12"
      style={{ background: `linear-gradient(145deg, ${PRIMARY} 0%, #003a7a 60%, #005cbf 100%)` }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <span className="material-symbols-rounded text-white filled" style={{ fontSize: '1.1rem' }}>home_work</span>
        </div>
        <span className="text-white font-bold tracking-wide">בנה חכם</span>
      </div>

      {/* Center content */}
      <div>
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-8" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <span className="material-symbols-rounded text-white filled" style={{ fontSize: '2.2rem' }}>construction</span>
        </div>
        <h2 className="text-4xl font-bold text-white leading-tight mb-4">
          ניהול בנייה<br />חכם ופשוט
        </h2>
        <p className="text-white/60 text-base leading-relaxed mb-10">
          מהמגרש ועד המפתח — כל שלבי הבנייה שלך במקום אחד
        </p>

        <div className="space-y-3">
          {[
            { icon: 'checklist', text: 'צ\'קליסט חכם לכל שלב בבנייה' },
            { icon: 'payments', text: 'מעקב תקציב בזמן אמת' },
            { icon: 'notifications_active', text: 'התראות על אירועים קריטיים' },
            { icon: 'folder_open', text: 'ניהול מסמכים והיתרים' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <span className="material-symbols-rounded text-white/70" style={{ fontSize: '1rem' }}>{f.icon}</span>
              <span className="text-white/80 text-sm">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="text-white/30 text-xs">בנה חכם © {new Date().getFullYear()}</p>
    </div>
  )
}

// ─── Login form ───────────────────────────────────────────────────────────────
function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success('נשלח מייל אימות — בדוק את תיבת הדואר')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בהתחברות')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) toast.error(error.message)
  }

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-300 focus:outline-none transition-all bg-gray-50"

  function focusStyle(e: React.FocusEvent<HTMLInputElement>) { e.target.style.borderColor = PRIMARY; e.target.style.backgroundColor = 'white' }
  function blurStyle(e: React.FocusEvent<HTMLInputElement>) { e.target.style.borderColor = ''; e.target.style.backgroundColor = '' }

  return (
    <div className="min-h-screen flex bg-white" dir="rtl">
      <BrandPanel />

      {/* Right: form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 md:px-16 py-12">
        {/* Mobile logo */}
        <div className="md:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: PRIMARY }}>
            <span className="material-symbols-rounded text-white filled" style={{ fontSize: '1rem' }}>home_work</span>
          </div>
          <span className="font-bold text-gray-900">בנה חכם</span>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {isLogin ? 'ברוך הבא בחזרה' : 'צור חשבון חדש'}
          </h1>
          <p className="text-sm text-gray-400 mb-8">
            {isLogin ? 'כנס לחשבונך כדי להמשיך' : 'הצטרף לניהול הבנייה שלך'}
          </p>

          {/* Google */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors mb-6"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            המשך עם Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">או עם אימייל</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">אימייל</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required className={inputClass}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">סיסמה</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="לפחות 6 תווים" required className={inputClass}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 mt-2"
              style={{ backgroundColor: PRIMARY }}
            >
              {loading ? 'רגע...' : isLogin ? 'כניסה' : 'יצירת חשבון'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-5">
            {isLogin ? 'אין לך חשבון?' : 'כבר יש לך חשבון?'}{' '}
            <button onClick={() => setIsLogin(!isLogin)} className="font-medium hover:underline" style={{ color: PRIMARY }}>
              {isLogin ? 'הרשמה' : 'כניסה'}
            </button>
          </p>

        </div>
      </div>
    </div>
  )
}

// ─── Setup page ───────────────────────────────────────────────────────────────
function SetupPage() {
  return (
    <div className="min-h-screen flex bg-white" dir="rtl">
      <BrandPanel />
      <div className="flex-1 flex items-center justify-center px-6 md:px-16 py-12">
        <div className="w-full max-w-sm">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: `${PRIMARY}10` }}>
            <span className="material-symbols-rounded" style={{ fontSize: '1.4rem', color: PRIMARY }}>settings</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">הגדרת Supabase</h2>
          <p className="text-sm text-gray-400 mb-6">
            עדכן את קובץ <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env.local</code> עם פרטי הפרויקט שלך:
          </p>
          <div className="bg-gray-900 rounded-2xl p-5 text-xs font-mono leading-loose mb-6">
            <p className="text-gray-500 mb-1"># .env.local</p>
            <p className="text-green-400">NEXT_PUBLIC_SUPABASE_URL=</p>
            <p className="text-yellow-300 pr-2">https://xxxx.supabase.co</p>
            <p className="text-green-400 mt-2">NEXT_PUBLIC_SUPABASE_ANON_KEY=</p>
            <p className="text-yellow-300 pr-2">eyJhbGci...</p>
          </div>
          <div className="space-y-2">
            {[
              'היכנס ל-supabase.com וצור פרויקט',
              'העתק URL ו-anon key מהגדרות',
              'עדכן .env.local והפעל מחדש',
              'הרץ את schema.sql ב-SQL Editor',
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: PRIMARY }}>{i + 1}</span>
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
