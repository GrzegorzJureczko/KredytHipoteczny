import { calculateLoanSummary, type ExtraPaymentMode, type RepaymentType } from './calculator'
import type { SavedCalculationPayload } from './savedCalculations'

export type ExtraPaymentEntry = {
  id: number
  amount: number
  date: string
  effect: ExtraPaymentMode
}

export type RateChangeEntry = {
  id: number
  date: string
  wibor: number
  margin: number
}

export type RegularOverpaymentEntry = {
  id: number
  amount: number
  startDate: string
  endDate: string
  effect: ExtraPaymentMode
}

export type FormState = {
  amount: number
  loanStartDate: string
  rate: number
  wibor: number
  margin: number
  years: number
  repaymentType: RepaymentType
  rateChanges: RateChangeEntry[]
  regularOverpayments: RegularOverpaymentEntry[]
  extraPayments: ExtraPaymentEntry[]
  applicationFee: number
  applicationFeeCalculationType: 'percentage' | 'amount'
  applicationFeePercent: number
  insurance: number
  notary: number
  appraisal: number
  commission: number
  propertyValue: number
  lifeInsuranceCalculationType: 'percentage' | 'amount'
  lifeInsuranceRatePercent: number
  lifeInsuranceMonthlyPremium: number
  lifeInsuranceMonths: number
  lifeInsuranceDurationUnit: 'months' | 'years'
  propertyInsuranceCalculationType: 'percentage' | 'amount'
  propertyInsuranceAmount: number
  propertyInsuranceFrequency: 'monthly' | 'annual'
  propertyInsuranceBasis: 'propertyValue' | 'loanAmount'
  propertyInsuranceRatePercent: number
}

export type LoanInput = Parameters<typeof calculateLoanSummary>[0]

export const calculationTypeOptions = [
  { value: 'amount', label: 'Kwotowo' },
  { value: 'percentage', label: 'Procentowo' },
] as const

export const toLocalDateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const getMonthYearParts = (value: string) => {
  const [yearValue, monthValue] = value.slice(0, 7).split('-')
  const now = new Date()
  const year = Number(yearValue)
  const month = Number(monthValue)

  return {
    year: Number.isInteger(year) && year > 0 ? year : now.getFullYear(),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
  }
}

const getNextMonthDate = () => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + 1)
  return toLocalDateString(date)
}

export const getDateOffsetMonths = (offsetMonths: number) => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + offsetMonths)
  return toLocalDateString(date)
}

export const addMonthsToDate = (value: string, months: number) => {
  const { year, month } = getMonthYearParts(value)
  return toLocalDateString(new Date(year, month - 1 + months, 1))
}

export const getMonthIndex = (value: string) => {
  const { year, month } = getMonthYearParts(value)
  return year * 12 + month
}

export const getAnnualRateFromSplit = (wibor: number, margin: number) =>
  Number((Number(wibor || 0) + Number(margin || 0)).toFixed(4))

export const initialForm: FormState = {
  amount: 350000,
  loanStartDate: getNextMonthDate(),
  rate: 5.2,
  wibor: 2.7,
  margin: 2.5,
  years: 30,
  repaymentType: 'annuity',
  rateChanges: [],
  regularOverpayments: [],
  extraPayments: [],
  applicationFee: 1500,
  applicationFeeCalculationType: 'amount',
  applicationFeePercent: 0.43,
  insurance: 200,
  notary: 3500,
  appraisal: 1800,
  commission: 0,
  propertyValue: 400000,
  lifeInsuranceCalculationType: 'amount',
  lifeInsuranceRatePercent: 0.05,
  lifeInsuranceMonthlyPremium: 200,
  lifeInsuranceMonths: 24,
  lifeInsuranceDurationUnit: 'months',
  propertyInsuranceCalculationType: 'percentage',
  propertyInsuranceAmount: 200,
  propertyInsuranceFrequency: 'monthly',
  propertyInsuranceBasis: 'propertyValue',
  propertyInsuranceRatePercent: 0.05,
}

export const buildLoanInput = (source: FormState): LoanInput => ({
  loanAmount: source.amount,
  annualRate: source.rate,
  termMonths: source.years * 12,
  repaymentType: source.repaymentType,
  loanStartDate: source.loanStartDate,
  rateChanges: source.rateChanges.map(({ date, wibor, margin }) => ({
    date,
    rate: getAnnualRateFromSplit(wibor, margin),
  })),
  recurringExtraPayments: source.regularOverpayments.map(
    ({ amount, startDate, endDate, effect }) => ({
      amount,
      startDate,
      endDate: endDate || undefined,
      effect,
    }),
  ),
  extraPayments: source.extraPayments.map(({ amount, date, effect }) => ({
    amount,
    date,
    effect,
  })),
})

export const payloadToFormState = (payload: SavedCalculationPayload): FormState => {
  const {
    extraMonthlyPayment,
    extraMonthlyPaymentStartDate,
    extraPaymentMode,
    regularOverpayments: savedRegularOverpayments,
    rateChanges: savedRateChanges,
    ...rest
  } = JSON.parse(JSON.stringify(payload)) as SavedCalculationPayload
  const wibor = Number(rest.wibor ?? rest.rate ?? 0)
  const margin = Number(rest.margin ?? 0)
  const totalRate = getAnnualRateFromSplit(wibor, margin)
  const startDate = rest.loanStartDate || initialForm.loanStartDate

  const regularOverpayments: RegularOverpaymentEntry[] =
    savedRegularOverpayments ??
    ((extraMonthlyPayment ?? 0) > 0
      ? [
          {
            id: 1,
            amount: extraMonthlyPayment ?? 0,
            startDate: extraMonthlyPaymentStartDate || startDate,
            endDate: '',
            effect: extraPaymentMode ?? 'reduceTerm',
          },
        ]
      : [])

  return {
    ...initialForm,
    ...(rest as Partial<FormState>),
    rate: totalRate,
    wibor,
    margin,
    rateChanges: (savedRateChanges ?? []).map((entry) => {
      const entryMargin = entry.margin ?? margin

      return {
        id: entry.id,
        date: entry.date,
        wibor: entry.wibor ?? Number(((entry.rate ?? totalRate) - entryMargin).toFixed(4)),
        margin: entryMargin,
      }
    }),
    regularOverpayments,
    extraPayments: rest.extraPayments ?? [],
  }
}

