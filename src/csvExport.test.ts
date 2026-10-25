import { describe, expect, it } from 'vitest'
import { calculateLoanSummary } from './calculator'
import { buildScheduleCsv, SCHEDULE_CSV_HEADERS } from './csvExport'
import { buildLoanInput, getLoanTimeline, initialForm, type FormState } from './loanForm'
import { buildScheduleRows, groupScheduleByYear, sumScheduleRows } from './scheduleView'
import { buildPrintDetails } from './summaryView'

const form: FormState = {
  ...initialForm,
  amount: 120_000,
  loanStartDate: '2026-11-01',
  years: 1,
  rate: 6,
  wibor: 3,
  margin: 3,
  repaymentType: 'annuity',
  rateChanges: [],
  regularOverpayments: [],
  extraPayments: [],
  applicationFee: 1000,
  applicationFeeCalculationType: 'amount',
  notary: 0,
  appraisal: 0,
  commission: 0,
  lifeInsuranceCalculationType: 'amount',
  lifeInsuranceMonthlyPremium: 0,
  propertyInsuranceCalculationType: 'amount',
  propertyInsuranceAmount: 0,
}

const buildCsv = (source: FormState) => {
  const summary = calculateLoanSummary(buildLoanInput(source))
  const timeline = getLoanTimeline(source.loanStartDate, summary.loanTermMonths)
  const rows = buildScheduleRows(source, summary.schedule, timeline)

  return { summary, rows, csv: buildScheduleCsv(groupScheduleByYear(rows), sumScheduleRows(rows)) }
}

const parse = (csv: string) =>
  csv
    .split('\r\n')
    .filter((line) => line !== '')
    .map((line) => line.split(';'))

describe('buildScheduleCsv', () => {
  it('starts with the header, has one row per month and ends with a totals row', () => {
    const { csv, summary } = buildCsv(form)
    const lines = parse(csv)

    expect(lines[0]).toEqual(SCHEDULE_CSV_HEADERS)
    expect(lines).toHaveLength(summary.schedule.length + 2)
    expect(lines[lines.length - 1][0]).toBe('Razem')
  })

  it('uses Excel-friendly formatting: semicolons, decimal commas and CRLF line breaks', () => {
    const { csv } = buildCsv(form)

    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv).not.toMatch(/\d\.\d/)
    expect(parse(csv)[1][0]).toBe('Listopad 2026')
    expect(parse(csv)[1][1]).toBe('6')
    expect(parse(csv)[1][3]).toMatch(/^\d+,\d{2}$/)
  })

  it('writes the same amounts as the schedule', () => {
    const { csv, summary } = buildCsv(form)
    const first = parse(csv)[1]
    const row = summary.schedule[0]

    expect(first[2]).toBe(row.payment.toFixed(2).replace('.', ','))
    expect(first[5]).toBe('0,00')
    expect(first[6]).toBe('1000,00')
    expect(first[7]).toBe(row.remainingBalance.toFixed(2).replace('.', ','))
  })

  it('makes the totals row agree with the sum of the monthly rows', () => {
    const { csv } = buildCsv({
      ...form,
      years: 2,
      regularOverpayments: [
        { id: 1, amount: 500, startDate: '2027-01-01', endDate: '', effect: 'reduceTerm' },
      ],
    })
    const lines = parse(csv)
    const toNumber = (value: string) => Number(value.replace(',', '.'))
    const monthly = lines.slice(1, -1)
    const totals = lines[lines.length - 1]

    for (const column of [2, 3, 4, 5, 6]) {
      const sum = monthly.reduce((total, line) => total + toNumber(line[column]), 0)
      expect(toNumber(totals[column])).toBeCloseTo(sum, 1)
    }
  })

  it('lists the schedule events in the notes column', () => {
    const { csv, summary } = buildCsv({
      ...form,
      extraPayments: [{ id: 1, amount: 5000, date: '2027-01-01', effect: 'reduceTerm' }],
    })
    const lines = parse(csv).slice(1, -1)

    expect(lines[2][8]).toBe('Nadpłata jednorazowa')
    expect(lines[summary.schedule.length - 1][8]).toBe('Ostatnia rata')
    expect(lines[0][8]).toBe('')
  })

  it('has the same number of columns in every line', () => {
    const { csv } = buildCsv(form)

    expect(new Set(parse(csv).map((line) => line.length))).toEqual(new Set([SCHEDULE_CSV_HEADERS.length]))
  })
})

describe('buildPrintDetails', () => {
  it('summarizes the loan on one line', () => {
    const text = buildPrintDetails({ ...form, years: 25 })

    expect(text).toContain('25 lat')
    expect(text).toContain('oprocentowanie 6%')
    expect(text).toContain('raty równe')
    expect(text).toContain('start: Listopad 2026')
    expect(text).not.toContain('zmiany oprocentowania')
  })

  it('mentions decreasing installments and rate changes', () => {
    const text = buildPrintDetails({
      ...form,
      repaymentType: 'decreasing',
      rateChanges: [{ id: 1, date: '2027-01-01', wibor: 4, margin: 3 }],
    })

    expect(text).toContain('raty malejące')
    expect(text).toContain('zmiany oprocentowania: 1')
  })
})
