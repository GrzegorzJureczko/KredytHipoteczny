export type RepaymentType = 'annuity' | 'decreasing'
export type ExtraPaymentMode = 'reduceTerm' | 'reduceInstallment'

export interface LoanInput {
  loanAmount: number
  annualRate: number
  termMonths: number
  repaymentType: RepaymentType
  extraMonthlyPayment?: number
  extraPaymentMode?: ExtraPaymentMode
  startMonth?: number
}

export interface LoanScheduleRow {
  month: number
  payment: number
  principal: number
  interest: number
  remainingBalance: number
}

export interface LoanSummary {
  monthlyPayment: number
  totalInterest: number
  totalPaid: number
  totalAdditionalCosts: number
  remainingBalance: number
  schedule: LoanScheduleRow[]
  loanTermMonths: number
}

const safeRound = (value: number) => Number(value.toFixed(2))

export function calculateLoanSummary(input: LoanInput): LoanSummary {
  const loanAmount = Math.max(0, Number(input.loanAmount) || 0)
  const annualRate = Math.max(0, Number(input.annualRate) || 0)
  const termMonths = Math.max(1, Math.round(Number(input.termMonths) || 0))
  const extraMonthlyPayment = Math.max(0, Number(input.extraMonthlyPayment) || 0)
  const extraPaymentMode = input.extraPaymentMode ?? 'reduceTerm'
  const startMonth = Math.max(1, Math.round(Number(input.startMonth) || 1))

  const monthlyRate = annualRate / 100 / 12
  let monthlyPayment = loanAmount / termMonths

  if (annualRate > 0 && input.repaymentType === 'annuity') {
    monthlyPayment =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1)
  }

  if (input.repaymentType === 'decreasing') {
    monthlyPayment = loanAmount / termMonths + loanAmount * monthlyRate
  }

  const schedule: LoanScheduleRow[] = []
  let remainingBalance = loanAmount
  let totalPaid = 0
  let totalInterest = 0

  for (let month = 1; month <= termMonths; month++) {
    const interest = remainingBalance * monthlyRate
    let principal = 0
    let payment = 0

    if (input.repaymentType === 'annuity') {
      payment = monthlyPayment
      principal = payment - interest
    } else {
      principal = loanAmount / termMonths
      payment = principal + interest
    }

    if (extraMonthlyPayment > 0 && month >= startMonth) {
      if (extraPaymentMode === 'reduceTerm') {
        payment += extraMonthlyPayment
        principal += extraMonthlyPayment
      } else {
        payment = Math.max(monthlyPayment, monthlyPayment + extraMonthlyPayment)
        principal = payment - interest
      }
    }

    if (remainingBalance - principal <= 0) {
      principal = remainingBalance
      payment = principal + interest
    }

    remainingBalance = Math.max(0, remainingBalance - principal)
    totalPaid += payment
    totalInterest += interest

    schedule.push({
      month,
      payment: safeRound(payment),
      principal: safeRound(principal),
      interest: safeRound(interest),
      remainingBalance: safeRound(remainingBalance),
    })

    if (remainingBalance <= 0) {
      break
    }
  }

  return {
    monthlyPayment: safeRound(monthlyPayment),
    totalInterest: safeRound(totalInterest),
    totalPaid: safeRound(totalPaid),
    totalAdditionalCosts: 0,
    remainingBalance: safeRound(remainingBalance),
    schedule,
    loanTermMonths: schedule.length,
  }
}
