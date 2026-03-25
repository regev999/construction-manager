import { PRICE_ITEMS, BASEMENT_ITEM, type PriceItem } from '@/lib/data/price-items'

export interface ProjectPriceParams {
  house_size: number | null
  has_basement: boolean
  finish_level: 'basic' | 'standard' | 'high' | null
}

export interface AdjustedItem extends PriceItem {
  adjusted_min: number
  adjusted_max: number
}

function getSizeMultiplier(size: number | null): number {
  if (!size) return 1
  if (size <= 120) return 0.85   // קטן → קרוב למינימום
  if (size <= 200) return 1.0    // בינוני → אמצע
  return 1.2                     // גדול → קרוב למקסימום
}

function getFinishMultiplier(level: string | null): number {
  if (level === 'basic') return 0.75
  if (level === 'high') return 1.4
  return 1.0
}

export function calculatePrices(params: ProjectPriceParams): AdjustedItem[] {
  const { house_size, has_basement, finish_level } = params
  const sizeMult = getSizeMultiplier(house_size)
  const finishMult = getFinishMultiplier(finish_level)

  const items = [...PRICE_ITEMS, ...(has_basement ? [BASEMENT_ITEM] : [])]

  return items.map(item => {
    if (item.price_type === 'fixed') {
      return { ...item, adjusted_min: item.base_min, adjusted_max: item.base_max }
    }

    let min = item.base_min
    let max = item.base_max

    if (item.id === 'structure' && house_size) {
      // מ"ר × מחיר למ"ר, +20% אם יש מרתף (מורכבות)
      const basementMult = has_basement ? 1.2 : 1
      min = Math.round(item.base_min * house_size * basementMult)
      max = Math.round(item.base_max * house_size * basementMult)
    } else if (item.id === 'basement' && house_size) {
      // מרתף: ~50% מהשטח
      const basementSqm = Math.round(house_size * 0.5)
      min = item.base_min * basementSqm
      max = item.base_max * basementSqm
    } else if (item.category === 'finish') {
      min = Math.round(item.base_min * sizeMult * finishMult)
      max = Math.round(item.base_max * sizeMult * finishMult)
    } else {
      // planning, electrical, plumbing
      min = Math.round(item.base_min * sizeMult)
      max = Math.round(item.base_max * sizeMult)
    }

    return { ...item, adjusted_min: min, adjusted_max: max }
  })
}

export function formatRange(min: number, max: number): string {
  const fmt = (n: number) => '₪' + n.toLocaleString('he-IL')
  return `${fmt(min)} – ${fmt(max)}`
}

export function getTotalRange(items: AdjustedItem[]): { min: number; max: number } {
  return items.reduce(
    (acc, item) => ({ min: acc.min + item.adjusted_min, max: acc.max + item.adjusted_max }),
    { min: 0, max: 0 }
  )
}

// ─── Budget Reality Check ──────────────────────────────────────────────────────

export type BudgetRealityStatus = 'unrealistic' | 'borderline' | 'ok'

export interface BudgetRealityResult {
  status: BudgetRealityStatus
  estimated_min: number
  estimated_max: number
  budget: number
  shortfall: number
  overrun_risk: number
  message: string
  sub_message: string
  suggestions: string[]
}

const COST_PER_SQM_MIN = 7000
const COST_PER_SQM_MAX = 12000

const FINISH_MULT: Record<string, { min: number; max: number }> = {
  basic:    { min: 0.80, max: 0.85 },
  standard: { min: 1.00, max: 1.00 },
  high:     { min: 1.15, max: 1.40 },
}

export function checkBudgetReality(params: {
  house_size: number | null | undefined
  has_basement: boolean | null | undefined
  finish_level: 'basic' | 'standard' | 'high' | null | undefined
  total_budget: number | null | undefined
}): BudgetRealityResult | null {
  const { house_size, has_basement, finish_level, total_budget } = params
  if (!house_size || !total_budget) return null

  const fm = FINISH_MULT[finish_level ?? 'standard'] ?? FINISH_MULT.standard
  const baseMult = has_basement ? 1.2 : 1

  const estimated_min = Math.round(house_size * COST_PER_SQM_MIN * fm.min * baseMult)
  const estimated_max = Math.round(house_size * COST_PER_SQM_MAX * fm.max * baseMult)

  let status: BudgetRealityStatus
  if (total_budget < estimated_min) {
    status = 'unrealistic'
  } else if (total_budget <= estimated_max) {
    status = 'borderline'
  } else {
    status = 'ok'
  }

  const shortfall = status === 'unrealistic' ? estimated_min - total_budget : 0
  const overrun_risk = total_budget - estimated_max

  const fmtNIS = (n: number) => '₪' + n.toLocaleString('he-IL')

  const messages: Record<BudgetRealityStatus, { message: string; sub: string; suggestions: string[] }> = {
    unrealistic: {
      message: 'התקציב נמוך משמעותית מהעלות הצפויה',
      sub: 'פרויקט בגודל זה עולה בדרך כלל יותר מהסכום שהגדרת.',
      suggestions: [
        `הגדל תקציב ב-${fmtNIS(shortfall)} לפחות`,
        'הקטן את שטח הבנייה',
        ...(finish_level === 'high' ? ['הורד רמת גמר'] : []),
        ...(has_basement ? ['שקול לוותר על המרתף'] : []),
      ],
    },
    borderline: {
      message: 'התקציב גבולי — דרוש ניהול קפדני',
      sub: 'הפרויקט אפשרי, אך אין מרווח לחריגות. נהל כל הוצאה בזהירות.',
      suggestions: [
        'שמור על רזרבה של 10% לחריגות בלתי צפויות',
        'קבל הצעות מחיר ממספר קבלנים לפני התחייבות',
      ],
    },
    ok: {
      message: 'התקציב תואם לפרויקט',
      sub: 'הסכום שהגדרת מכסה את טווח העלות הצפוי לפרויקט כזה.',
      suggestions: [],
    },
  }

  const m = messages[status]
  return {
    status, estimated_min, estimated_max,
    budget: total_budget,
    shortfall, overrun_risk,
    message: m.message, sub_message: m.sub, suggestions: m.suggestions,
  }
}
