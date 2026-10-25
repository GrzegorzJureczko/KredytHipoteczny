# Mortgage calculator (Kalkulator kredytu hipotecznego)

[![CI](https://github.com/GrzegorzJureczko/KredytHipoteczny/actions/workflows/ci.yml/badge.svg)](https://github.com/GrzegorzJureczko/KredytHipoteczny/actions/workflows/ci.yml)
[![License: All rights reserved](https://img.shields.io/badge/license-source--available-lightgrey.svg)](LICENSE)

**Live demo: <https://kredyt-hipoteczny.vercel.app/>**

A single-page mortgage calculator that shows the real cost of a loan, not just the installment: a full
repayment schedule, overpayments, rate changes (WIBOR + margin), fees and insurance. It is designed
for the **Polish market** (PLN, WIBOR-based variable rates, Polish mortgage terminology) and the UI is
in Polish. The calculator works without an account; signed-in users can save and reopen their scenarios.

*Po polsku: kalkulator kredytu hipotecznego przeznaczony na polski rynek, z harmonogramem spłat,
nadpłatami, zmianami oprocentowania (WIBOR + marża), kosztami okołokredytowymi i ubezpieczeniami.
Interfejs aplikacji jest w języku polskim.*

## Features

- **Loan setup:** amount, property value (LTV and own contribution), start month, term in years,
  equal (annuity) or decreasing installments, WIBOR + margin.
- **Rate changes:** any number of changes, each with its own date, WIBOR and margin; every new change
  starts from the previous one.
- **Overpayments:** several recurring overpayments with their own start, end and effect, plus one-off
  overpayments. Each can shorten the term or lower the installment.
- **Costs:** application fee (amount or % of the loan), notary, valuation, life insurance (amount or %
  of the current balance, limited duration) and property insurance (amount or %, monthly or annual).
- **Summary:** first and last installment, repayment period and end month, total cost split into
  principal, interest and additional costs, and the interest and time saved by overpayments.
- **Schedule:** one sticky-header table grouped by year with yearly subtotals, a totals row, markers
  for overpayment events and the last installment, and a card layout on phones.
- **Accounts (Supabase):** sign up, sign in, password reset; save, load, rename, copy and delete
  calculations; warnings about unsaved changes.
- **Quality of life:** thousands separators while typing, inline validation, tap-friendly tooltips,
  responsive layout.

## Tech stack

React 19, TypeScript, Vite, Supabase (auth and Postgres with row level security), Vitest and Testing
Library, oxlint, GitHub Actions, Vercel.

## How the calculation works

The financial logic lives in [`src/calculator.ts`](src/calculator.ts) and is independent of the UI.
The conventions are deliberate and covered by tests:

- Interest for a month is the opening balance times the annual rate divided by 12.
- An overpayment is booked in the month it is paid. It does not change that month's interest or
  installment; the lower balance applies from the following month.
- **Shorten term:** the scheduled installment stays the same and the loan ends earlier.
  **Lower installment:** the installment is recalculated for the remaining months after each
  overpayment.
- A rate change applies from the selected month and the installment is recalculated for the remaining
  term. A rate of exactly 0% is a valid rate.
- Recurring overpayments run from their start month to their end month (inclusive) or to the end of the
  loan; several of them add up.
- Fees are charged in the first month. Insurance is charged only while the loan runs, so the summary
  totals always match the schedule rows.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/calculator.ts` | Schedule and summary calculation (pure functions) |
| `src/savedCalculations.ts` | Validation and backward-compatible normalization of saved payloads |
| `src/App.tsx` | UI and form state |
| `src/lib/supabase.ts` | Supabase client (disabled when no env vars are set) |
| `supabase/migrations/` | Database schema, row level security policies |
| `.github/workflows/ci.yml` | Lint, tests and build on every push and pull request |

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

The calculator wog

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run all tests once (`npm run test:watch` for watch mode) |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |

## Supabase setup (optional)

1. Create a Supabase project.
2. Apply the SQL files from [`supabase/migrations`](supabase/migrations) in order (SQL editor or the
   Supabase CLI). They create the `saved_calculations` table, its row level security policies (each
   user can only read and change their own rows) and an `updated_at` column with a trigger.
3. In **Authentication → URL Configuration**, set the site URL to where the app runs and add it to
   the redirect URLs (used for e-mail confirmation and password reset links).
4. Copy `.env.example` to `.env` and fill in the project URL and the anon public key:

   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

Only the public anon key is used in the browser; access to data is enforced by row level security.

## Tests

Around 100 tests run in CI:

- calculator unit tests: installments, rate changes including 0%, one-off and recurring overpayments,
  payoff edge cases;
- normalization of saved payloads, including legacy formats;
- UI tests with Testing Library: inputs, validation, summary, schedule, saving and loading.

## Deployment

The app is a static Vite build deployed on Vercel. Set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` in the project settings to enable accounts.

## Roadmap

CSV export and print view, a balance chart, side-by-side comparison of two scenarios, installment
number in the schedule, English translation.

## Disclaimer

Results are indicative and are not a loan offer. The actual terms are set by the bank.

## License

Source-available, all rights reserved. The app is free to use and the code is public for viewing and
evaluation, but copying, modifying and commercial use are not allowed. See [LICENSE](LICENSE).
