export type RepaymentType = 'annuity' | 'decreasing'
export type ExtraPaymentMode = 'reduceTerm' | 'reduceInstallment'

export interface ExtraPaymentEntry {
  amount: number
  date: string
  effect?: ExtraPaymentMode
}

export interface RateChangeEntry {
  date: string
  rate: number
}

export interface LoanInput {
  loanAmount: number
  annualRate: number
  termMonths: number
  repaymentType: RepaymentType
  loanStartDate?: string
  rateChanges?: RateChangeEntry[]
  extraMonthlyPayment?: number
  extraMonthlyPaymentStartDate?: string
  extraPayments?: ExtraPaymentEntry[]
  extraPaymentMode?: ExtraPaymentMode
  startMonth?: number
}

export interface LoanScheduleRow {
  month: number
  payment: number
  principal: number
  interest: number
  remainingBalance: number
  extraPayment: number
  additionalCosts?: number
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

const calculatePaymentForBalance = (
  balance: number,
  monthsRemaining: number,
  annualRate: number,
  repaymentType: RepaymentType,
) => {
  if (monthsRemaining <= 0 || balance <= 0) {
    return 0
  }

  const monthlyRate = annualRate / 100 / 12

  if (repaymentType === 'annuity') {
    return (
      (balance * monthlyRate * Math.pow(1 + monthlyRate, monthsRemaining)) /
      (Math.pow(1 + monthlyRate, monthsRemaining) - 1)
    )
  }

  return balance / monthsRemaining + balance * monthlyRate
}

const parseDate = (value?: string) => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const getEffectiveAnnualRate = (monthDate: Date, baseRate: number, rateChanges: RateChangeEntry[]) => {
  let effectiveRate = baseRate

  for (const change of [...rateChanges].sort((a, b) => {
    const left = parseDate(a.date)
    const right = parseDate(b.date)
    if (!left || !right) return 0
    return left.getTime() - right.getTime()
  })) {
    const changeDate = parseDate(change.date)
    if (!changeDate) {
      continue
    }

    if (changeDate <= monthDate) {
      effectiveRate = Number(change.rate) || baseRate
    }
  }

  return Math.max(0, effectiveRate)
}

export function calculateLoanSummary(input: LoanInput): LoanSummary {
  const loanAmount = Math.max(0, Number(input.loanAmount) || 0)
  const annualRate = Math.max(0, Number(input.annualRate) || 0)
  const termMonths = Math.max(1, Math.round(Number(input.termMonths) || 0))
  const extraMonthlyPayment = Math.max(0, Number(input.extraMonthlyPayment) || 0)
  const extraPaymentMode = input.extraPaymentMode ?? 'reduceTerm'
  const startMonth = Math.max(1, Math.round(Number(input.startMonth) || 1))
  const loanStartDate = parseDate(input.loanStartDate) ?? new Date()
  const monthlyRecurringStartDate = parseDate(input.extraMonthlyPaymentStartDate)
  const extraPayments = Array.isArray(input.extraPayments) ? input.extraPayments : []
  const rateChanges = Array.isArray(input.rateChanges) ? input.rateChanges : []

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
    const currentDate = new Date(loanStartDate)
    currentDate.setDate(1)
    currentDate.setMonth(currentDate.getMonth() + (month - 1))

    const currentAnnualRate = getEffectiveAnnualRate(currentDate, annualRate, rateChanges)
    const currentMonthlyRate = currentAnnualRate / 100 / 12
    const currentMonthKey = toMonthKey(currentDate)

    const recurringExtraPayment =
      extraMonthlyPayment > 0 &&
      ((monthlyRecurringStartDate && toMonthKey(currentDate) >= toMonthKey(monthlyRecurringStartDate)) ||
        (!monthlyRecurringStartDate && month >= startMonth))
        ? extraMonthlyPayment
        : 0

    const oneOffPaymentsForMonth = extraPayments.filter((payment) => {
      const paymentDate = parseDate(payment.date)
      return paymentDate ? toMonthKey(paymentDate) === currentMonthKey : false
    })

    const reduceTermExtra =
      (extraPaymentMode === 'reduceTerm' ? recurringExtraPayment : 0) +
      oneOffPaymentsForMonth.reduce((sum, payment) => {
        const effect = payment.effect ?? 'reduceTerm'
        return sum + (effect === 'reduceTerm' ? Math.max(0, Number(payment.amount) || 0) : 0)
      }, 0)

    const reduceInstallmentExtra =
      (extraPaymentMode === 'reduceInstallment' ? recurringExtraPayment : 0) +
      oneOffPaymentsForMonth.reduce((sum, payment) => {
        const effect = payment.effect ?? 'reduceTerm'
        return sum + (effect === 'reduceInstallment' ? Math.max(0, Number(payment.amount) || 0) : 0)
      }, 0)

    const monthsRemaining = termMonths - month + 1
    const interest = remainingBalance * currentMonthlyRate
    const scheduledPayment = calculatePaymentForBalance(
      remainingBalance,
      monthsRemaining,
      currentAnnualRate,
      input.repaymentType,
    )

    let principal = 0
    let payment = 0
    let extraPayment = 0

    if (input.repaymentType === 'annuity') {
      principal = scheduledPayment - interest
      payment = scheduledPayment
    } else {
      principal = remainingBalance / monthsRemaining
      payment = principal + interest
    }

    if (reduceTermExtra > 0) {
      principal += reduceTermExtra
      extraPayment += reduceTermExtra
    }

    if (reduceInstallmentExtra > 0) {
      principal += reduceInstallmentExtra
      extraPayment += reduceInstallmentExtra
    }

    if (remainingBalance - principal <= 0) {
      principal = remainingBalance
      payment = principal + interest
    }

    remainingBalance = Math.max(0, remainingBalance - principal)

    totalPaid += payment + extraPayment
    totalInterest += interest

    schedule.push({
      month,
      payment: safeRound(payment),
      principal: safeRound(principal),
      interest: safeRound(interest),
      remainingBalance: safeRound(remainingBalance),
      extraPayment: safeRound(extraPayment),
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
