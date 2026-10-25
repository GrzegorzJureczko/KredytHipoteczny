import { describe, expect, it } from 'vitest'
import {
  calculateLoanSummary,
  type ExtraPaymentMode,
  type LoanInput,
  type RepaymentType,
} from './calculator'

type Scenario = { name: string; extras: Partial<LoanInput> }

const scenarios: Scenario[] = [
  { name: 'no overpayments', extras: {} },
  {
    name: 'rate change dated before the loan start',
    extras: { rateChanges: [{ date: '2025-06-01', rate: 9 }] },
  },
  {
    name: 'monthly overpayment shortening the term',
    extras: {
      recurringExtraPayments: [
        { amount: 500, startDate: '2026-01-01', effect: 'reduceTerm' as ExtraPaymentMode },
      ],
    },
  },
  {
    name: 'bounded monthly overpayment lowering the installment',
    extras: {
      recurringExtraPayments: [
        {
          amount: 800,
          startDate: '2027-01-01',
          endDate: '2030-12-01',
          effect: 'reduceInstallment' as ExtraPaymentMode,
        },
      ],
    },
  },
  {
    name: 'one-off overpayment and a rate increase',
    extras: {
      extraPayments: [{ amount: 50000, date: '2026-06-01', effect: 'reduceTerm' }],
      rateChanges: [{ date: '2027-01-01', rate: 9 }],
    },
  },
]

const amounts = [100_000, 350_000]
const rates = [0, 2.5, 7.9]
const years = [1, 10, 30]
const repaymentTypes: RepaymentType[] = ['annuity', 'decreasing']

const buildInput = (
  amount: number,
  rate: number,
  termYears: number,
  repaymentType: RepaymentType,
  extras: Partial<LoanInput>,
): LoanInput => ({
  loanAmount: amount,
  annualRate: rate,
  termMonths: termYears * 12,
  repaymentType,
  loanStartDate: '2026-01-01',
  ...extras,
})

const roundingTolerance = (rows: number) => rows * 0.01 + 0.01

describe('calculateLoanSummary invariants', () => {
  for (const scenario of scenarios) {
    for (const repaymentType of repaymentTypes) {
      for (const amount of amounts) {
        for (const rate of rates) {
          for (const termYears of years) {
            const label = `${scenario.name}: ${repaymentType}, ${amount} PLN, ${rate}%, ${termYears} y`

            it(label, () => {
              const input = buildInput(amount, rate, termYears, repaymentType, scenario.extras)
              const summary = calculateLoanSummary(input)
              const { schedule } = summary
              const tolerance = roundingTolerance(schedule.length)

              expect(schedule.length).toBeGreaterThan(0)
              expect(schedule.length).toBeLessThanOrEqual(termYears * 12)
              expect(summary.loanTermMonths).toBe(schedule.length)

              // The loan is fully repaid by the end of the schedule.
              expect(schedule[schedule.length - 1].remainingBalance).toBeCloseTo(0, 2)

              // Every borrowed zloty is repaid exactly once, as regular or extra principal.
              const repaidPrincipal = schedule.reduce(
                (sum, row) => sum + row.principal + row.extraPayment,
                0,
              )
              expect(Math.abs(repaidPrincipal - amount)).toBeLessThanOrEqual(tolerance)

              // Summary totals agree with the schedule rows.
              const interestFromRows = schedule.reduce((sum, row) => sum + row.interest, 0)
              const paidFromRows = schedule.reduce(
                (sum, row) => sum + row.payment + row.extraPayment,
                0,
              )
              expect(Math.abs(summary.totalInterest - interestFromRows)).toBeLessThanOrEqual(tolerance)
              expect(Math.abs(summary.totalPaid - paidFromRows)).toBeLessThanOrEqual(tolerance)
              expect(Math.abs(summary.totalPaid - (amount + summary.totalInterest))).toBeLessThanOrEqual(
                tolerance,
              )

              let previousBalance = amount
              schedule.forEach((row, index) => {
                // The balance never grows and never goes below zero.
                expect(row.remainingBalance).toBeGreaterThanOrEqual(0)
                expect(row.remainingBalance).toBeLessThanOrEqual(previousBalance + 0.01)

                // Each row's installment is its regular principal plus interest.
                expect(Math.abs(row.payment - (row.principal + row.interest))).toBeLessThanOrEqual(0.011)

                // The balance moves by exactly the principal and extra payment of the row.
                expect(
                  Math.abs(previousBalance - row.principal - row.extraPayment - row.remainingBalance),
                ).toBeLessThanOrEqual(0.011)

                expect(row.month).toBe(index + 1)
                previousBalance = row.remainingBalance
              })
            })
          }
        }
      }
    }
  }
})

describe('overpayments never make a loan more expensive', () => {
  const overpaymentScenarios = scenarios.filter(
    (scenario) => scenario.extras.recurringExtraPayments || scenario.extras.extraPayments,
  )

  for (const scenario of overpaymentScenarios) {
    for (const repaymentType of repaymentTypes) {
      for (const rate of [2.5, 7.9]) {
        it(`${scenario.name}: ${repaymentType}, ${rate}%`, () => {
          const baselineExtras: Partial<LoanInput> = scenario.extras.rateChanges
            ? { rateChanges: scenario.extras.rateChanges }
            : {}
          const baseline = calculateLoanSummary(
            buildInput(350_000, rate, 25, repaymentType, baselineExtras),
          )
          const withOverpayments = calculateLoanSummary(
            buildInput(350_000, rate, 25, repaymentType, scenario.extras),
          )

          expect(withOverpayments.totalInterest).toBeLessThanOrEqual(baseline.totalInterest)
          expect(withOverpayments.loanTermMonths).toBeLessThanOrEqual(baseline.loanTermMonths)
        })
      }
    }
  }
})
