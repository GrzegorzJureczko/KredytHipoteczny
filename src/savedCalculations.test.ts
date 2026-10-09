import { describe, expect, it } from 'vitest'
import { normalizeSavedCalculationPayload, type SavedCalculationPayload } from './savedCalculations'

describe('normalizeSavedCalculationPayload', () => {
  it('accepts a valid saved payload and keeps the data shape', () => {
    const payload: SavedCalculationPayload = {
      amount: 300000,
      rate: 5.1,
      years: 25,
      repaymentType: 'annuity',
      rateChanges: [{ id: 1, date: '2028-02-01', rate: 4.5 }],
      extraMonthlyPayment: 400,
      extraMonthlyPaymentStartDate: '2027-02-01',
      extraPaymentMode: 'reduceTerm',
      extraPayments: [{ id: 2, amount: 1200, date: '2027-03-01', effect: 'reduceTerm' }],
      applicationFee: 1500,
      insurance: 2000,
      notary: 2500,
      appraisal: 1600,
      commission: 0,
    }

    expect(normalizeSavedCalculationPayload(payload)).toEqual(payload)
  })

  it('rejects a payload without required fields', () => {
    expect(normalizeSavedCalculationPayload({ amount: 1000 })).toBeNull()
  })
})
