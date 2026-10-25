import { describe, expect, it } from 'vitest'
import type { SavedCalculationPayload } from './savedCalculations'
import {
  addMonthsToDate,
  buildLoanInput,
  getAnnualRateFromSplit,
  getApplicationFee,
  getLoanTimeline,
  getLoanValidationMessages,
  getMonthIndex,
  getMonthlyAdditionalCost,
  getRateChangeWarning,
  getRegularOverpaymentWarning,
  getTotalAdditionalCosts,
  initialForm,
  payloadToFormState,
  type FormState,
} from './loanForm'

const costForm: FormState = {
  ...initialForm,
  amount: 300_000,
  propertyValue: 400_000,
  applicationFeeCalculationType: 'amount',
  applicationFee: 1000,
  notary: 500,
  appraisal: 300,
  commission: 200,
  lifeInsuranceCalculationType: 'amount',
  lifeInsuranceMonthlyPremium: 100,
  lifeInsuranceMonths: 2,
  lifeInsuranceDurationUnit: 'months',
  propertyInsuranceCalculationType: 'amount',
  propertyInsuranceAmount: 1200,
  propertyInsuranceFrequency: 'annual',
}

describe('date helpers', () => {
  it('adds months across a year boundary', () => {
    expect(addMonthsToDate('2026-11-01', 3)).toBe('2027-02-01')
    expect(addMonthsToDate('2026-01-15', -1)).toBe('2025-12-01')
  })

  it('orders months by index', () => {
    expect(getMonthIndex('2027-01-01')).toBe(getMonthIndex('2026-12-01') + 1)
  })

  it('adds WIBOR and margin without floating point noise', () => {
    expect(getAnnualRateFromSplit(2.7, 2.5)).toBe(5.2)
    expect(getAnnualRateFromSplit(0.1, 0.2)).toBe(0.3)
  })
})

describe('additional costs', () => {
  it('charges one-off fees only in the first month', () => {
    // 1000 + 500 + 300 + 200 fees, 100 life insurance, 1200 / 12 property insurance
    expect(getMonthlyAdditionalCost(1, costForm)).toBe(2000 + 100 + 100)
    expect(getMonthlyAdditionalCost(2, costForm)).toBe(100 + 100)
  })

  it('stops life insurance after its duration but keeps property insurance', () => {
    expect(getMonthlyAdditionalCost(3, costForm)).toBe(100)
    expect(getMonthlyAdditionalCost(120, costForm)).toBe(100)
  })

  it('converts the life insurance duration from years to months', () => {
    const inYears: FormState = { ...costForm, lifeInsuranceMonths: 2, lifeInsuranceDurationUnit: 'years' }

    expect(getMonthlyAdditionalCost(24, inYears)).toBe(200)
    expect(getMonthlyAdditionalCost(25, inYears)).toBe(100)
  })

  it('bases percentage life insurance on the current balance', () => {
    const percentage: FormState = {
      ...costForm,
      lifeInsuranceCalculationType: 'percentage',
      lifeInsuranceRatePercent: 0.05,
    }

    expect(getMonthlyAdditionalCost(2, percentage, 200_000)).toBeCloseTo(100 + 100, 6)
    expect(getMonthlyAdditionalCost(2, percentage, 100_000)).toBeCloseTo(50 + 100, 6)
  })

  it('computes percentage property insurance from the chosen basis', () => {
    const base: FormState = {
      ...costForm,
      propertyInsuranceCalculationType: 'percentage',
      propertyInsuranceRatePercent: 0.1,
      propertyInsuranceFrequency: 'annual',
      lifeInsuranceMonthlyPremium: 0,
    }
    const onProperty = getMonthlyAdditionalCost(2, { ...base, propertyInsuranceBasis: 'propertyValue' })
    const onLoan = getMonthlyAdditionalCost(2, { ...base, propertyInsuranceBasis: 'loanAmount' })

    expect(onProperty).toBeCloseTo((400_000 * 0.001) / 12, 6)
    expect(onLoan).toBeCloseTo((300_000 * 0.001) / 12, 6)
  })

  it('computes a percentage application fee from the loan amount', () => {
    const form: FormState = {
      ...costForm,
      applicationFeeCalculationType: 'percentage',
      applicationFeePercent: 0.43,
    }

    expect(getApplicationFee(form)).toBeCloseTo(1290, 6)
  })

  it('totals the monthly costs over the whole schedule', () => {
    const schedule = [{ remainingBalance: 200_000 }, { remainingBalance: 100_000 }, { remainingBalance: 0 }]
    const total = getTotalAdditionalCosts(costForm, schedule)

    expect(total).toBe(2200 + 200 + 100)
  })

  it('stays at zero for an empty schedule', () => {
    expect(getTotalAdditionalCosts(costForm, [])).toBe(0)
  })
})

