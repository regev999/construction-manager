'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'client'

export interface AppUser extends User {
  role?: UserRole
  full_name?: string
}

const DEV_ROLE_KEY = 'bm_dev_role'

export function setDevRole(role: UserRole | null) {
  if (role) {
    localStorage.setItem(DEV_ROLE_KEY, role)
    document.cookie = `${DEV_ROLE_KEY}=${role};path=/;max-age=86400`
  } else {
    localStorage.removeItem(DEV_ROLE_KEY)
    document.cookie = `${DEV_ROLE_KEY}=;path=/;max-age=0`
  }
}

export function getDevRole(): UserRole | null {
  if (typeof window === 'undefined') return null
  return (localStorage.getItem(DEV_ROLE_KEY) as UserRole) ?? null
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Dev mode bypass
    const devRole = getDevRole()
    if (devRole) {
      setUser({ id: 'dev-user', email: 'dev@buildmanager.local' } as AppUser)
      setRole(devRole)
      setLoading(false)
      return
    }

    // Fetch role in background — never blocks loading
    async function fetchRoleAsync(u: User) {
      try {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', u.id)
          .single()
        setRole(data?.role ?? 'client')
      } catch {
        setRole('client')
      }
    }

    // onAuthStateChange fires immediately from cached session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (getDevRole()) return
      if (session?.user) {
        setUser(session.user as AppUser)
        setRole('client') // default; fetchRoleAsync will update it
        fetchRoleAsync(session.user)
      } else {
        setUser(null)
        setRole(null)
      }
      setLoading(false) // always stop loading once we know auth state
    })

    // Also call getUser as authoritative source (handles edge cases)
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) {
        setUser(u as AppUser)
        fetchRoleAsync(u)
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    // Hard timeout: stop loading after 4s no matter what
    const timeout = setTimeout(() => setLoading(false), 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function signOut() {
    setDevRole(null)
    // Don't wait for signOut network call — just redirect
    supabase.auth.signOut().catch(() => {})
    window.location.href = '/auth'
  }

  return { user, role, loading, signOut }
}
