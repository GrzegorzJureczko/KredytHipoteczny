import { describe, expect, it } from 'vitest'
import { calculateLoanSummary } from './calculator'
import {
  buildLoanInput,
  getLoanTimeline,
  getTotalAdditionalCosts,
  initialForm,
  type FormState,
} from './loanForm'
import { buildScheduleRows, groupScheduleByYear, sumScheduleRows } from './scheduleView'
import { buildSummaryView, hasAnyOverpayment } from './summaryView'

const baseForm: FormState = {
  ...initialForm,
  amount: 200_000,
  propertyValue: 300_000,
  loanStartDate: '2026-11-01',
  years: 3,
  rate: 6,
  wibor: 3,
  margin: 3,
  repaymentType: 'annuity',
  rateChanges: [],
  regularOverpayments: [],
  extraPayments: [],
}

const calculate = (form: FormState) => {
  const summary = calculateLoanSummary(buildLoanInput(form))
  const timeline = getLoanTimeline(form.loanStartDate, summary.loanTermMonths)
  const rows = buildScheduleRows(form, summary.schedule, timeline)

  return { summary, timeline, rows }
}

describe('buildScheduleRows', () => {
  it('assigns calendar months starting from the loan start date', () => {
    const { rows } = calculate(baseForm)

    expect(rows[0].monthLabel).toBe('listopad 2026')
    expect(rows[1].monthLabel).toBe('grudzień 2026')
    expect(rows[2].monthLabel).toBe('styczeń 2027')
    expect(rows[2].year).toBe(2027)
  })

  it('marks only the last row with the last installment tag', () => {
    const { rows } = calculate(baseForm)
    const withLastTag = rows.filter((row) => row.events.some((event) => event.key === 'last'))

    expect(withLastTag).toHaveLength(1)
    expect(withLastTag[0]).toBe(rows[rows.length - 1])
  })

  it('tags the month of a one-off overpayment and the start and end of a regular one', () => {
    const { rows } = calculate({
      ...baseForm,
      extraPayments: [{ id: 1, amount: 5000, date: '2027-02-01', effect: 'reduceTerm' }],
      regularOverpayments: [
        { id: 2, amount: 500, startDate: '2027-04-01', endDate: '2027-08-01', effect: 'reduceTerm' },
      ],
    })
    const keysFor = (monthLabel: string) =>
      rows.find((row) => row.monthLabel === monthLabel)?.events.map((event) => event.key)

    expect(keysFor('luty 2027')).toEqual(['onetime'])
    expect(keysFor('kwiecień 2027')).toEqual(['regularStart'])
    expect(keysFor('sierpień 2027')).toEqual(['regularEnd'])
    expect(keysFor('maj 2027')).toEqual([])
  })

  it('moves a regular overpayment that starts before the loan to the first month', () => {
    const { rows } = calculate({
      ...baseForm,
      regularOverpayments: [
        { id: 1, amount: 500, startDate: '2026-01-01', endDate: '', effect: 'reduceTerm' },
      ],
    })

    expect(rows[0].events.map((event) => event.key)).toContain('regularStart')
  })

  it('does not tag zero-amount overpayments', () => {
    const { rows } = calculate({
      ...baseForm,
      extraPayments: [{ id: 1, amount: 0, date: '2027-02-01', effect: 'reduceTerm' }],
    })

    expect(rows.flatMap((row) => row.events).map((event) => event.key)).toEqual(['last'])
  })

  it('flags the months where the interest rate changes', () => {
    const { rows } = calculate({
      ...baseForm,
      rateChanges: [{ id: 1, date: '2027-03-01', wibor: 4, margin: 3 }],
    })
    const changed = rows.filter((row) => row.rateChanged).map((row) => row.monthLabel)

    expect(changed).toEqual(['listopad 2026', 'marzec 2027'])
  })
})

