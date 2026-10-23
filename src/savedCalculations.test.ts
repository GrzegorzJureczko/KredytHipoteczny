import { describe, expect, it } from 'vitest'
import {
  getLegacyLoanStartDate,
  normalizeSavedCalculationPayload,
  type SavedCalculationPayload,
} from './savedCalculations'

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
      propertyValue: 300000,
      lifeInsuranceMonthlyPremium: 2000,
      lifeInsuranceMonths: 12,
      lifeInsuranceDurationUnit: 'months',
      propertyInsuranceFrequency: 'monthly',
      propertyInsuranceBasis: 'propertyValue',
      propertyInsuranceRatePercent: 0.05,
    }

    expect(normalizeSavedCalculationPayload(payload)).toEqual(payload)
  })

  it('rejects a payload without required fields', () => {
    expect(normalizeSavedCalculationPayload({ amount: 1000 })).toBeNull()
  })

  it('fills a missing start date with the supplied legacy date and never overrides a stored one', () => {
    const legacyRecord = {
      amount: 300000,
      rate: 5.1,
      years: 25,
      repaymentType: 'annuity',
      rateChanges: [],
      extraMonthlyPayment: 0,
      extraMonthlyPaymentStartDate: '2027-02-01',
      extraPaymentMode: 'reduceTerm',
      extraPayments: [],
      applicationFee: 0,
      notary: 0,
      appraisal: 0,
      commission: 0,
    }

    expect(normalizeSavedCalculationPayload(legacyRecord)?.loanStartDate).toBeUndefined()
    expect(normalizeSavedCalculationPayload(legacyRecord, '2026-02-01')?.loanStartDate).toBe(
      '2026-02-01',
    )
    expect(
      normalizeSavedCalculationPayload({ ...legacyRecord, loanStartDate: '2029-07-01' }, '2026-02-01')
        ?.loanStartDate,
    ).toBe('2029-07-01')
  })

  it('normalizes legacy values and coerces invalid enums to safe defaults', () => {
    const payload = normalizeSavedCalculationPayload({
      amount: '300000',
      rate: '4.8',
      years: '20',
      repaymentType: 'not-supported',
      rateChanges: [{ id: '1', date: '2028-01-01', rate: '5.2' }],
      extraMonthlyPayment: '800',
      extraMonthlyPaymentStartDate: '2027-03-01',
      extraPaymentMode: 'unknown-mode',
      extraPayments: [{ id: '9', amount: '1500', date: '2027-04-01', effect: 'reduceInstallment' }],
      applicationFee: '1500',
      insurance: '2000',
      notary: '3000',
      appraisal: '1200',
      commission: '0',
      propertyValue: '350000',
      lifeInsuranceMonthlyPremium: '250',
      lifeInsuranceMonths: '24',
      lifeInsuranceDurationUnit: 'years',
      lifeInsuranceCalculationType: 'percentage',
      lifeInsuranceRatePercent: '0.06',
      propertyInsuranceFrequency: 'annual',
      propertyInsuranceBasis: 'loanAmount',
      propertyInsuranceRatePercent: '0.04',
      propertyInsuranceCalculationType: 'amount',
      propertyInsuranceAmount: '250',
    })

    expect(payload).not.toBeNull()
    expect(payload?.repaymentType).toBe('annuity')
    expect(payload?.extraPaymentMode).toBe('reduceTerm')
    expect(payload?.lifeInsuranceCalculationType).toBe('percentage')
    expect(payload?.lifeInsuranceRatePercent).toBe(0.06)
    expect(payload?.propertyInsuranceCalculationType).toBe('amount')
    expect(payload?.propertyInsuranceAmount).toBe(250)
    expect(payload?.rateChanges[0]).toEqual({ id: 1, date: '2028-01-01', rate: 5.2 })
    expect(payload?.extraPayments[0]).toEqual({
      id: 9,
      amount: 1500,
      date: '2027-04-01',
      effect: 'reduceInstallment',
    })
  })
})

describe('getLegacyLoanStartDate', () => {
  it('returns the first day of the month after creation', () => {
    expect(getLegacyLoanStartDate('2026-01-15T12:00:00')).toBe('2026-02-01')
    expect(getLegacyLoanStartDate('2026-12-31T12:00:00')).toBe('2027-01-01')
  })

  it('returns undefined for a missing or invalid creation time', () => {
    expect(getLegacyLoanStartDate()).toBeUndefined()
    expect(getLegacyLoanStartDate('not-a-date')).toBeUndefined()
  })
})
