import { cn } from '@/lib/utils'
import type { StageStatus, TaskPriority } from '@/lib/types/database.types'

const stageStatusMap: Record<StageStatus, { label: string; className: string; icon: string }> = {
  pending: { label: 'טרם התחיל', className: 'bg-gray-100 text-gray-600', icon: 'schedule' },
  in_progress: { label: 'בתהליך', className: 'bg-blue-100 text-blue-700', icon: 'autorenew' },
  completed: { label: 'הושלם', className: 'bg-emerald-100 text-emerald-700', icon: 'check_circle' },
  on_hold: { label: 'מושהה', className: 'bg-amber-100 text-amber-700', icon: 'pause_circle' },
}

const priorityMap: Record<TaskPriority, { label: string; className: string; icon: string }> = {
  critical: { label: 'קריטי', className: 'bg-red-100 text-red-700', icon: 'warning' },
  high: { label: 'גבוה', className: 'bg-orange-100 text-orange-700', icon: 'priority_high' },
  normal: { label: 'רגיל', className: 'bg-blue-100 text-blue-700', icon: 'info' },
  low: { label: 'נמוך', className: 'bg-gray-100 text-gray-600', icon: 'low_priority' },
}

export function StageStatusBadge({ status }: { status: StageStatus }) {
  const { label, className, icon } = stageStatusMap[status]
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', className)}>
      <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>{icon}</span>
      {label}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { label, className, icon } = priorityMap[priority]
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', className)}>
      <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>{icon}</span>
      {label}
    </span>
  )
}
