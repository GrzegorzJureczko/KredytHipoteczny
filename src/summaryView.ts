import type { LoanSummary } from './calculator'
import type { FormState } from './loanForm'

export type CostPart = { key: 'principal' | 'interest' | 'additional'; label: string; value: number }

export type SummaryView = {
  paymentLabel: string
  firstPayment: number
  lastRegularPayment: number
  paymentChanges: boolean
  loanTermMonths: number
  endMonthLabel?: string
  monthlyBurden: number
  totalCost: number
  costParts: CostPart[]
  costPartsTotal: number
  hasOverpayments: boolean
  interestSaved: number
  monthsSaved: number
}

export const hasAnyOverpayment = (form: FormState) =>
  form.regularOverpayments.some((entry) => entry.amount > 0) ||
  form.extraPayments.some((payment) => payment.amount > 0)

export const buildSummaryView = ({
  form,
  summary,
  baselineSummary,
  totalAdditionalCosts,
  endMonthLabel,
}: {
  form: FormState
  summary: LoanSummary
  baselineSummary: LoanSummary | null
  totalAdditionalCosts: number
  endMonthLabel?: string
}): SummaryView => {
  const firstPayment = summary.schedule[0]?.payment ?? summary.monthlyPayment
  const lastRegularPayment =
    summary.schedule.length > 1
      ? summary.schedule[summary.schedule.length - 2].payment
      : firstPayment
  const paymentChanges = Math.abs(lastRegularPayment - firstPayment) >= 1

  const costParts: CostPart[] = [
    {
      key: 'principal',
      label: 'Kapitał',
      value: Math.max(0, summary.totalPaid - summary.totalInterest),
    },
    { key: 'interest', label: 'Odsetki', value: summary.totalInterest },
    { key: 'additional', label: 'Koszty dodatkowe', value: totalAdditionalCosts },
  ]

  return {
    paymentLabel:
      form.repaymentType === 'decreasing' || paymentChanges ? 'Pierwsza rata' : 'Rata miesięczna',
    firstPayment,
    lastRegularPayment,
    paymentChanges,
    loanTermMonths: summary.loanTermMonths,
    endMonthLabel,
    monthlyBurden: summary.monthlyPayment + totalAdditionalCosts / Math.max(summary.loanTermMonths, 1),
    totalCost: summary.totalPaid + totalAdditionalCosts,
    costParts,
    costPartsTotal: costParts.reduce((sum, part) => sum + part.value, 0),
    hasOverpayments: hasAnyOverpayment(form),
    interestSaved: baselineSummary
      ? Math.max(0, baselineSummary.totalInterest - summary.totalInterest)
      : 0,
    monthsSaved: baselineSummary
      ? Math.max(0, baselineSummary.loanTermMonths - summary.loanTermMonths)
      : 0,
  }
}
