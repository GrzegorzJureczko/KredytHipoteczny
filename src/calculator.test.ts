import { describe, expect, it } from 'vitest'
import { calculateLoanSummary } from './calculator'

describe('calculateLoanSummary', () => {
  it('calculates annuity for a standard mortgage', () => {
    const result = calculateLoanSummary({
      loanAmount: 300000,
      annualRate: 5,
      termMonths: 360,
      repaymentType: 'annuity',
      startMonth: 0,
    })

    expect(result.monthlyPayment).toBeCloseTo(1610.46, 2)
    expect(result.totalInterest).toBeGreaterThan(270000)
    expect(result.totalPaid).toBeGreaterThan(300000)
  })

  it('accepts decreasing installments and remains coherent', () => {
    const result = calculateLoanSummary({
      loanAmount: 300000,
      annualRate: 5,
      termMonths: 360,
      repaymentType: 'decreasing',
      startMonth: 0,
    })

    expect(result.monthlyPayment).toBeGreaterThan(1200)
    expect(result.schedule.length).toBe(360)
  })
})
