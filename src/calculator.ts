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
  annualRate: number
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

  const dateOnlyMatch = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value)
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1])
    const month = Number(dateOnlyMatch[2])
    const day = Number(dateOnlyMatch[3] ?? 1)
    const date = new Date(year, month - 1, day)

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null
    }

    return date
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

const calculatePaymentWithPlannedExtraPayments = (
  balance: number,
  startMonthIndex: number,
  annualRates: number[],
  plannedExtraPayments: number[],
) => {
  const remainingMonths = annualRates.length - startMonthIndex
  if (remainingMonths <= 0 || balance <= 0) {
    return 0
  }

  const remainingBalanceAfterPayments = (payment: number) => {
    let projectedBalance = balance

    for (let index = startMonthIndex; index < annualRates.length; index++) {
      const interest = projectedBalance * (annualRates[index] / 100 / 12)
      const principal = Math.min(projectedBalance, Math.max(0, payment - interest))
      const extraPayment = Math.min(
        Math.max(0, projectedBalance - principal),
        plannedExtraPayments[index],
      )
      projectedBalance -= principal + extraPayment

      if (projectedBalance <= 0) {
        return 0
      }
    }

    return projectedBalance
  }

  let lowerPayment = 0
  let upperPayment = balance

  while (remainingBalanceAfterPayments(upperPayment) > 0) {
    upperPayment *= 2
  }

  for (let iteration = 0; iteration < 60; iteration++) {
    const candidatePayment = (lowerPayment + upperPayment) / 2
    if (remainingBalanceAfterPayments(candidatePayment) > 0) {
      lowerPayment = candidatePayment
    } else {
      upperPayment = candidatePayment
    }
  }

  return upperPayment
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
  const loanStartMonth = new Date(loanStartDate)
  loanStartMonth.setDate(1)
  const scheduleDates = Array.from({ length: termMonths }, (_, index) => {
    const date = new Date(loanStartMonth)
    date.setMonth(date.getMonth() + index)
    return date
  })
  const annualRates = scheduleDates.map((date) =>
    getEffectiveAnnualRate(date, annualRate, rateChanges),
  )
  const extraPaymentsByMonth = Array.from({ length: termMonths }, () => ({
    reduceTerm: 0,
    reduceInstallment: 0,
  }))
  const recurringInstallmentPaymentsByMonth = Array.from({ length: termMonths }, () => 0)

  scheduleDates.forEach((date, index) => {
    if (
      extraMonthlyPayment > 0 &&
      ((monthlyRecurringStartDate && toMonthKey(date) >= toMonthKey(monthlyRecurringStartDate)) ||
        (!monthlyRecurringStartDate && index + 1 >= startMonth))
    ) {
      extraPaymentsByMonth[index][extraPaymentMode] += extraMonthlyPayment
      if (extraPaymentMode === 'reduceInstallment') {
        recurringInstallmentPaymentsByMonth[index] = extraMonthlyPayment
      }
    }
  })

  for (const extraPayment of extraPayments) {
    const paymentDate = parseDate(extraPayment.date)
    if (!paymentDate) {
      continue
    }

    const paymentMonthKey = toMonthKey(paymentDate)
    const monthIndex = scheduleDates.findIndex((date) => toMonthKey(date) === paymentMonthKey)
    if (monthIndex < 0) {
      continue
    }

    const effect = extraPayment.effect ?? 'reduceTerm'
    extraPaymentsByMonth[monthIndex][effect] += Math.max(0, Number(extraPayment.amount) || 0)
  }

  const plannedInstallmentExtras = extraPaymentsByMonth.map(
    (payments, index) => payments.reduceInstallment - recurringInstallmentPaymentsByMonth[index],
  )

  let remainingBalance = loanAmount
  let totalPaid = 0
  let totalInterest = 0
  let installmentRecastActive = false
  let currentAnnuityPayment = monthlyPayment
  let previousAnnualRate = annualRates[0] ?? annualRate

  for (let month = 1; month <= termMonths; month++) {
    const monthIndex = month - 1
    const currentAnnualRate = annualRates[monthIndex]
    const currentMonthlyRate = currentAnnualRate / 100 / 12
    const monthlyExtraPayments = extraPaymentsByMonth[monthIndex]
    const requestedExtraPayment = monthlyExtraPayments.reduceTerm + monthlyExtraPayments.reduceInstallment

    const monthsRemaining = termMonths - month + 1
    const interest = remainingBalance * currentMonthlyRate
    let regularPrincipal: number
    let payment: number

    if (input.repaymentType === 'annuity') {
      if (installmentRecastActive) {
        currentAnnuityPayment = calculatePaymentWithPlannedExtraPayments(
          remainingBalance,
          monthIndex,
          annualRates,
          plannedInstallmentExtras,
        )
      } else if (currentAnnualRate !== previousAnnualRate) {
        currentAnnuityPayment = calculatePaymentForBalance(
          remainingBalance,
          monthsRemaining,
          currentAnnualRate,
          input.repaymentType,
        )
      }

      regularPrincipal = Math.min(remainingBalance, Math.max(0, currentAnnuityPayment - interest))
      payment = regularPrincipal + interest
    } else {
      const plannedFutureExtras = plannedInstallmentExtras
        .slice(monthIndex)
        .reduce((sum, extra) => sum + extra, 0)
      regularPrincipal = installmentRecastActive
        ? Math.max(0, (remainingBalance - plannedFutureExtras) / monthsRemaining)
        : loanAmount / termMonths
      regularPrincipal = Math.min(remainingBalance, regularPrincipal)
      payment = regularPrincipal + interest
    }

    const appliedExtraPayment = Math.min(
      requestedExtraPayment,
      Math.max(0, remainingBalance - regularPrincipal),
    )
    const principal = regularPrincipal + appliedExtraPayment
    remainingBalance = Math.max(0, remainingBalance - principal)

    totalPaid += payment + appliedExtraPayment
    totalInterest += interest

    schedule.push({
      month,
      annualRate: currentAnnualRate,
      payment: safeRound(payment),
      principal: safeRound(regularPrincipal),
      interest: safeRound(interest),
      remainingBalance: safeRound(remainingBalance),
      extraPayment: safeRound(appliedExtraPayment),
    })

    if (monthlyExtraPayments.reduceInstallment > 0) {
      installmentRecastActive = true
    }
    previousAnnualRate = currentAnnualRate

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
