---
name: financial-calculation-review
description: 'Review or validate mortgage-calculator changes involving loan formulas, repayment schedules, rates, overpayments, balances, insurance, fees, totals, or saved calculation payloads. Use for financial logic reviews, regression checks, and requests to verify calculation correctness.'
user-invocable: true
---

# Financial Calculation Review

Use this skill to review financial behavior in this mortgage calculator. It is a review workflow: report findings and tests; do not edit code unless the user also asks for implementation.

## Review Procedure

1. **Bound the change.** Inspect the requested behavior, relevant diff, nearby implementation, and existing tests. Avoid broad unrelated exploration. Identify which layer owns the behavior before judging it.
2. **Trace the data flow.** Use the relevant parts of this project:
   - `src/calculator.ts` and `src/calculator.test.ts` for installment formulas, interest, principal, rate changes, extra payments, remaining balance, and loan-term behavior.
   - `src/App.tsx` for monthly fee and insurance allocation, schedule dates/grouping, totals, and displayed labels. In particular, inspect `getLifeInsuranceMonths`, `getPropertyInsuranceMonthlyPremium`, and `getMonthlyAdditionalCost` when relevant.
   - `src/savedCalculations.ts` and `src/savedCalculations.test.ts` when form or persisted fields change; check legacy payload normalization and enum defaults.
3. **Establish expected semantics.** Do not infer bank conventions from labels or silently assume when payments are booked. Check the selected start date, month-key comparison, whether a payment is one-off or recurring, and whether an extra payment reduces term or installment. If the expected behavior is ambiguous and changes the financial result, state the ambiguity or ask for clarification instead of choosing a convention.
   - Project convention: an extra payment is recorded in the month it is paid. It does not change that month's already-calculated interest or regular installment; its reduced balance affects calculations starting at the beginning of the following month.
   - For `reduceTerm`, keep the scheduled annuity installment unchanged (except for rate changes and a partial final installment); with decreasing repayments, keep the scheduled principal portion unchanged. The loan should finish earlier when extra principal is paid.
   - For `reduceInstallment`, recalculate the installment after each applied extra payment using the current balance and remaining term. Do not forecast future recurring extra payments before they occur; explicitly scheduled one-off payments retain their existing handling. The loan can end early if an applied extra payment clears the remaining balance.
4. **Check applicable cases.** Select only cases affected by the change; include boundaries where relevant:
   - annuity and decreasing installments, including zero or very low interest;
   - dates before, on, and after a rate change or extra-payment start date, including year/month transitions and multiple changes;
   - one-off and recurring extra payments, both reduction modes, multiple payments in one month, and payoff in the final month;
   - life-insurance duration and units, monthly versus annual property premiums, property-value versus loan-amount basis, and first-month-only fees;
   - saved payloads with new fields, old payloads, and invalid enum values.
5. **Check accounting consistency.** Compare schedule rows with summary values using the project’s actual field meanings. Verify that applied principal, interest, regular payment, extra payment, additional costs, total paid, total cost, remaining balance, and loan duration agree for the scenarios under review. Pay special attention to final-payoff capping: requested extra payment, applied principal, displayed amounts, and totals must not contradict one another. Do not treat additional costs as principal balance.
6. **Check UI representation when touched.** Confirm each schedule header matches its cell value, header and body have the same number and order of columns, and monthly/yearly totals or labels do not imply a different meaning than the calculation.
7. **Run focused tests first**, then the full test suite with `npx vitest run --reporter=verbose`. Run `npm run build` for TypeScript or UI changes and `npm run lint` when lint-relevant files changed. Report commands actually run; do not claim unverified correctness.

## Reporting

- Lead with actionable findings, ordered by severity, with file references.
- Separate confirmed defects from assumptions or ambiguous financial requirements.
- Name important missing regression tests and state which checks passed or could not be run.
- If there are no findings, say so clearly and note residual risks or untested scenarios.
