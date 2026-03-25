import { formatNIS } from '@/components/shared/CurrencyDisplay'
import { checkBudgetReality } from '@/lib/utils/price-calculator'
import type { EngineInput, SmartAction, SmartAlert, BudgetForecast, BenchmarkResult } from './types'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function monthsBetween(a: string, b: Date = new Date()): number {
  const date = new Date(a)
  return (b.getFullYear() - date.getFullYear()) * 12 + (b.getMonth() - date.getMonth())
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

// ─── ENGINE 1: NEXT ACTION ────────────────────────────────────────────────────

export function getNextAction(input: EngineInput): SmartAction {
  const { project, stages, contractors, quotes } = input
  const allTasks = stages.flatMap(s => s.tasks ?? [])
  const currentStage = stages.find(s => s.status === 'in_progress')
  const totalBudget = project.total_budget ?? 0
  const actualCost = allTasks.reduce((s, t) => s + (t.actual_cost ?? 0), 0)

  // Priority 1 — קבלן פעיל ללא חוזה (CRITICAL)
  const contractorNoContract = contractors.find(c => c.status === 'in_progress' && !c.contract_url)
  if (contractorNoContract) {
    return {
      title: 'חתום חוזה עם קבלן',
      description: `${contractorNoContract.name} בעבודה פעילה אך אין חוזה חתום — זהו סיכון משפטי וכספי.`,
      urgency: 'critical',
      icon: 'gavel',
      actionLabel: 'לניהול קבלנים',
      actionHref: `/projects/${project.id}/contractors`,
    }
  }

  // Priority 2 — מקדמה > 40% לפני 50% התקדמות (CRITICAL)
  const earlyAdvance = contractors.find(c => {
    if (!c.quote_amount || !c.advance_amount) return false
    const advancePct = c.advance_amount / c.quote_amount
    return advancePct > 0.4 && c.progress_pct < 50
  })
  if (earlyAdvance) {
    return {
      title: 'מקדמה גבוהה מדי',
      description: `שילמת מעל 40% מקדמה ל${earlyAdvance.name} לפני שהגיע ל-50% התקדמות.`,
      urgency: 'critical',
      icon: 'payments',
      actionLabel: 'לניהול קבלנים',
      actionHref: `/projects/${project.id}/contractors`,
    }
  }

  // Priority 3 — שלב עבר תאריך (CRITICAL)
  if (currentStage && isOverdue(currentStage.end_date)) {
    return {
      title: 'שלב באיחור',
      description: `שלב "${currentStage.name}" עבר את תאריך הסיום המתוכנן.`,
      urgency: 'critical',
      icon: 'schedule',
      actionLabel: 'לניהול שלבים',
      actionHref: `/projects/${project.id}/stages`,
    }
  }

  // Priority 4 — משימות critical לא הושלמו (IMPORTANT)
  const criticalTask = allTasks.find(t => !t.is_completed && t.priority === 'critical')
  if (criticalTask) {
    return {
      title: 'משימה קריטית ממתינה',
      description: `"${criticalTask.name}" מסומנת כקריטית ועדיין לא הושלמה.`,
      urgency: 'important',
      icon: 'priority_high',
      actionLabel: 'לצ\'קליסט',
      actionHref: `/projects/${project.id}/stages`,
    }
  }

  // Priority 5 — תקציב > 85% נוצל ועוד שלבים נשארו (IMPORTANT)
  const remainingStages = stages.filter(s => s.status !== 'completed')
  if (totalBudget > 0 && actualCost / totalBudget > 0.85 && remainingStages.length > 0) {
    return {
      title: 'תקציב מתכלה',
      description: `השתמשת ב-${Math.round((actualCost / totalBudget) * 100)}% מהתקציב ועדיין נשארו ${remainingStages.length} שלבים.`,
      urgency: 'important',
      icon: 'account_balance_wallet',
      actionLabel: 'לתקציב',
      actionHref: `/projects/${project.id}/budget`,
    }
  }

  // Priority 6 — הצעות מחיר ממתינות (NORMAL)
  const pendingQuotes = quotes.filter(q => q.status === 'pending')
  if (pendingQuotes.length > 0) {
    return {
      title: `${pendingQuotes.length} הצעות מחיר ממתינות לאישור`,
      description: 'עיין בהצעות ואשר את הרלוונטיות כדי לעדכן את תחזית התקציב.',
      urgency: 'normal',
      icon: 'request_quote',
      actionLabel: 'להצעות מחיר',
      actionHref: `/projects/${project.id}/quotes`,
    }
  }

  // Priority 7 — המשימה הבאה בשלב הנוכחי (NORMAL)
  if (currentStage) {
    const nextTask = (currentStage.tasks ?? []).find(t => !t.is_completed)
    if (nextTask) {
      return {
        title: 'המשך עם המשימה הבאה',
        description: `"${nextTask.name}" בשלב ${currentStage.name} ממתינה לביצוע.`,
        urgency: 'normal',
        icon: 'task_alt',
        actionLabel: 'לצ\'קליסט',
        actionHref: `/projects/${project.id}/stages`,
      }
    }
  }

  // Default — הכל תקין
  return {
    title: 'הפרויקט מתקדם תקין',
    description: 'אין פעולות דחופות כרגע. המשך לעקוב אחרי ההתקדמות.',
    urgency: 'normal',
    icon: 'check_circle',
  }
}

// ─── ENGINE 2: SMART ALERTS ───────────────────────────────────────────────────

export function getSmartAlerts(input: EngineInput): SmartAlert[] {
  const { project, stages, contractors, quotes } = input
  const alerts: SmartAlert[] = []
  const allTasks = stages.flatMap(s => s.tasks ?? [])
  const totalBudget = project.total_budget ?? 0
  const actualCost = allTasks.reduce((s, t) => s + (t.actual_cost ?? 0), 0)
  const plannedCost = allTasks.reduce((s, t) => s + (t.planned_cost ?? 0), 0)
  const projectPath = `/projects/${project.id}`

  // ── קבלנים ──
  contractors.forEach(c => {
    if (c.status === 'in_progress' && !c.contract_url) {
      alerts.push({
        id: `no-contract-${c.id}`,
        level: 'critical',
        title: `אין חוזה עם ${c.name}`,
        description: 'קבלן בעבודה פעילה ללא חוזה חתום — סיכון משפטי.',
        icon: 'gavel',
        relatedHref: `${projectPath}/contractors`,
      })
    }

    if (c.quote_amount && c.advance_amount) {
      const advancePct = c.advance_amount / c.quote_amount
      if (advancePct > 0.4) {
        alerts.push({
          id: `high-advance-${c.id}`,
          level: 'critical',
          title: `מקדמה גבוהה ל${c.name}`,
          description: `שולמו ${Math.round(advancePct * 100)}% מסכום ההצעה כמקדמה — מעל הסף המומלץ (40%).`,
          icon: 'payments',
          relatedHref: `${projectPath}/contractors`,
        })
      }
    }

    if (c.advance_amount && c.quote_amount && c.progress_pct < 30) {
      const advancePct = (c.advance_amount / c.quote_amount) * 100
      if (advancePct > c.progress_pct + 20) {
        alerts.push({
          id: `advance-ahead-${c.id}`,
          level: 'warning',
          title: `תשלום קדם להתקדמות — ${c.name}`,
          description: `שילמת ${Math.round(advancePct)}% אך ההתקדמות רק ${c.progress_pct}%.`,
          icon: 'warning',
          relatedHref: `${projectPath}/contractors`,
        })
      }
    }
  })

  // ── תקציב ──
  if (totalBudget > 0) {
    const usedPct = (actualCost / totalBudget) * 100
    if (usedPct > 90) {
      alerts.push({
        id: 'budget-critical',
        level: 'critical',
        title: `תקציב ${Math.round(usedPct)}% נוצל`,
        description: `נותרו פחות מ-${formatNIS(totalBudget - actualCost)} מתוך התקציב הכולל.`,
        icon: 'account_balance_wallet',
        relatedHref: `${projectPath}/budget`,
      })
    } else if (usedPct > 75) {
      alerts.push({
        id: 'budget-warning',
        level: 'warning',
        title: `תקציב ${Math.round(usedPct)}% נוצל`,
        description: 'שים לב — מתקרבים לתקציב המקסימלי.',
        icon: 'account_balance_wallet',
        relatedHref: `${projectPath}/budget`,
      })
    }
  }

  if (plannedCost > 0 && actualCost > plannedCost) {
    alerts.push({
      id: 'cost-overrun',
      level: 'warning',
      title: 'חריגת עלויות מהתכנון',
      description: `ההוצאות בפועל (${formatNIS(actualCost)}) עוברות את התכנון (${formatNIS(plannedCost)}).`,
      icon: 'trending_up',
      relatedHref: `${projectPath}/budget`,
    })
  }

  // ── לוחות זמנים ──
  stages.forEach(s => {
    if (s.status === 'in_progress' && isOverdue(s.end_date)) {
      alerts.push({
        id: `stage-overdue-${s.id}`,
        level: 'critical',
        title: `שלב "${s.name}" באיחור`,
        description: `תאריך הסיום המתוכנן עבר. בדוק את לוח הזמנים.`,
        icon: 'schedule',
        relatedHref: `${projectPath}/stages`,
      })
    }
    if (s.status === 'in_progress' && !s.start_date) {
      alerts.push({
        id: `stage-no-date-${s.id}`,
        level: 'warning',
        title: `אין תאריך התחלה לשלב "${s.name}"`,
        description: 'הגדר תאריכים כדי לעקוב אחרי לוח הזמנים.',
        icon: 'event',
        relatedHref: `${projectPath}/stages`,
      })
    }
  })

  // ── הצעות מחיר ──
  const pendingCount = quotes.filter(q => q.status === 'pending').length
  if (pendingCount > 0) {
    alerts.push({
      id: 'pending-quotes',
      level: 'info',
      title: `${pendingCount} הצעות מחיר ממתינות`,
      description: 'אשר או דחה הצעות כדי לעדכן את תחזית התקציב.',
      icon: 'request_quote',
      relatedHref: `${projectPath}/quotes`,
    })
  }

  // ── ריאליות תקציב ──
  const budgetCheck = checkBudgetReality({
    house_size: (project as any).house_size ?? null,
    has_basement: (project as any).has_basement ?? false,
    finish_level: (project as any).finish_level ?? null,
    total_budget: project.total_budget ?? null,
  })

  if (budgetCheck?.status === 'unrealistic') {
    alerts.push({
      id: 'budget-unrealistic',
      level: 'critical',
      title: 'תקציב לא ריאלי לפרויקט',
      description: `עלות צפויה: ₪${budgetCheck.estimated_min.toLocaleString('he-IL')} – ₪${budgetCheck.estimated_max.toLocaleString('he-IL')}. חסר לפחות ₪${budgetCheck.shortfall.toLocaleString('he-IL')}.`,
      icon: 'savings',
      relatedHref: `${projectPath}/price-estimate`,
    })
  } else if (budgetCheck?.status === 'borderline') {
    alerts.push({
      id: 'budget-borderline',
      level: 'warning',
      title: 'תקציב גבולי — נדרש ניהול קפדני',
      description: 'התקציב בטווח הצפוי אך ללא מרווח לחריגות בלתי צפויות.',
      icon: 'account_balance_wallet',
      relatedHref: `${projectPath}/price-estimate`,
    })
  }

  // מיון: critical → warning → info
  const order = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.level] - order[b.level])
}

