import { describe, expect, it } from 'vitest'
import { calculateLoanSummary } from './calculator'

describe('calculateLoanSummary', () => {
  it.each(['annuity', 'decreasing'] as const)(
    'keeps the scheduled repayment and shortens the term for reduceTerm with %s repayments',
    (repaymentType) => {
      const input = {
        loanAmount: 120000,
        annualRate: 6,
        termMonths: 60,
        repaymentType,
        loanStartDate: '2026-01-01',
        extraMonthlyPayment: 500,
        extraMonthlyPaymentStartDate: '2026-07-01',
      }
      const baseline = calculateLoanSummary({ ...input, extraMonthlyPayment: 0 })
      const result = calculateLoanSummary({ ...input, extraPaymentMode: 'reduceTerm' as const })

      expect(result.loanTermMonths).toBeLessThan(input.termMonths)
      result.schedule.slice(0, -1).forEach((row, index) => {
        if (repaymentType === 'annuity') {
          expect(row.payment).toBeCloseTo(baseline.schedule[index].payment, 2)
        } else {
          expect(row.principal - row.extraPayment).toBeCloseTo(baseline.schedule[index].principal, 2)
        }
      })
    },
  )

  it.each(['annuity', 'decreasing'] as const)(
    'lowers regular installments without shortening the planned term for reduceInstallment with %s repayments',
    (repaymentType) => {
      const input = {
        loanAmount: 120000,
        annualRate: 6,
        termMonths: 60,
        repaymentType,
        loanStartDate: '2026-01-01',
        extraMonthlyPayment: 500,
        extraMonthlyPaymentStartDate: '2026-07-01',
      }
      const baseline = calculateLoanSummary({ ...input, extraMonthlyPayment: 0 })
      const result = calculateLoanSummary({ ...input, extraPaymentMode: 'reduceInstallment' as const })

      expect(result.loanTermMonths).toBe(input.termMonths)
      expect(result.schedule[6].payment).toBeCloseTo(baseline.schedule[6].payment, 2)
      expect(result.schedule[7].payment).toBeLessThan(baseline.schedule[7].payment)
    },
  )

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

  it('starts a recurring extra payment only from the selected date', () => {
    const result = calculateLoanSummary({
      loanAmount: 300000,
      annualRate: 5,
      termMonths: 180,
      repaymentType: 'annuity',
      loanStartDate: '2026-01-01',
      extraMonthlyPayment: 500,
      extraMonthlyPaymentStartDate: '2027-10-01',
      extraPaymentMode: 'reduceTerm',
    })

    const baselinePayment = result.schedule[0].payment
    const firstExtraMonth = result.schedule[21]
    const laterMonth = result.schedule[34]

    expect(result.schedule[0].payment).toBeCloseTo(baselinePayment, 5)
    expect(firstExtraMonth.payment).toBeCloseTo(baselinePayment, 5)
    expect(firstExtraMonth.extraPayment).toBeGreaterThan(0)
    expect(laterMonth.payment).toBeCloseTo(baselinePayment, 2)
    expect(laterMonth.extraPayment).toBeGreaterThan(0)
    expect(result.loanTermMonths).toBeLessThan(180)
  })

  it('supports multiple one-off extra payments on different dates', () => {
    const result = calculateLoanSummary({
      loanAmount: 300000,
      annualRate: 5,
      termMonths: 180,
      repaymentType: 'annuity',
      loanStartDate: '2026-01-01',
      extraPayments: [
        { amount: 1000, date: '2027-02-15' },
        { amount: 2000, date: '2028-03-10' },
      ],
      extraPaymentMode: 'reduceTerm',
    })

    expect(result.schedule[13].payment).toBeCloseTo(result.schedule[0].payment, 2)
    expect(result.schedule[13].extraPayment).toBeGreaterThan(0)
    expect(result.schedule[26].payment).toBeCloseTo(result.schedule[0].payment, 2)
    expect(result.schedule[26].extraPayment).toBeGreaterThan(0)
    expect(result.loanTermMonths).toBeLessThan(180)
    expect(result.remainingBalance).toBeLessThan(300000)
  })

  it('applies an extra payment to interest calculations from the following month', () => {
    const input = {
      loanAmount: 120000,
      annualRate: 12,
      termMonths: 12,
      repaymentType: 'annuity' as const,
      loanStartDate: '2026-01-01',
    }
    const baseline = calculateLoanSummary(input)
    const withExtraPayment = calculateLoanSummary({
      ...input,
      extraPayments: [{ amount: 10000, date: '2026-02-15' }],
    })

    expect(withExtraPayment.schedule[1].extraPayment).toBe(10000)
    expect(withExtraPayment.schedule[1].interest).toBe(baseline.schedule[1].interest)
    expect(withExtraPayment.schedule[1].payment).toBe(baseline.schedule[1].payment)
    expect(withExtraPayment.schedule[2].interest).toBeLessThan(baseline.schedule[2].interest)
  })

  it('caps an extra payment at the amount needed to pay off the remaining balance', () => {
    const result = calculateLoanSummary({
      loanAmount: 10000,
      annualRate: 12,
      termMonths: 12,
      repaymentType: 'annuity',
      loanStartDate: '2026-01-01',
      extraMonthlyPayment: 20000,
      extraMonthlyPaymentStartDate: '2026-01-01',
      extraPaymentMode: 'reduceTerm',
    })
    const finalRow = result.schedule[0]

    expect(finalRow.remainingBalance).toBe(0)
    expect(finalRow.principal).toBe(10000)
    expect(finalRow.extraPayment).toBeLessThan(20000)
    expect(result.totalPaid).toBeCloseTo(finalRow.payment + finalRow.extraPayment, 2)
  })

  it('uses the latest valid rate change when several changes occur over time', () => {
    const result = calculateLoanSummary({
      loanAmount: 300000,
      annualRate: 5,
      termMonths: 180,
      repaymentType: 'annuity',
      loanStartDate: '2026-01-01',
      rateChanges: [
        { date: '2027-02-01', rate: 5.5 },
        { date: '2028-03-01', rate: 6.5 },
      ],
    })

    const firstHigherInterestMonth = result.schedule.findIndex(
      (row) => row.interest > result.schedule[0].interest,
    )

    expect(firstHigherInterestMonth).toBeGreaterThan(0)
    expect(firstHigherInterestMonth).toBeLessThan(result.schedule.length)
    expect(result.totalInterest).toBeGreaterThan(90000)
  })

  it('keeps the installment unchanged and adds the extra payment above the rate', () => {
    const result = calculateLoanSummary({
      loanAmount: 300000,
      annualRate: 5,
      termMonths: 180,
      repaymentType: 'annuity',
      loanStartDate: '2026-01-01',
      extraMonthlyPayment: 500,
      extraMonthlyPaymentStartDate: '2027-10-01',
      extraPaymentMode: 'reduceInstallment',
    })

    expect(result.schedule[0].payment).toBeCloseTo(2372.38, 2)
    expect(result.schedule[21].payment).toBeCloseTo(result.schedule[0].payment, 2)
    expect(result.schedule[21].extraPayment).toBeGreaterThan(0)
  })
  it('applies a rate change from the selected date onward', () => {
    const result = calculateLoanSummary({
      loanAmount: 300000,
      annualRate: 5,
      termMonths: 180,
      repaymentType: 'annuity',
      loanStartDate: '2026-01-01',
      rateChanges: [{ date: '2028-02-01', rate: 6.5 }],
    })

    expect(result.schedule[0].interest).toBeCloseTo(1250, 2)
    expect(result.schedule[24].interest).toBeLessThan(result.schedule[25].interest)
    expect(result.schedule[25].payment).toBeGreaterThan(result.schedule[0].payment)
  })

  it('ignores extra payments before their start date for recurring payments', () => {
    const result = calculateLoanSummary({
      loanAmount: 300000,
      annualRate: 5,
      termMonths: 180,
      repaymentType: 'annuity',
      loanStartDate: '2026-01-01',
      extraMonthlyPayment: 500,
      extraMonthlyPaymentStartDate: '2028-01-01',
      extraPaymentMode: 'reduceTerm',
    })

    const firstExtraPaymentMonth = result.schedule.findIndex((row) => row.extraPayment > 0)

    expect(result.schedule[0].extraPayment).toBe(0)
    expect(firstExtraPaymentMonth).toBeGreaterThan(0)
    expect(result.schedule[firstExtraPaymentMonth].extraPayment).toBeGreaterThan(0)
    expect(
      result.schedule.slice(0, firstExtraPaymentMonth).every((row) => row.extraPayment === 0),
    ).toBe(true)
  })
})