describe('buildLoanInput', () => {
  it('maps the form onto calculator input and treats an empty end date as open-ended', () => {
    const form: FormState = {
      ...initialForm,
      years: 20,
      rate: 6,
      rateChanges: [{ id: 1, date: '2027-01-01', wibor: 3, margin: 2 }],
      regularOverpayments: [
        { id: 2, amount: 500, startDate: '2026-02-01', endDate: '', effect: 'reduceTerm' },
      ],
      extraPayments: [{ id: 3, amount: 10_000, date: '2026-06-01', effect: 'reduceInstallment' }],
    }
    const input = buildLoanInput(form)

    expect(input.termMonths).toBe(240)
    expect(input.rateChanges).toEqual([{ date: '2027-01-01', rate: 5 }])
    expect(input.recurringExtraPayments).toEqual([
      { amount: 500, startDate: '2026-02-01', endDate: undefined, effect: 'reduceTerm' },
    ])
    expect(input.extraPayments).toEqual([
      { amount: 10_000, date: '2026-06-01', effect: 'reduceInstallment' },
    ])
  })
})

describe('payloadToFormState', () => {
  const legacyPayload = {
    amount: 300_000,
    loanStartDate: '2026-03-01',
    rate: 6,
    years: 25,
    repaymentType: 'annuity',
    rateChanges: [{ id: 1, date: '2027-03-01', rate: 7 }],
    extraMonthlyPayment: 300,
    extraMonthlyPaymentStartDate: '2026-09-01',
    extraPaymentMode: 'reduceInstallment',
    extraPayments: [],
    applicationFee: 0,
    insurance: 0,
    notary: 0,
    appraisal: 0,
    commission: 0,
    propertyValue: 400_000,
    lifeInsuranceMonthlyPremium: 0,
    lifeInsuranceMonths: 0,
    lifeInsuranceDurationUnit: 'months',
    propertyInsuranceFrequency: 'monthly',
    propertyInsuranceBasis: 'propertyValue',
    propertyInsuranceRatePercent: 0,
  } as SavedCalculationPayload

  it('turns the legacy monthly overpayment into a regular overpayment', () => {
    const form = payloadToFormState(legacyPayload)

    expect(form.regularOverpayments).toEqual([
      { id: 1, amount: 300, startDate: '2026-09-01', endDate: '', effect: 'reduceInstallment' },
    ])
  })

  it('treats the legacy total rate as WIBOR with no margin', () => {
    const form = payloadToFormState(legacyPayload)

    expect(form.wibor).toBe(6)
    expect(form.margin).toBe(0)
    expect(form.rate).toBe(6)
  })

  it('derives WIBOR for a legacy rate change from its total rate and the margin', () => {
    const form = payloadToFormState(legacyPayload)

    expect(form.rateChanges).toEqual([{ id: 1, date: '2027-03-01', wibor: 7, margin: 0 }])
  })

  it('does not share nested objects with the stored payload', () => {
    const payload = {
      ...legacyPayload,
      extraPayments: [{ id: 5, amount: 1000, date: '2026-05-01', effect: 'reduceTerm' }],
    } as SavedCalculationPayload
    const form = payloadToFormState(payload)

    form.extraPayments[0].amount = 1
    expect(payload.extraPayments[0].amount).toBe(1000)
  })
})

describe('validation and warnings', () => {
  it('reports an amount above the property value and an out-of-range term', () => {
    const messages = getLoanValidationMessages({
      ...initialForm,
      amount: 500_000,
      propertyValue: 400_000,
      years: 45,
    })

    expect(messages).toHaveLength(2)
  })

  it('reports nothing for the default form', () => {
    expect(getLoanValidationMessages(initialForm)).toEqual([])
  })

  const timeline = getLoanTimeline('2026-01-01', 12)

  it('computes the last month of the loan', () => {
    expect(timeline.endIndex - timeline.startIndex).toBe(11)
  })

  it('warns about rate changes after the loan ends, before it starts and duplicated in a month', () => {
    const after = { id: 1, date: '2027-02-01', wibor: 3, margin: 2 }
    const before = { id: 2, date: '2025-12-01', wibor: 3, margin: 2 }
    const inside = { id: 3, date: '2026-06-01', wibor: 3, margin: 2 }
    const duplicate = { id: 4, date: '2026-06-01', wibor: 4, margin: 2 }

    expect(getRateChangeWarning(after, [after], timeline)).toMatch(/po zakończeniu/)
    expect(getRateChangeWarning(before, [before], timeline)).toMatch(/sprzed startu/)
    expect(getRateChangeWarning(inside, [inside], timeline)).toBeNull()
    expect(getRateChangeWarning(inside, [inside, duplicate], timeline)).toMatch(/Kilka zmian/)
  })

  it('warns about overpayments that end before they start or start after the loan ends', () => {
    const inverted = { id: 1, amount: 500, startDate: '2026-06-01', endDate: '2026-02-01', effect: 'reduceTerm' as const }
    const late = { id: 2, amount: 500, startDate: '2027-06-01', endDate: '', effect: 'reduceTerm' as const }
    const fine = { id: 3, amount: 500, startDate: '2026-02-01', endDate: '', effect: 'reduceTerm' as const }

    expect(getRegularOverpaymentWarning(inverted, timeline)).toMatch(/Koniec jest przed początkiem/)
    expect(getRegularOverpaymentWarning(late, timeline)).toMatch(/Start po zakończeniu/)
    expect(getRegularOverpaymentWarning(fine, timeline)).toBeNull()
  })
})
