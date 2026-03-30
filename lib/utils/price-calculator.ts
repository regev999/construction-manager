import { PRICE_ITEMS, BASEMENT_ITEM, type PriceItem } from '@/lib/data/price-items'

export interface ProjectPriceParams {
  house_size: number | null
  has_basement: boolean
  basement_size?: number | null
  finish_level: 'basic' | 'standard' | 'high' | null
  construction_type?: 'concrete' | 'light' | 'midtec' | null
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
  if (level === 'basic') return 0.65
  if (level === 'high') return 1.5
  return 1.0
}

// מחיר שלד — פלדה עבת דופן — ₪/מ"ר, קומות על-קרקעיות בלבד
const LIGHT_STRUCTURE_MIN = 1800
const LIGHT_STRUCTURE_MAX = 3000

// מחיר שלד — מידטק / LSF — דומה לבטון
const MIDTEC_STRUCTURE_MIN = 3500
const MIDTEC_STRUCTURE_MAX = 5500

export function calculatePrices(params: ProjectPriceParams): AdjustedItem[] {
  const { house_size, has_basement, basement_size, finish_level, construction_type } = params
  const isLight  = construction_type === 'light'
  const isMidtec = construction_type === 'midtec'
  // house_size = שטח על-קרקעי בלבד. מרתף = שטח שהוגדר ידנית, או fallback ל-50% משטח הבית
  const basementSqm = basement_size ?? (house_size ? Math.round(house_size * 0.5) : 0)

  const sizeMult   = getSizeMultiplier(house_size)
  const finishMult = getFinishMultiplier(finish_level)

  const items = [...PRICE_ITEMS, ...(has_basement ? [BASEMENT_ITEM] : [])]

  return items.map(item => {
    if (item.price_type === 'fixed') {
      return { ...item, adjusted_min: item.base_min, adjusted_max: item.base_max }
    }

    let min = item.base_min
    let max = item.base_max

    if (item.id === 'structure' && house_size) {
      if (isLight) {
        // פלדה עבת דופן — מחיר שלד נמוך, +10% מורכבות אם יש מרתף בטון
        const basementComplexityMult = has_basement ? 1.1 : 1
        min = Math.round(LIGHT_STRUCTURE_MIN * house_size * basementComplexityMult)
        max = Math.round(LIGHT_STRUCTURE_MAX * house_size * basementComplexityMult)
      } else if (isMidtec) {
        // מידטק / LSF — מחיר שלד דומה לבטון, +10% מורכבות אם יש מרתף בטון
        const basementComplexityMult = has_basement ? 1.1 : 1
        min = Math.round(MIDTEC_STRUCTURE_MIN * house_size * basementComplexityMult)
        max = Math.round(MIDTEC_STRUCTURE_MAX * house_size * basementComplexityMult)
      } else {
        // בנייה רגילה (בטון): +20% אם יש מרתף
        const basementMult = has_basement ? 1.2 : 1
        min = Math.round(item.base_min * house_size * basementMult)
        max = Math.round(item.base_max * house_size * basementMult)
      }
    } else if (item.id === 'basement' && house_size) {
      // מרתף תמיד בטון — בכל שיטת בנייה. BASEMENT_ITEM הוא המקום היחיד שמחשב את המרתף
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

// מחיר כולל למ"ר לפי רמת גמר — בנייה רגילה (בטון), שוק 2025
const COST_PER_SQM: Record<string, { min: number; max: number }> = {
  basic:    { min: 7000,  max: 9000  },
  standard: { min: 10000, max: 13000 },
  high:     { min: 13000, max: 18000 },
}

// מחיר כולל למ"ר לפי רמת גמר — פלדה עבת דופן, שוק 2025
const COST_PER_SQM_LIGHT: Record<string, { min: number; max: number }> = {
  basic:    { min: 2500, max: 3500 },
  standard: { min: 3500, max: 4500 },
  high:     { min: 4500, max: 6000 },
}

// מחיר כולל למ"ר לפי רמת גמר — מידטק / LSF (דומה לבטון), שוק 2025
const COST_PER_SQM_MIDTEC: Record<string, { min: number; max: number }> = {
  basic:    { min: 7000,  max: 9000  },
  standard: { min: 10000, max: 13000 },
  high:     { min: 13000, max: 17000 },
}

export function checkBudgetReality(params: {
  house_size: number | null | undefined
  has_basement: boolean | null | undefined
  basement_size?: number | null | undefined
  finish_level: 'basic' | 'standard' | 'high' | null | undefined
  total_budget: number | null | undefined
  construction_type?: 'concrete' | 'light' | 'midtec' | null
}): BudgetRealityResult | null {
  const { house_size, has_basement, basement_size, finish_level, total_budget, construction_type } = params
  if (!house_size || !total_budget) return null

  const priceTable =
    construction_type === 'light'  ? COST_PER_SQM_LIGHT  :
    construction_type === 'midtec' ? COST_PER_SQM_MIDTEC :
    COST_PER_SQM

  const sqm = priceTable[finish_level ?? 'standard'] ?? priceTable.standard

  // חישוב תוספת מרתף לפי שטח ממשי (אם הוגדר) או fallback ל-50%
  const actualBasementSqm = basement_size ?? (has_basement && house_size ? Math.round(house_size * 0.5) : 0)
  const baseMult = house_size && actualBasementSqm > 0
    ? 1 + (actualBasementSqm / house_size) * 0.7
    : 1

  const estimated_min = Math.round(house_size * sqm.min * baseMult)
  const estimated_max = Math.round(house_size * sqm.max * baseMult)

  let status: BudgetRealityStatus
  if (total_budget < estimated_min) {
    status = 'unrealistic'
  } else if (total_budget <= estimated_max) {
    status = 'borderline'
  } else {
    status = 'ok'
  }

  const shortfall    = status === 'unrealistic' ? estimated_min - total_budget : 0
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