describe('year sections', () => {
  it('group rows by calendar year and keep the totals consistent with the rows', () => {
    const { rows } = calculate(baseForm)
    const sections = groupScheduleByYear(rows)

    expect(sections.map((section) => section.year)).toEqual([2026, 2027, 2028, 2029])
    expect(sections.flatMap((section) => section.rows)).toHaveLength(rows.length)

    for (const section of sections) {
      const payment = section.rows.reduce((sum, row) => sum + row.payment, 0)
      expect(section.totals.payment).toBeCloseTo(payment, 6)
      expect(section.endBalance).toBe(section.rows[section.rows.length - 1].remainingBalance)
    }
  })

  it('make the grand total equal the sum of the yearly totals', () => {
    const { rows } = calculate({
      ...baseForm,
      regularOverpayments: [
        { id: 1, amount: 700, startDate: '2027-01-01', endDate: '', effect: 'reduceTerm' },
      ],
    })
    const grandTotal = sumScheduleRows(rows)
    const fromSections = groupScheduleByYear(rows).reduce(
      (sum, section) => sum + section.totals.interest,
      0,
    )

    expect(grandTotal.interest).toBeCloseTo(fromSections, 6)
  })

  it('end on a zero balance', () => {
    const sections = groupScheduleByYear(calculate(baseForm).rows)

    expect(sections[sections.length - 1].endBalance).toBe(0)
  })
})

describe('buildSummaryView', () => {
  const view = (form: FormState) => {
    const { summary, rows } = calculate(form)
    const hasOverpayments = hasAnyOverpayment(form)
    const baselineSummary = hasOverpayments
      ? calculateLoanSummary(buildLoanInput({ ...form, regularOverpayments: [], extraPayments: [] }))
      : null
    const totalAdditionalCosts = getTotalAdditionalCosts(form, summary.schedule)

    return {
      summary,
      totalAdditionalCosts,
      result: buildSummaryView({
        form,
        summary,
        baselineSummary,
        totalAdditionalCosts,
        endMonthLabel: rows[rows.length - 1]?.monthLabel,
      }),
    }
  }

  it('splits the total cost into principal, interest and additional costs that add up', () => {
    const { result, summary, totalAdditionalCosts } = view(baseForm)

    expect(result.costPartsTotal).toBeCloseTo(result.totalCost, 6)
    expect(result.costParts.map((part) => part.key)).toEqual(['principal', 'interest', 'additional'])
    expect(result.costParts[0].value).toBeCloseTo(baseForm.amount, 1)
    expect(result.costParts[1].value).toBe(summary.totalInterest)
    expect(result.costParts[2].value).toBe(totalAdditionalCosts)
  })

  it('labels equal installments as monthly and decreasing ones as the first installment', () => {
    expect(view(baseForm).result.paymentLabel).toBe('Rata miesięczna')
    expect(view({ ...baseForm, repaymentType: 'decreasing' }).result.paymentLabel).toBe('Pierwsza rata')
  })

  it('reports interest and time saved by overpayments', () => {
    const { result } = view({
      ...baseForm,
      years: 20,
      regularOverpayments: [
        { id: 1, amount: 1000, startDate: '2027-01-01', endDate: '', effect: 'reduceTerm' },
      ],
    })

    expect(result.hasOverpayments).toBe(true)
    expect(result.interestSaved).toBeGreaterThan(0)
    expect(result.monthsSaved).toBeGreaterThan(0)
  })

  it('reports no savings when there are no overpayments', () => {
    const { result } = view(baseForm)

    expect(result.hasOverpayments).toBe(false)
    expect(result.interestSaved).toBe(0)
    expect(result.monthsSaved).toBe(0)
  })

  it('does not count zero-amount overpayments', () => {
    expect(
      hasAnyOverpayment({
        ...baseForm,
        regularOverpayments: [
          { id: 1, amount: 0, startDate: '2027-01-01', endDate: '', effect: 'reduceTerm' },
        ],
      }),
    ).toBe(false)
  })

  it('shows the end month of the loan', () => {
    expect(view(baseForm).result.endMonthLabel).toBe('październik 2029')
  })
})
