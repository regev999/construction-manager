export type UserRole = 'admin' | 'client'
export type ProjectStatus = 'active' | 'on_hold' | 'completed'
export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'on_hold'
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'
export type DocumentCategory = 'permit' | 'plan' | 'receipt' | 'contract' | 'photo' | 'other'
export type BuildType = 'self' | 'turnkey'
export type LocationType = 'city' | 'moshav' | 'kibbutz' | 'other'

export interface Project {
  id: string
  admin_id: string
  client_id?: string
  name: string
  address?: string
  total_budget?: number
  start_date?: string
  target_end_date?: string
  status: ProjectStatus
  notes?: string
  build_type?: BuildType
  location_type?: LocationType
  house_size?: number
  has_basement?: boolean
  basement_size?: number
  finish_level?: 'basic' | 'standard' | 'high'
  construction_type?: 'concrete' | 'light' | 'midtec'
  vat_rate?: number
  created_at: string
  updated_at: string
}

export interface Stage {
  id: string
  project_id: string
  name: string
  sort_order: number
  status: StageStatus
  planned_cost?: number
  start_date?: string
  end_date?: string
  created_at: string
  // computed
  tasks?: Task[]
  completed_tasks_count?: number
  total_tasks_count?: number
}

export interface Task {
  id: string
  stage_id: string
  name: string
  description?: string
  is_completed: boolean
  is_required: boolean
  sort_order: number
  priority: TaskPriority
  planned_cost?: number
  actual_cost?: number
  contractor_id?: string
  due_date?: string
  completed_at?: string
  notes?: string
  why_important?: string
  what_if_skip?: string
  pro_tip?: string
  created_at: string
}

export type ContractorStatus = 'active' | 'completed' | 'paused'

export interface Contractor {
  id: string
  project_id: string
  name: string
  trade?: string
  phone?: string
  email?: string
  notes?: string
  rating?: number
  status?: ContractorStatus
  progress_pct?: number
  quote_amount?: number
  advance_amount?: number
  actual_amount?: number
  start_date?: string
  planned_end_date?: string
  actual_end_date?: string
  contract_url?: string
  created_at: string
}

export interface BudgetEntry {
  id: string
  project_id: string
  stage_id?: string
  task_id?: string
  contractor_id?: string
  amount: number
  description: string
  receipt_url?: string
  payment_date: string
  created_at: string
}

export interface Document {
  id: string
  project_id: string
  stage_id?: string
  name: string
  category: DocumentCategory
  file_url: string
  file_size?: number
  mime_type?: string
  uploaded_by?: string
  created_at: string
}

export type QuoteStatus = 'pending' | 'approved' | 'rejected'
export type QuoteCategory =
  | 'land' | 'planning' | 'structure' | 'plumbing' | 'electrical'
  | 'drywall' | 'flooring' | 'aluminum' | 'kitchen' | 'painting'
  | 'excavation' | 'concrete' | 'other'

export interface Quote {
  id: string
  project_id: string
  category: QuoteCategory
  contractor_name?: string
  amount?: number
  status: QuoteStatus
  notes?: string
  document_url?: string
  document_name?: string
  created_at: string
  updated_at: string
}

export interface AppUser {
  id: string
  email?: string
  full_name?: string
  phone?: string
  role: UserRole
  created_at: string
}
