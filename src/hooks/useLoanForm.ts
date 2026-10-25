import { useState } from 'react'
import {
  addMonthsToDate,
  getAnnualRateFromSplit,
  getApplicationFee,
  getDateOffsetMonths,
  getLifeInsuranceMonthlyPremium,
  getMonthIndex,
  getPropertyInsuranceMonthlyPremium,
  initialForm,
  type FormState,
  type RegularOverpaymentEntry,
} from '../loanForm'

type CalculationType = 'percentage' | 'amount'

const newId = () => Date.now() + Math.random()

export const useLoanForm = () => {
  const [form, setForm] = useState<FormState>(initialForm)

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value }

      if (key === 'wibor' || key === 'margin') {
        const wibor = key === 'wibor' ? Number(value) || 0 : current.wibor
        const margin = key === 'margin' ? Number(value) || 0 : current.margin
        return { ...next, rate: getAnnualRateFromSplit(wibor, margin) }
      }

      return next
    })
  }

  const changeLifeInsuranceUnit = (unit: FormState['lifeInsuranceDurationUnit']) => {
    setForm((current) => {
      if (current.lifeInsuranceDurationUnit === unit) {
        return current
      }

      const value = Number(current.lifeInsuranceMonths) || 0
      const converted = unit === 'years' ? Math.floor(value / 12) : Math.floor(value * 12)

      return { ...current, lifeInsuranceDurationUnit: unit, lifeInsuranceMonths: converted }
    })
  }

  const changeApplicationFeeCalculationType = (calculationType: CalculationType) => {
    setForm((current) => {
      if (current.applicationFeeCalculationType === calculationType) {
        return current
      }

      return calculationType === 'amount'
        ? {
            ...current,
            applicationFeeCalculationType: calculationType,
            applicationFee: Number(getApplicationFee(current).toFixed(2)),
          }
        : {
            ...current,
            applicationFeeCalculationType: calculationType,
            applicationFeePercent:
              current.amount > 0
                ? Number(((current.applicationFee / current.amount) * 100).toFixed(4))
                : 0,
          }
    })
  }

  const changeLifeInsuranceCalculationType = (calculationType: CalculationType) => {
    setForm((current) => ({
      ...current,
      lifeInsuranceCalculationType: calculationType,
      lifeInsuranceMonthlyPremium:
        calculationType === 'amount'
          ? Number(
              getLifeInsuranceMonthlyPremium({
                ...current,
                lifeInsuranceCalculationType: 'percentage',
              }).toFixed(2),
            )
          : current.lifeInsuranceMonthlyPremium,
    }))
  }

  const changePropertyInsuranceCalculationType = (calculationType: CalculationType) => {
    setForm((current) => ({
      ...current,
      propertyInsuranceCalculationType: calculationType,
      propertyInsuranceAmount:
        calculationType === 'amount'
          ? Number(
              getPropertyInsuranceMonthlyPremium({
                ...current,
                propertyInsuranceCalculationType: 'percentage',
              }).toFixed(2),
            )
          : current.propertyInsuranceAmount,
    }))
  }

  const addRateChange = () => {
    setForm((current) => {
      const previous = [...current.rateChanges].sort(
        (a, b) => getMonthIndex(a.date) - getMonthIndex(b.date),
      )[current.rateChanges.length - 1]

      return {
        ...current,
        rateChanges: [
          ...current.rateChanges,
          {
            id: newId(),
            date: previous ? addMonthsToDate(previous.date, 1) : getDateOffsetMonths(12),
            wibor: previous?.wibor ?? current.wibor,
            margin: previous?.margin ?? current.margin,
          },
        ],
      }
    })
  }

  const updateRateChange = (
    id: number,
    field: 'date' | 'wibor' | 'margin',
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      rateChanges: current.rateChanges.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    }))
  }

  const removeRateChange = (id: number) => {
    setForm((current) => ({
      ...current,
      rateChanges: current.rateChanges.filter((entry) => entry.id !== id),
    }))
  }

  const addRegularOverpayment = () => {
    setForm((current) => ({
      ...current,
      regularOverpayments: [
        ...current.regularOverpayments,
        {
          id: newId(),
          amount: 500,
          startDate: current.loanStartDate,
          endDate: '',
          effect: 'reduceTerm',
        },
      ],
    }))
  }

  const updateRegularOverpayment = (
    id: number,
    changes: Partial<Omit<RegularOverpaymentEntry, 'id'>>,
  ) => {
    setForm((current) => ({
      ...current,
      regularOverpayments: current.regularOverpayments.map((entry) =>
        entry.id === id ? { ...entry, ...changes } : entry,
      ),
    }))
  }

  const removeRegularOverpayment = (id: number) => {
    setForm((current) => ({
      ...current,
      regularOverpayments: current.regularOverpayments.filter((entry) => entry.id !== id),
    }))
  }

  const addExtraPayment = () => {
    setForm((current) => ({
      ...current,
      extraPayments: [
        ...current.extraPayments,
        { id: newId(), amount: 500, date: getDateOffsetMonths(12), effect: 'reduceTerm' },
      ],
    }))
  }

  const updateExtraPayment = (
    id: number,
    field: 'amount' | 'date' | 'effect',
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      extraPayments: current.extraPayments.map((payment) =>
        payment.id === id ? { ...payment, [field]: value } : payment,
      ),
    }))
  }

  const removeExtraPayment = (id: number) => {
    setForm((current) => ({
      ...current,
      extraPayments: current.extraPayments.filter((payment) => payment.id !== id),
    }))
  }

  return {
    form,
    setForm,
    updateField,
    changeLifeInsuranceUnit,
    changeApplicationFeeCalculationType,
    changeLifeInsuranceCalculationType,
    changePropertyInsuranceCalculationType,
    addRateChange,
    updateRateChange,
    removeRateChange,
    addRegularOverpayment,
    updateRegularOverpayment,
    removeRegularOverpayment,
    addExtraPayment,
    updateExtraPayment,
    removeExtraPayment,
  }
}

export type LoanFormController = ReturnType<typeof useLoanForm>