export const getLifeInsuranceMonths = (form: FormState) => {
  const months = form.lifeInsuranceMonths || 0
  const units = form.lifeInsuranceDurationUnit || 'months'
  return units === 'years' ? Math.round(months * 12) : months
}

export const getLifeInsuranceMonthlyPremium = (form: FormState, balance?: number) => {
  if (form.lifeInsuranceCalculationType === 'percentage') {
    const rateDecimal = (Number(form.lifeInsuranceRatePercent) || 0) / 100
    const base = balance !== undefined ? balance : form.amount
    return Math.max(0, base * rateDecimal)
  }

  return Math.max(0, Number(form.lifeInsuranceMonthlyPremium) || 0)
}

export const getPropertyInsuranceMonthlyPremium = (form: FormState) => {
  if (form.propertyInsuranceCalculationType === 'amount') {
    const amount = Math.max(0, Number(form.propertyInsuranceAmount) || 0)
    return form.propertyInsuranceFrequency === 'annual' ? amount / 12 : amount
  }

  const propertyBase =
    form.propertyInsuranceBasis === 'loanAmount' ? form.amount : form.propertyValue
  const rateDecimal = (Number(form.propertyInsuranceRatePercent) || 0) / 100
  const annualPremium = Math.max(0, propertyBase * rateDecimal)

  return form.propertyInsuranceFrequency === 'annual' ? annualPremium / 12 : annualPremium
}

export const getApplicationFee = (form: FormState) =>
  form.applicationFeeCalculationType === 'percentage'
    ? Math.max(0, form.amount * ((Number(form.applicationFeePercent) || 0) / 100))
    : form.applicationFee

export const getMonthlyAdditionalCost = (monthNumber: number, form: FormState, balance?: number) => {
  const firstMonthFee =
    getApplicationFee(form) + form.notary + form.appraisal + form.commission

  const lifeInsuranceCost =
    monthNumber <= getLifeInsuranceMonths(form)
      ? getLifeInsuranceMonthlyPremium(form, balance)
      : 0

  const propertyInsuranceCost = getPropertyInsuranceMonthlyPremium(form)
  const recurringCost = lifeInsuranceCost + propertyInsuranceCost

  return monthNumber === 1 ? firstMonthFee + recurringCost : recurringCost
}

export const getTotalAdditionalCosts = (
  form: FormState,
  schedule: ReadonlyArray<{ remainingBalance: number }>,
) =>
  schedule
    .map((_, index) => {
      const startBalance = index === 0 ? form.amount : (schedule[index - 1]?.remainingBalance ?? 0)
      return getMonthlyAdditionalCost(index + 1, form, startBalance)
    })
    .reduce((sum, value) => sum + value, 0)

export const getLoanValidationMessages = (form: FormState) =>
  [
    form.amount <= 0 ? 'Kwota kredytu musi być większa od zera.' : null,
    form.propertyValue > 0 && form.amount > form.propertyValue
      ? 'Kwota kredytu przekracza wartość nieruchomości.'
      : null,
    form.years < 1 || form.years > 40
      ? 'Okres kredytowania powinien mieścić się w zakresie 1–40 lat.'
      : null,
  ].filter((message): message is string => message !== null)

export type LoanTimeline = { startIndex: number; endIndex: number }

export const getLoanTimeline = (loanStartDate: string, termMonths: number): LoanTimeline => {
  const startIndex = getMonthIndex(loanStartDate)
  return { startIndex, endIndex: startIndex + Math.max(termMonths, 1) - 1 }
}

export const getRateChangeWarning = (
  entry: RateChangeEntry,
  rateChanges: RateChangeEntry[],
  timeline: LoanTimeline,
) => {
  const monthIndex = getMonthIndex(entry.date)

  if (monthIndex > timeline.endIndex) {
    return 'Zmiana po zakończeniu spłaty – nie wpływa na harmonogram.'
  }

  if (rateChanges.filter((other) => getMonthIndex(other.date) === monthIndex).length > 1) {
    return 'Kilka zmian w tym samym miesiącu – obowiązuje ostatnia z listy.'
  }

  if (monthIndex < timeline.startIndex) {
    return 'Zmiana sprzed startu kredytu obowiązuje już od pierwszej raty.'
  }

  return null
}

export const getRegularOverpaymentWarning = (
  entry: RegularOverpaymentEntry,
  timeline: LoanTimeline,
) => {
  const startIndex = getMonthIndex(entry.startDate)

  if (entry.endDate !== '' && getMonthIndex(entry.endDate) < startIndex) {
    return 'Koniec jest przed początkiem – ta nadpłata nie będzie naliczana.'
  }

  if (startIndex > timeline.endIndex) {
    return 'Start po zakończeniu spłaty – nadpłata nie wpływa na harmonogram.'
  }

  return null
}
