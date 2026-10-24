export type SavedRegularOverpayment = {
  id: number
  amount: number
  startDate: string
  endDate: string
  effect: 'reduceTerm' | 'reduceInstallment'
}

export type SavedCalculationPayload = {
  amount: number
  loanStartDate?: string
  rate: number
  wibor?: number
  margin?: number
  years: number
  repaymentType: 'annuity' | 'decreasing'
  rateChanges: Array<{ id: number; date: string; rate?: number; wibor?: number; margin?: number }>
  extraMonthlyPayment?: number
  extraMonthlyPaymentStartDate?: string
  extraPaymentMode?: 'reduceTerm' | 'reduceInstallment'
  regularOverpayments?: SavedRegularOverpayment[]
  extraPayments: Array<{ id: number; amount: number; date: string; effect: 'reduceTerm' | 'reduceInstallment' }>
  applicationFee: number
  applicationFeeCalculationType?: 'percentage' | 'amount'
  applicationFeePercent?: number
  insurance: number
  notary: number
  appraisal: number
  commission: number
  propertyValue: number
  lifeInsuranceMonthlyPremium: number
  lifeInsuranceMonths: number
  lifeInsuranceDurationUnit: 'months' | 'years'
  lifeInsuranceCalculationType?: 'percentage' | 'amount'
  lifeInsuranceRatePercent?: number
  propertyInsuranceFrequency: 'monthly' | 'annual'
  propertyInsuranceBasis: 'propertyValue' | 'loanAmount'
  propertyInsuranceRatePercent: number
  propertyInsuranceCalculationType?: 'percentage' | 'amount'
  propertyInsuranceAmount?: number
}

export const getLegacyLoanStartDate = (createdAt?: string) => {
  if (!createdAt) {
    return undefined
  }

  const created = new Date(createdAt)

  if (Number.isNaN(created.getTime())) {
    return undefined
  }

  const start = new Date(created.getFullYear(), created.getMonth() + 1, 1)
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
}

export const normalizeSavedCalculationPayload = (
  value: unknown,
  legacyLoanStartDate?: string,
): SavedCalculationPayload | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const requiredKeys = [
    'amount',
    'rate',
    'years',
    'repaymentType',
    'rateChanges',
    'extraPayments',
    'applicationFee',
    'notary',
    'appraisal',
    'commission',
  ]

  if (!requiredKeys.every((key) => key in record)) {
    return null
  }

  const annualRate = Number(record.rate ?? 0)
  const payload: SavedCalculationPayload = {
    amount: Number(record.amount),
    rate: annualRate,
    years: Number(record.years),
    repaymentType: record.repaymentType === 'decreasing' ? 'decreasing' : 'annuity',
    rateChanges: Array.isArray(record.rateChanges)
      ? record.rateChanges.map((entry) => {
          const item = (entry ?? {}) as Record<string, unknown>
          const rateChange: SavedCalculationPayload['rateChanges'][number] = {
            id: Number(item.id ?? Date.now()),
            date: String(item.date ?? ''),
          }

          if (item.rate !== undefined) {
            rateChange.rate = Number(item.rate)
          }

          if (item.wibor !== undefined) {
            rateChange.wibor = Number(item.wibor)
          }

          if (item.margin !== undefined) {
            rateChange.margin = Number(item.margin)
          }

          return rateChange
        })
      : [],
    extraPayments: Array.isArray(record.extraPayments)
      ? record.extraPayments.map((entry) => ({
          id: Number((entry as Record<string, unknown>)?.id ?? Date.now()),
          amount: Number((entry as Record<string, unknown>)?.amount ?? 0),
          date: String((entry as Record<string, unknown>)?.date ?? ''),
          effect:
            (entry as Record<string, unknown>)?.effect === 'reduceInstallment'
              ? 'reduceInstallment'
              : 'reduceTerm',
        }))
      : [],
    applicationFee: Number(record.applicationFee),
    insurance: Number(record.insurance ?? 0),
    notary: Number(record.notary),
    appraisal: Number(record.appraisal),
    commission: Number(record.commission),
    propertyValue: Number(record.propertyValue ?? record.amount ?? 0),
    lifeInsuranceMonthlyPremium: Number(record.lifeInsuranceMonthlyPremium ?? record.insurance ?? 0),
    lifeInsuranceMonths: Number(record.lifeInsuranceMonths ?? 0),
    lifeInsuranceDurationUnit:
      record.lifeInsuranceDurationUnit === 'years' ? 'years' : 'months',
    propertyInsuranceFrequency:
      record.propertyInsuranceFrequency === 'annual' ? 'annual' : 'monthly',
    propertyInsuranceBasis:
      record.propertyInsuranceBasis === 'loanAmount' ? 'loanAmount' : 'propertyValue',
    propertyInsuranceRatePercent: Number(record.propertyInsuranceRatePercent ?? 0),
  }

  if ('extraMonthlyPayment' in record) {
    payload.extraMonthlyPayment = Number(record.extraMonthlyPayment)
  }

  if ('extraMonthlyPaymentStartDate' in record) {
    payload.extraMonthlyPaymentStartDate = String(record.extraMonthlyPaymentStartDate ?? '')
  }

  if ('extraPaymentMode' in record) {
    payload.extraPaymentMode =
      record.extraPaymentMode === 'reduceInstallment' ? 'reduceInstallment' : 'reduceTerm'
  }

  if (Array.isArray(record.regularOverpayments)) {
    payload.regularOverpayments = record.regularOverpayments.map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>

      return {
        id: Number(item.id ?? Date.now()),
        amount: Number(item.amount ?? 0),
        startDate: String(item.startDate ?? ''),
        endDate: String(item.endDate ?? ''),
        effect: item.effect === 'reduceInstallment' ? 'reduceInstallment' : 'reduceTerm',
      }
    })
  }

  if ('loanStartDate' in record) {
    payload.loanStartDate = String(record.loanStartDate ?? '')
  } else if (legacyLoanStartDate) {
    payload.loanStartDate = legacyLoanStartDate
  }

  if ('applicationFeeCalculationType' in record) {
    payload.applicationFeeCalculationType =
      record.applicationFeeCalculationType === 'percentage' ? 'percentage' : 'amount'
  }

  if ('applicationFeePercent' in record) {
    payload.applicationFeePercent = Number(record.applicationFeePercent ?? 0)
  }

  if ('lifeInsuranceCalculationType' in record) {
    payload.lifeInsuranceCalculationType =
      record.lifeInsuranceCalculationType === 'percentage' ? 'percentage' : 'amount'
  }

  if ('lifeInsuranceRatePercent' in record) {
    payload.lifeInsuranceRatePercent = Number(record.lifeInsuranceRatePercent ?? 0)
  }

  if ('propertyInsuranceCalculationType' in record) {
    payload.propertyInsuranceCalculationType =
      record.propertyInsuranceCalculationType === 'amount' ? 'amount' : 'percentage'
  }

  if ('propertyInsuranceAmount' in record) {
    payload.propertyInsuranceAmount = Number(record.propertyInsuranceAmount ?? 0)
  }

  if ('wibor' in record || 'margin' in record) {
    payload.wibor = Number(record.wibor ?? annualRate)
    payload.margin = Number(record.margin ?? 0)
  }

  return payload
}
