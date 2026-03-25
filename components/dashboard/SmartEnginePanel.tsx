'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatNIS } from '@/components/shared/CurrencyDisplay'
import type { SmartAction, SmartAlert, BudgetForecast, BenchmarkResult } from '@/lib/smart-engine'

// ─── PROPS ────────────────────────────────────────────────────────────────────

interface SmartEnginePanelProps {
  action: SmartAction
  alerts: SmartAlert[]
  forecast: BudgetForecast
  benchmarks: BenchmarkResult
  totalBudget: number
  actualCost: number
}

// ─── MAIN PANEL ───────────────────────────────────────────────────────────────

export function SmartEnginePanel({
  action, alerts,
}: Pick<SmartEnginePanelProps, 'action' | 'alerts'>) {
  return (
    <div className="space-y-3">
      <NextActionCard action={action} />
      {alerts.length > 0 && <SmartAlertsCard alerts={alerts} />}
    </div>
  )
}

// ─── NEXT ACTION CARD ─────────────────────────────────────────────────────────

const urgencyConfig = {
  critical: {
    badge: 'bg-red-500 text-white',
    label: 'קריטי',
    glow: 'ring-1 ring-red-200',
    iconColor: 'text-red-300',
  },
  important: {
    badge: 'bg-amber-500 text-white',
    label: 'חשוב',
    glow: 'ring-1 ring-amber-200',
    iconColor: 'text-amber-300',
  },
  normal: {
    badge: 'bg-indigo-500 text-white',
    label: 'רגיל',
    glow: '',
    iconColor: 'text-indigo-300',
  },
}

