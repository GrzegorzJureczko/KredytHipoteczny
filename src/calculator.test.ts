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
          expect(row.principal).toBeCloseTo(baseline.schedule[index].principal, 2)
        }
        expect(row.payment).toBeCloseTo(row.principal + row.interest, 1)
      })
    },
  )

  it.each(['annuity', 'decreasing'] as const)(
    'recalculates each reduceInstallment payment for %s repayments without forecasting future recurring extras',
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

      expect(result.loanTermMonths).toBeGreaterThanOrEqual(input.termMonths - 1)
      expect(result.loanTermMonths).toBeLessThanOrEqual(input.termMonths)
      expect(result.schedule[6].payment).toBeCloseTo(baseline.schedule[6].payment, 2)
      expect(result.schedule[7].payment).toBeLessThan(baseline.schedule[7].payment)
      result.schedule.forEach((row) => {
        expect(row.payment).toBeCloseTo(row.principal + row.interest, 1)
      })
      expect(baseline.schedule[7].payment - result.schedule[7].payment).toBeLessThan(
        input.extraMonthlyPayment,
      )
      expect(result.schedule[8].payment).toBeLessThan(result.schedule[7].payment)
    },
  )

  it('gives the same schedule totals for a start date in the past or future', () => {
    const input = {
      loanAmount: 300000,
      annualRate: 5,
      termMonths: 360,
      repaymentType: 'annuity' as const,
    }
    const past = calculateLoanSummary({ ...input, loanStartDate: '2020-03-01' })
    const future = calculateLoanSummary({ ...input, loanStartDate: '2030-03-01' })

    expect(past.schedule.length).toBe(future.schedule.length)
    expect(past.totalPaid).toBeCloseTo(future.totalPaid, 2)
    expect(past.totalInterest).toBeCloseTo(future.totalInterest, 2)
    expect(past.schedule[0].payment).toBeCloseTo(future.schedule[0].payment, 2)
  })

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

  it('accepts year-month dates and applies a rate change from that month', () => {
    const result = calculateLoanSummary({
      loanAmount: 120000,
      annualRate: 5,
      termMonths: 12,
      repaymentType: 'annuity',
      loanStartDate: '2026-01',
      rateChanges: [{ date: '2026-03', rate: 6.5 }],
    })

    expect(result.schedule[0].annualRate).toBe(5)
    expect(result.schedule[1].annualRate).toBe(5)
    expect(result.schedule[2].annualRate).toBe(6.5)
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
    expect(finalRow.principal + finalRow.extraPayment).toBeCloseTo(10000, 2)
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
    expect(result.schedule[0].annualRate).toBe(5)
    expect(result.schedule[24].annualRate).toBe(5)
    expect(result.schedule[25].annualRate).toBe(6.5)
    expect(result.schedule[24].interest).toBeLessThan(result.schedule[25].interest)
    expect(result.schedule[25].payment).toBeGreaterThan(result.schedule[0].payment)
  })

  it('updates installments on rate changes even after an extra payment with reduceInstallment', () => {
    const result = calculateLoanSummary({
      loanAmount: 681920,
      annualRate: 7.55,
      termMonths: 300,
      repaymentType: 'annuity',
      loanStartDate: '2025-06-01',
      extraPayments: [
        { amount: 383953, date: '2025-06-01', effect: 'reduceInstallment' },
      ],
      rateChanges: [
        { date: '2025-07-01', rate: 7.04 },
        { date: '2025-08-01', rate: 6.81 },
        { date: '2025-09-01', rate: 6.52 },
        { date: '2025-11-01', rate: 6.30 },
      ],
    })

    // Month 1 (June 2025): initial rate 7.55%
    expect(result.schedule[0].payment).toBeCloseTo(5061.53, 2)
    expect(result.schedule[0].extraPayment).toBe(383953)

    // Month 2 (July 2025): recast due to overpayment + rate 7.04%
    const julyPayment = result.schedule[1].payment
    expect(julyPayment).toBeLessThan(result.schedule[0].payment)

    // Month 3 (August 2025): rate drops to 6.81%, installment MUST drop
    const augPayment = result.schedule[2].payment
    expect(augPayment).toBeLessThan(julyPayment)

    // Month 4 (September 2025): rate drops to 6.52%, installment MUST drop
    const sepPayment = result.schedule[3].payment
    expect(sepPayment).toBeLessThan(augPayment)

    // Month 5 (October 2025): rate unchanged at 6.52%, installment stays constant
    const octPayment = result.schedule[4].payment
    expect(octPayment).toBeCloseTo(sepPayment, 2)

    // Month 6 (November 2025): rate drops to 6.30%, installment MUST drop
    const novPayment = result.schedule[5].payment
    expect(novPayment).toBeLessThan(octPayment)

    // Month 7 (December 2025): rate unchanged at 6.30%, installment stays constant
    const decPayment = result.schedule[6].payment
    expect(decPayment).toBeCloseTo(novPayment, 2)
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

  describe('recurring extra payments with a start and an end', () => {
    const base = {
      loanAmount: 120000,
      annualRate: 6,
      termMonths: 60,
      repaymentType: 'annuity' as const,
      loanStartDate: '2026-01-01',
    }

    it('pays only within the selected months, end month included', () => {
      const result = calculateLoanSummary({
        ...base,
        recurringExtraPayments: [{ amount: 500, startDate: '2026-07-01', endDate: '2026-12-01' }],
      })

      result.schedule.forEach((row, index) => {
        // index 6 = July 2026 ... index 11 = December 2026
        expect(row.extraPayment).toBe(index >= 6 && index <= 11 ? 500 : 0)
      })
    })

    it('runs until the end of the loan when no end date is given', () => {
      const result = calculateLoanSummary({
        ...base,
        recurringExtraPayments: [{ amount: 500, startDate: '2026-07-01' }],
      })

      expect(result.schedule[6].extraPayment).toBe(500)
      expect(result.schedule[result.schedule.length - 2].extraPayment).toBe(500)
    })

    it('adds several recurring payments that overlap in the same month', () => {
      const result = calculateLoanSummary({
        ...base,
        recurringExtraPayments: [
          { amount: 300, startDate: '2026-03-01', endDate: '2026-08-01' },
          { amount: 200, startDate: '2026-06-01' },
        ],
      })

      expect(result.schedule[3].extraPayment).toBe(300)
      expect(result.schedule[6].extraPayment).toBe(500)
      expect(result.schedule[9].extraPayment).toBe(200)
    })

    it('ignores a payment whose end is before its start', () => {
      const baseline = calculateLoanSummary(base)
      const result = calculateLoanSummary({
        ...base,
        recurringExtraPayments: [{ amount: 500, startDate: '2026-09-01', endDate: '2026-03-01' }],
      })

      expect(result.totalInterest).toBeCloseTo(baseline.totalInterest, 2)
      expect(result.loanTermMonths).toBe(baseline.loanTermMonths)
    })

    it('uses the effect of each payment separately', () => {
      const reduceTerm = calculateLoanSummary({
        ...base,
        recurringExtraPayments: [
          { amount: 500, startDate: '2026-07-01', effect: 'reduceTerm' },
        ],
      })
      const reduceInstallment = calculateLoanSummary({
        ...base,
        recurringExtraPayments: [
          { amount: 500, startDate: '2026-07-01', effect: 'reduceInstallment' },
        ],
      })

      expect(reduceTerm.schedule[8].payment).toBeCloseTo(reduceTerm.schedule[7].payment, 2)
      expect(reduceInstallment.schedule[8].payment).toBeLessThan(
        reduceInstallment.schedule[7].payment,
      )
    })

    it('combines the legacy monthly extra payment with new recurring payments', () => {
      const result = calculateLoanSummary({
        ...base,
        extraMonthlyPayment: 500,
        extraMonthlyPaymentStartDate: '2026-07-01',
        recurringExtraPayments: [{ amount: 200, startDate: '2026-07-01' }],
      })

      expect(result.schedule[6].extraPayment).toBe(700)
    })
  })

  describe('rate changes to zero', () => {
    it('applies a 0% rate change as 0% instead of falling back to the base rate', () => {
      const result = calculateLoanSummary({
        loanAmount: 120000,
        annualRate: 5,
        termMonths: 60,
        repaymentType: 'annuity',
        loanStartDate: '2026-01-01',
        rateChanges: [{ date: '2027-01-01', rate: 0 }],
      })

      const balanceBeforeChange = result.schedule[11].remainingBalance
      const changeMonth = result.schedule[12]

      expect(changeMonth.annualRate).toBe(0)
      expect(changeMonth.interest).toBe(0)
      expect(changeMonth.payment).toBeCloseTo(balanceBeforeChange / 48, 1)
      result.schedule.forEach((row) => {
        expect(Number.isFinite(row.payment)).toBe(true)
        expect(Number.isFinite(row.remainingBalance)).toBe(true)
      })
      expect(result.schedule[result.schedule.length - 1].remainingBalance).toBe(0)
    })

    it('keeps decreasing installments finite when the rate drops to zero', () => {
      const result = calculateLoanSummary({
        loanAmount: 120000,
        annualRate: 5,
        termMonths: 60,
        repaymentType: 'decreasing',
        loanStartDate: '2026-01-01',
        rateChanges: [{ date: '2027-01-01', rate: 0 }],
      })

      expect(result.schedule[12].interest).toBe(0)
      expect(result.schedule[12].payment).toBeCloseTo(result.schedule[12].principal, 2)
      expect(result.schedule[result.schedule.length - 1].remainingBalance).toBe(0)
    })

    it('still supports a loan that starts at 0% with a later increase', () => {
      const result = calculateLoanSummary({
        loanAmount: 60000,
        annualRate: 0,
        termMonths: 60,
        repaymentType: 'annuity',
        loanStartDate: '2026-01-01',
        rateChanges: [{ date: '2027-01-01', rate: 6 }],
      })

      expect(result.schedule[0].payment).toBeCloseTo(1000, 2)
      expect(result.schedule[12].interest).toBeGreaterThan(0)
      expect(Number.isFinite(result.totalPaid)).toBe(true)
    })
  })
})
