import type { Project, Stage, Task, Quote } from '@/lib/types/database.types'

export interface SmartAction {
  title: string
  description: string
  urgency: 'critical' | 'important' | 'normal'
  icon: string
  actionLabel?: string
  actionHref?: string
}

export interface SmartAlert {
  id: string
  level: 'critical' | 'warning' | 'info'
  title: string
  description: string
  icon: string
  relatedHref?: string
}

export interface BudgetForecast {
  projectedTotal: number
  projectedOverrun: number
  remainingBudget: number
  confidenceNote: string
  approvedQuotesTotal: number
  spendRate: number
}

export interface BenchmarkComparison {
  label: string
  userVal: string
  avgVal: string
  isGood: boolean | null
}

export interface BenchmarkResult {
  comparisons: BenchmarkComparison[]
  overallNote: string
}

export interface ContractorSummary {
  id: string
  name: string
  contract_url: string | null
  status: 'not_started' | 'in_progress' | 'completed'
  progress_pct: number
  quote_amount: number | null
  advance_amount: number | null
  actual_amount: number | null
  planned_end_date: string | null
}

export interface EngineInput {
  project: Project
  stages: (Stage & { tasks?: Task[] })[]
  contractors: ContractorSummary[]
  quotes: Quote[]
}