function NextActionCard({ action }: { action: SmartAction }) {
  const cfg = urgencyConfig[action.urgency]
  return (
    <div
      className={`rounded-2xl p-5 ${cfg.glow}`}
      style={{
        background: 'linear-gradient(135deg, #0d1b2e 0%, #1a3855 100%)',
      }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
          <span className={`material-symbols-rounded text-2xl ${cfg.iconColor}`}>{action.icon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-xs font-bold text-white/50 tracking-widest uppercase">מה לעשות עכשיו?</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
          </div>
          <h3 className="text-base font-bold text-white leading-tight">{action.title}</h3>
          <p className="text-sm text-white/60 mt-1 leading-relaxed">{action.description}</p>

          {action.actionLabel && action.actionHref && (
            <Link
              href={action.actionHref}
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
            >
              {action.actionLabel}
              <span className="material-symbols-rounded text-sm">arrow_back</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SMART ALERTS CARD ────────────────────────────────────────────────────────

const alertLevelConfig = {
  critical: {
    border: 'border-r-red-500',
    bg: 'bg-red-50',
    icon: 'text-red-500',
    dot: 'bg-red-500',
  },
  warning: {
    border: 'border-r-amber-400',
    bg: 'bg-amber-50',
    icon: 'text-amber-500',
    dot: 'bg-amber-400',
  },
  info: {
    border: 'border-r-blue-400',
    bg: 'bg-blue-50',
    icon: 'text-blue-500',
    dot: 'bg-blue-400',
  },
}

function SmartAlertsCard({ alerts }: { alerts: SmartAlert[] }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-xl text-indigo-500">shield</span>
          <span className="text-sm font-bold text-gray-800">התראות חכמות</span>
          {alerts.length > 0 && (
            <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        <span className={`material-symbols-rounded text-gray-400 transition-transform ${open ? '' : 'rotate-180'}`}>
          expand_less
        </span>
      </button>

      {/* Alerts List */}
      {open && (
        <div className="border-t border-gray-100">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 px-5 py-4 text-sm text-emerald-600">
              <span className="material-symbols-rounded text-emerald-500">check_circle</span>
              הכל תקין — אין התראות פעילות
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {alerts.map(alert => {
                const cfg = alertLevelConfig[alert.level]
                return (
                  <div key={alert.id} className={`flex items-start gap-3 px-4 py-3 border-r-4 ${cfg.border} ${cfg.bg}`}>
                    <span className={`material-symbols-rounded text-base mt-0.5 flex-shrink-0 ${cfg.icon}`}>
                      {alert.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{alert.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{alert.description}</p>
                    </div>
                    {alert.relatedHref && (
                      <Link href={alert.relatedHref} className="flex-shrink-0 text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                        פרטים
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── BUDGET FORECAST CARD ─────────────────────────────────────────────────────

function BudgetForecastCard({
  forecast, totalBudget, actualCost,
}: { forecast: BudgetForecast; totalBudget: number; actualCost: number }) {
  const currentPct = totalBudget > 0 ? Math.min((actualCost / totalBudget) * 100, 100) : 0
  const projectedPct = totalBudget > 0 ? Math.min((forecast.projectedTotal / totalBudget) * 100, 100) : 0
  const isOverrun = forecast.projectedOverrun > 0
  const overrunColor = isOverrun ? 'text-red-600' : 'text-emerald-600'

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-rounded text-xl text-indigo-500">trending_up</span>
        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">תחזית תקציב</p>
      </div>

      {totalBudget === 0 ? (
        <p className="text-xs text-gray-400">הגדר תקציב כולל לפרויקט לקבלת תחזית</p>
      ) : (
        <>
          {/* Progress bars */}
          <div className="space-y-2 mb-4">
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>בפועל</span>
                <span>{Math.round(currentPct)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${currentPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>תחזית</span>
                <span>{Math.round(projectedPct)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isOverrun ? 'bg-red-400' : 'bg-emerald-400'}`}
                  style={{ width: `${projectedPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-400 mb-0.5">תחזית סופית</p>
              <p className="text-sm font-bold text-gray-900">{formatNIS(forecast.projectedTotal)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-400 mb-0.5">{isOverrun ? 'חריגה' : 'חיסכון'}</p>
              <p className={`text-sm font-bold ${overrunColor}`}>
                {isOverrun ? '+' : '-'}{formatNIS(Math.abs(forecast.projectedOverrun))}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-400 mb-0.5">יתרה</p>
              <p className="text-sm font-bold text-gray-900">{formatNIS(forecast.remainingBudget)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-400 mb-0.5">הצעות מאושרות</p>
              <p className="text-sm font-bold text-indigo-600">
                {forecast.approvedQuotesTotal > 0 ? formatNIS(forecast.approvedQuotesTotal) : '—'}
              </p>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 mt-2 text-center">{forecast.confidenceNote}</p>
        </>
      )}
    </div>
  )
}

// ─── BENCHMARK CARD ───────────────────────────────────────────────────────────

function BenchmarkCard({ benchmarks }: { benchmarks: BenchmarkResult }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-rounded text-xl text-violet-500">bar_chart</span>
        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">מול הממוצע</p>
      </div>

      {benchmarks.comparisons.length === 0 ? (
        <p className="text-xs text-gray-400 leading-relaxed">{benchmarks.overallNote}</p>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {benchmarks.comparisons.map((comp, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 truncate">{comp.label}</p>
                  <p className="text-xs font-semibold text-gray-800">{comp.userVal}</p>
                </div>
                <div className="text-left flex-shrink-0">
                  <p className="text-[10px] text-gray-400">ממוצע</p>
                  <p className="text-xs text-gray-500">{comp.avgVal}</p>
                </div>
                <div className="flex-shrink-0 w-5 text-center">
                  {comp.isGood === true && (
                    <span className="material-symbols-rounded text-base text-emerald-500">check_circle</span>
                  )}
                  {comp.isGood === false && (
                    <span className="material-symbols-rounded text-base text-red-400">cancel</span>
                  )}
                  {comp.isGood === null && (
                    <span className="material-symbols-rounded text-base text-gray-300">help</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 border-t border-gray-100 pt-2">{benchmarks.overallNote}</p>
        </>
      )}
    </div>
  )
}