// ─── ENGINE 3: BUDGET FORECAST ────────────────────────────────────────────────

export function getBudgetForecast(input: EngineInput): BudgetForecast {
  const { project, stages, quotes } = input
  const allTasks = stages.flatMap(s => s.tasks ?? [])
  const totalBudget = project.total_budget ?? 0

  const actualCost = allTasks.reduce((s, t) => s + (t.actual_cost ?? 0), 0)
  const approvedQuotesTotal = quotes
    .filter(q => q.status === 'approved' && q.amount)
    .reduce((s, q) => s + (q.amount ?? 0), 0)

  const completedStages = stages.filter(s => s.status === 'completed')
  const remainingStages = stages.filter(s => s.status !== 'completed')

  // חישוב spendRate (ממוצע לשלב)
  const spendRate = completedStages.length > 0
    ? actualCost / completedStages.length
    : stages.length > 0 ? totalBudget / stages.length : 0

  // remainingEstimate — מהשלבים הנותרים
  const remainingByPlanned = remainingStages.reduce((s, st) => s + (st.planned_cost ?? 0), 0)
  const remainingEstimate = remainingByPlanned > 0
    ? remainingByPlanned
    : spendRate * remainingStages.length

  const projectedTotal = actualCost + remainingEstimate
  const projectedOverrun = projectedTotal - totalBudget
  const remainingBudget = totalBudget - actualCost

  let confidenceNote = ''
  if (completedStages.length === 0) {
    confidenceNote = 'תחזית ראשונית — מבוססת על תכנון ראשוני'
  } else if (remainingByPlanned > 0) {
    confidenceNote = 'תחזית גבוהה — מבוססת על תכנון שלבים'
  } else {
    confidenceNote = 'תחזית מבוססת על קצב הוצאות עד כה'
  }

  return {
    projectedTotal,
    projectedOverrun,
    remainingBudget,
    confidenceNote,
    approvedQuotesTotal,
    spendRate,
  }
}

