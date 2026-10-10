# Project Guidelines

## Architecture
- This is a React 19 + TypeScript + Vite mortgage calculator. `src/App.tsx` coordinates the UI and form state, `src/calculator.ts` calculates loan summaries and schedules, `src/savedCalculations.ts` validates saved payloads, and `src/lib/supabase.ts` configures Supabase.
- Keep calculation logic in the calculator layer and UI orchestration in the app. Preserve existing public types and saved-data compatibility unless the task requires a change.

## Financial Correctness
- Treat loan calculations as financial behavior: do not change formulas, rounding, payment dates, or cost allocation based on assumptions. State the intended behavior and add or update focused tests in `src/calculator.test.ts` before considering the change complete.
- Verify boundary cases relevant to a change, especially selected dates, month transitions, early payoff, remaining balance, and consistency between schedule rows and summary totals.
- Keep labels and columns aligned with the values they actually display; distinguish principal balance from additional costs.

## Build and Test
- Install dependencies with `npm install` when needed.
- Run all tests with `npx vitest run --reporter=verbose`.
- Run the production typecheck and build with `npm run build`, and lint with `npm run lint` when relevant.
- Do not claim verification unless the corresponding command has been run successfully.

## Conventions
- Make the smallest change that addresses the request; follow nearby React, TypeScript, and CSS patterns and avoid unrelated cleanup.
- For Supabase changes, preserve per-user data isolation and never expose secrets or weaken access controls.
- Ask before committing or pushing. A direct user request to commit or push is authorization for that operation.
- When a tool or command fails, use the failure to choose a targeted next step instead of repeating unrelated operations.
