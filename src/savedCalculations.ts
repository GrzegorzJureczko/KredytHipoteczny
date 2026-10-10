export type SavedCalculationPayload = {
  amount: number
  rate: number
  years: number
  repaymentType: 'annuity' | 'decreasing'
  rateChanges: Array<{ id: number; date: string; rate: number }>
  extraMonthlyPayment: number
  extraMonthlyPaymentStartDate: string
  extraPaymentMode: 'reduceTerm' | 'reduceInstallment'
  extraPayments: Array<{ id: number; amount: number; date: string; effect: 'reduceTerm' | 'reduceInstallment' }>
  applicationFee: number
  insurance: number
  notary: number
  appraisal: number
  commission: number
  propertyValue: number
  lifeInsuranceMonthlyPremium: number
  lifeInsuranceMonths: number
  lifeInsuranceDurationUnit: 'months' | 'years'
  propertyInsuranceFrequency: 'monthly' | 'annual'
  propertyInsuranceBasis: 'propertyValue' | 'loanAmount'
  propertyInsuranceRatePercent: number
}

export const normalizeSavedCalculationPayload = (
  value: unknown,
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
    'extraMonthlyPayment',
    'extraMonthlyPaymentStartDate',
    'extraPaymentMode',
    'extraPayments',
    'applicationFee',
    'notary',
    'appraisal',
    'commission',
  ]

  if (!requiredKeys.every((key) => key in record)) {
    return null
  }

  const payload: SavedCalculationPayload = {
    amount: Number(record.amount),
    rate: Number(record.rate),
    years: Number(record.years),
    repaymentType: record.repaymentType === 'decreasing' ? 'decreasing' : 'annuity',
    rateChanges: Array.isArray(record.rateChanges)
      ? record.rateChanges.map((entry) => ({
          id: Number((entry as Record<string, unknown>)?.id ?? Date.now()),
          date: String((entry as Record<string, unknown>)?.date ?? ''),
          rate: Number((entry as Record<string, unknown>)?.rate ?? 0),
        }))
      : [],
    extraMonthlyPayment: Number(record.extraMonthlyPayment),
    extraMonthlyPaymentStartDate: String(record.extraMonthlyPaymentStartDate ?? ''),
    extraPaymentMode:
      record.extraPaymentMode === 'reduceInstallment' ? 'reduceInstallment' : 'reduceTerm',
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

  return payload
}
