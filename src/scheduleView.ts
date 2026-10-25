import type { LoanScheduleRow } from './calculator'
import { monthNames } from './format'
import {
  getMonthIndex,
  getMonthlyAdditionalCost,
  getMonthYearParts,
  type FormState,
  type LoanTimeline,
} from './loanForm'

export type ScheduleEvent = {
  key: 'onetime' | 'regularStart' | 'regularEnd' | 'last'
  label: string
}

export type ScheduleViewRow = LoanScheduleRow & {
  paymentDate: Date
  monthLabel: string
  year: number
  rateChanged: boolean
  events: ScheduleEvent[]
  additionalCosts: number
}

export type ScheduleTotals = {
  payment: number
  principal: number
  interest: number
  extraPayment: number
  additionalCosts: number
}

export type ScheduleYearSection = {
  year: number
  rows: ScheduleViewRow[]
  totals: ScheduleTotals
  endBalance: number
}

export const buildScheduleRows = (
  form: FormState,
  schedule: LoanScheduleRow[],
  timeline: LoanTimeline,
): ScheduleViewRow[] => {
  const { year: startYear, month: startMonth } = getMonthYearParts(form.loanStartDate)

  const activeRegularOverpayments = form.regularOverpayments.filter((entry) => {
    const startIndex = Math.max(getMonthIndex(entry.startDate), timeline.startIndex)
    return (
      entry.amount > 0 && (entry.endDate === '' || getMonthIndex(entry.endDate) >= startIndex)
    )
  })

  return schedule.map((row, index) => {
    const paymentDate = new Date(startYear, startMonth - 1 + index, 1)
    const startBalance = index === 0 ? form.amount : (schedule[index - 1]?.remainingBalance ?? 0)
    const rowMonthIndex = paymentDate.getFullYear() * 12 + paymentDate.getMonth() + 1
    const events: ScheduleEvent[] = []

    if (
      form.extraPayments.some(
        (payment) => payment.amount > 0 && getMonthIndex(payment.date) === rowMonthIndex,
      )
    ) {
      events.push({ key: 'onetime', label: 'Nadpłata jednorazowa' })
    }

    if (
      activeRegularOverpayments.some(
        (entry) => Math.max(getMonthIndex(entry.startDate), timeline.startIndex) === rowMonthIndex,
      )
    ) {
      events.push({ key: 'regularStart', label: 'Start nadpłaty regularnej' })
    }

    if (
      activeRegularOverpayments.some(
        (entry) => entry.endDate !== '' && getMonthIndex(entry.endDate) === rowMonthIndex,
      )
    ) {
      events.push({ key: 'regularEnd', label: 'Koniec nadpłaty regularnej' })
    }

    if (index === schedule.length - 1) {
      events.push({ key: 'last', label: 'Ostatnia rata' })
    }

    return {
      ...row,
      paymentDate,
      monthLabel: `${monthNames[paymentDate.getMonth()]} ${paymentDate.getFullYear()}`,
      year: paymentDate.getFullYear(),
      rateChanged: index === 0 || row.annualRate !== schedule[index - 1].annualRate,
      events,
      additionalCosts: getMonthlyAdditionalCost(index + 1, form, startBalance),
    }
  })
}

export const sumScheduleRows = (rows: ScheduleViewRow[]): ScheduleTotals =>
  rows.reduce(
    (totals, row) => ({
      payment: totals.payment + row.payment,
      principal: totals.principal + row.principal,
      interest: totals.interest + row.interest,
      extraPayment: totals.extraPayment + row.extraPayment,
      additionalCosts: totals.additionalCosts + row.additionalCosts,
    }),
    { payment: 0, principal: 0, interest: 0, extraPayment: 0, additionalCosts: 0 },
  )

export const groupScheduleByYear = (rows: ScheduleViewRow[]): ScheduleYearSection[] =>
  Object.values(
    rows.reduce<Record<number, ScheduleViewRow[]>>((groups, row) => {
      if (!groups[row.year]) {
        groups[row.year] = []
      }
      groups[row.year].push(row)
      return groups
    }, {}),
  ).map((yearRows) => ({
    year: yearRows[0].year,
    rows: yearRows,
    totals: sumScheduleRows(yearRows),
    endBalance: yearRows[yearRows.length - 1].remainingBalance,
  }))