// ─── ENGINE 4: BENCHMARKS ─────────────────────────────────────────────────────

// ממוצעי ענף הבנייה הישראלי (hardcoded)
const INDUSTRY_AVG = {
  skeletonMonths: 4,
  finishingMonths: 8,
  permitMonths: 15,
  budgetMin: 1_200_000,
  budgetMax: 1_800_000,
}

export function getBenchmarks(input: EngineInput): BenchmarkResult {
  const { project, stages } = input
  const comparisons: BenchmarkResult['comparisons'] = []

  const skeletonStage = stages.find(s => s.name.includes('שלד'))
  const finishingStage = stages.find(s => s.name.includes('גמר'))
  const permitStage = stages.find(s => s.name.includes('היתר'))

  let hasAnyDates = false

  // שלב שלד
  if (skeletonStage?.start_date && skeletonStage?.end_date) {
    hasAnyDates = true
    const months = monthsBetween(skeletonStage.start_date, new Date(skeletonStage.end_date))
    comparisons.push({
      label: 'שלב שלד',
      userVal: `${months} חודשים`,
      avgVal: `${INDUSTRY_AVG.skeletonMonths} חודשים`,
      isGood: months <= INDUSTRY_AVG.skeletonMonths,
    })
  } else if (skeletonStage?.start_date) {
    hasAnyDates = true
    const months = monthsBetween(skeletonStage.start_date)
    comparisons.push({
      label: 'שלב שלד (עד היום)',
      userVal: `${months} חודשים`,
      avgVal: `${INDUSTRY_AVG.skeletonMonths} חודשים`,
      isGood: months <= INDUSTRY_AVG.skeletonMonths,
    })
  }

  // שלב גמר
  if (finishingStage?.start_date && finishingStage?.end_date) {
    hasAnyDates = true
    const months = monthsBetween(finishingStage.start_date, new Date(finishingStage.end_date))
    comparisons.push({
      label: 'שלב גמר',
      userVal: `${months} חודשים`,
      avgVal: `${INDUSTRY_AVG.finishingMonths} חודשים`,
      isGood: months <= INDUSTRY_AVG.finishingMonths,
    })
  }

  // היתר בנייה
  if (permitStage?.start_date && permitStage?.end_date) {
    hasAnyDates = true
    const months = monthsBetween(permitStage.start_date, new Date(permitStage.end_date))
    comparisons.push({
      label: 'היתר בנייה',
      userVal: `${months} חודשים`,
      avgVal: `${INDUSTRY_AVG.permitMonths} חודשים`,
      isGood: months <= INDUSTRY_AVG.permitMonths,
    })
  }

  // תקציב כולל
  const totalBudget = project.total_budget ?? 0
  if (totalBudget > 0) {
    const inRange = totalBudget >= INDUSTRY_AVG.budgetMin && totalBudget <= INDUSTRY_AVG.budgetMax
    const belowRange = totalBudget < INDUSTRY_AVG.budgetMin
    comparisons.push({
      label: 'תקציב כולל',
      userVal: formatNIS(totalBudget),
      avgVal: `${formatNIS(INDUSTRY_AVG.budgetMin)}–${formatNIS(INDUSTRY_AVG.budgetMax)}`,
      isGood: inRange ? true : belowRange ? null : false,
    })
  }

  let overallNote = ''
  if (!hasAnyDates && comparisons.length <= 1) {
    overallNote = 'הוסף תאריכים לשלבים לקבלת השוואה מלאה לממוצע הענף'
  } else {
    const goodCount = comparisons.filter(c => c.isGood === true).length
    const badCount = comparisons.filter(c => c.isGood === false).length
    if (badCount === 0 && goodCount > 0) overallNote = 'הפרויקט מתנהל מצוין ביחס לממוצע הענף!'
    else if (badCount > goodCount) overallNote = 'מספר מדדים חורגים מממוצע הענף — כדאי לבדוק'
    else overallNote = 'ביצועי הפרויקט קרובים לממוצע הענף'
  }

  return { comparisons, overallNote }
}
