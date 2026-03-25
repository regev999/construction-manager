'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { Project } from '@/lib/types/database.types'

interface ClientUser {
  id: string
  full_name?: string
  email?: string
  role: string
}

export default function ClientsPage() {
  const { user, role } = useAuth()
  const [clients, setClients] = useState<ClientUser[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [inviting, setInviting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!user || role !== 'admin') return
    async function load() {
      const { data: clientsData } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'client')
      setClients(clientsData ?? [])

      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('admin_id', user!.id)
      setProjects(projectsData ?? [])
      setLoading(false)
    }
    load()
  }, [user, role])

  if (role && role !== 'admin') {
    return <div className="text-center py-20 text-gray-500">אין לך גישה לעמוד זה</div>
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    try {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail
        ? { data: null, error: { message: 'השתמש ב-Supabase Dashboard לשליחת הזמנות' } }
        : { data: null, error: null }

      // For now: create signup link manually
      toast.info('כדי להזמין לקוח: שלח לו את כתובת הפלטפורמה ובקש שיירשם עם האימייל הזה. אחר כך תוכל להקצות לו פרויקט.')
      setShowInvite(false)
    } catch {
      toast.error('שגיאה')
    } finally {
      setInviting(false)
    }
  }

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-40" /><div className="h-40 bg-gray-200 rounded-2xl" /></div>

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">לקוחות</h1>
          <p className="text-gray-500 mt-1">{clients.length} לקוחות רשומים</p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="gradient-primary text-white border-0">
          <span className="material-symbols-rounded ml-1" style={{ fontSize: '1rem' }}>person_add</span>
          הזמן לקוח
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <span className="material-symbols-rounded text-indigo-500" style={{ fontSize: '1.2rem' }}>group</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
              <p className="text-xs text-gray-400">לקוחות רשומים</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <span className="material-symbols-rounded text-emerald-500" style={{ fontSize: '1.2rem' }}>home_work</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
              <p className="text-xs text-gray-400">פרויקטים</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <span className="material-symbols-rounded text-amber-500" style={{ fontSize: '1.2rem' }}>pending</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{projects.filter(p => !p.client_id).length}</p>
              <p className="text-xs text-gray-400">ממתינים להקצאה</p>
            </div>
          </div>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-rounded text-emerald-400" style={{ fontSize: '2rem' }}>group</span>
          </div>
          <p className="text-gray-500 mb-2">אין לקוחות רשומים עדיין</p>
          <p className="text-sm text-gray-400">שלח ללקוח את כתובת הפלטפורמה ובקש שיירשם</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <p className="text-sm font-medium text-gray-500">רשימת לקוחות</p>
          </div>
          <div className="divide-y divide-gray-50">
            {clients.map(client => {
              const clientProjects = projects.filter(p => p.client_id === client.id)
              return (
                <div key={client.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-sm">
                      {(client.full_name ?? client.email ?? 'L').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{client.full_name ?? 'ללא שם'}</p>
                    <p className="text-sm text-gray-400 truncate">{client.email ?? client.id.slice(0, 12)}</p>
                  </div>
                  <div className="text-center hidden md:block">
                    <p className="text-sm font-semibold text-gray-900">{clientProjects.length}</p>
                    <p className="text-xs text-gray-400">פרויקטים</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {clientProjects.slice(0, 2).map(p => (
                      <span key={p.id} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg truncate max-w-[120px]">
                        {p.name}
                      </span>
                    ))}
                    {clientProjects.length > 2 && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">+{clientProjects.length - 2}</span>
                    )}
                    {clientProjects.length === 0 && (
                      <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-lg">ללא פרויקט</span>
                    )}
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">לקוח</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הזמנת לקוח</DialogTitle>
          </DialogHeader>
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">איך מזמינים לקוח?</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-600">
              <li>שלח ללקוח את כתובת הפלטפורמה</li>
              <li>הלקוח נרשם עצמאית עם האימייל שלו</li>
              <li>בסופאבייס הגדר את ה-role שלו ל-client</li>
              <li>עדכן את ה-client_id בפרויקט הרלוונטי</li>
            </ol>
          </div>
          <Button onClick={() => setShowInvite(false)} className="w-full">הבנתי</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
