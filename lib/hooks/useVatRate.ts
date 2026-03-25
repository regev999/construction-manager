'use client'

import { useState, useEffect } from 'react'

const VAT_KEY = 'bm_vat_pct'
const DEFAULT_VAT = 17

export function useVatRate() {
  const [vatRate, setVatRateState] = useState<number>(DEFAULT_VAT)

  useEffect(() => {
    const stored = localStorage.getItem(VAT_KEY)
    if (stored) {
      const n = parseFloat(stored)
      if (!isNaN(n) && n >= 0 && n <= 100) setVatRateState(n)
    }
  }, [])

  function setVatRate(rate: number) {
    setVatRateState(rate)
    localStorage.setItem(VAT_KEY, String(rate))
  }

  function applyVat(amount: number, includesVat: boolean): number {
    if (includesVat) return amount
    return amount * (1 + vatRate / 100)
  }

  return { vatRate, setVatRate, applyVat }
}

export function getStoredVatRate(): number {
  if (typeof window === 'undefined') return DEFAULT_VAT
  const stored = localStorage.getItem(VAT_KEY)
  if (!stored) return DEFAULT_VAT
  const n = parseFloat(stored)
  return !isNaN(n) && n >= 0 && n <= 100 ? n : DEFAULT_VAT
}
