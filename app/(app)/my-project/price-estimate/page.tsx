'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

export default function MyProjectPriceEstimate() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!user) return

    if (user.id === 'dev-user') {
      const saved = localStorage.getItem('bm_dev_project')
      if (saved) {
        const p = JSON.parse(saved)
        router.replace(`/projects/${p.id}/price-estimate`)
      } else {
        router.replace('/dashboard')
      }
      return
    }

    supabase
      .from('projects')
      .select('id')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setError(true); return }
        router.replace(`/projects/${data.id}/price-estimate`)
      })
  }, [user])

  if (error) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">לא נמצא פרויקט</div>
  )

  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
