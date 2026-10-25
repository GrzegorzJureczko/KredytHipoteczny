import { useMemo } from 'react'
import './App.css'
import { calculateLoanSummary } from './calculator'
import { AccountPanel } from './components/AccountPanel'
import { ConfirmDialog } from './components/ConfirmDialog'
import { CostsSection } from './components/CostsSection'
import { LoanBasicsFields } from './components/LoanBasicsFields'
import { OverpaymentsSection } from './components/OverpaymentsSection'
import { RateChangesSection } from './components/RateChangesSection'
import { SchedulePanel } from './components/SchedulePanel'
import { SummaryPanel } from './components/SummaryPanel'
import { formatCurrency } from './format'
import { useAccount } from './hooks/useAccount'
import { useLoanForm } from './hooks/useLoanForm'
import {
  buildLoanInput,
  getLoanTimeline,
  getTotalAdditionalCosts,
  initialForm,
} from './loanForm'
import { buildScheduleRows, groupScheduleByYear, sumScheduleRows } from './scheduleView'
import { buildSummaryView, buildPrintDetails, hasAnyOverpayment } from './summaryView'

function App() {
  const loan = useLoanForm()
  const { form, setForm } = loan
  const account = useAccount(form, setForm)

  const summary = useMemo(() => calculateLoanSummary(buildLoanInput(form)), [form])
  const hasOverpayments = hasAnyOverpayment(form)

  const baselineSummary = useMemo(
    () =>
      hasOverpayments
        ? calculateLoanSummary(
            buildLoanInput({ ...form, regularOverpayments: [], extraPayments: [] }),
          )
        : null,
    [form, hasOverpayments],
  )

  const totalAdditionalCosts = useMemo(
    () => getTotalAdditionalCosts(form, summary.schedule),
    [form, summary.schedule],
  )

  const timeline = getLoanTimeline(form.loanStartDate, summary.loanTermMonths)
  const scheduleRows = buildScheduleRows(form, summary.schedule, timeline)
  const yearSections = groupScheduleByYear(scheduleRows)

  const summaryView = buildSummaryView({
    form,
    summary,
    baselineSummary,
    totalAdditionalCosts,
    endMonthLabel: scheduleRows[scheduleRows.length - 1]?.monthLabel,
  })

  const resetForm = () =>
    account.discardChangesThen(
      () => setForm(initialForm),
      'Przywrócenie wartości domyślnych odrzuci niezapisane zmiany.',
    )

  const { confirmRequest, setConfirmRequest } = account

  return (
    <>
      <nav className="site-nav" aria-label="Nawigacja główna">
        <span className="site-nav-brand">Kredyt hipoteczny</span>
        <div className="site-nav-links">
          <a href="#dane-podstawowe">Dane</a>
          <a href="#podsumowanie">Podsumowanie</a>
          <a href="#harmonogram">Harmonogram</a>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow">Pełna kontrola nad kosztem kredytu</p>
          <div className="hero-actions">
            <a className="hero-button hero-button-primary" href="#dane-podstawowe">
              Oblicz ratę
            </a>
            <button type="button" className="hero-button" onClick={resetForm}>
              Przywróć domyślne
            </button>
          </div>
        </div>
      </header>

      <main className="page-shell">
        <div className="print-summary" aria-hidden="true" data-details={buildPrintDetails(form)} />

        <AccountPanel account={account} />

        <div className="app-grid">
          <section className="panel form-panel" id="dane-podstawowe">
            <h2>Dane podstawowe</h2>

            <LoanBasicsFields loan={loan} />

            <p className="form-section-label">
              Dodatkowe parametry <span>opcjonalne</span>
            </p>

            <CostsSection loan={loan} totalAdditionalCosts={totalAdditionalCosts} />
            <RateChangesSection loan={loan} timeline={timeline} />
            <OverpaymentsSection loan={loan} timeline={timeline} />
          </section>

          <SummaryPanel view={summaryView} />
        </div>

        <SchedulePanel yearSections={yearSections} totals={sumScheduleRows(scheduleRows)} />
      </main>

      <footer className="site-footer">
        <p>
          Wyniki mają charakter orientacyjny i nie stanowią oferty w rozumieniu Kodeksu
          Cywilnego. Rzeczywiste warunki kredytu ustala bank.
        </p>
      </footer>

      <a className="mobile-summary-bar" href="#podsumowanie">
        <span>
          <small>{summaryView.paymentLabel}</small>
          <strong>{formatCurrency(summaryView.firstPayment)}</strong>
        </span>
        <span className="mobile-summary-link">Podsumowanie</span>
      </a>
      {confirmRequest ? (
        <ConfirmDialog
          request={confirmRequest}
          onCancel={() => setConfirmRequest(null)}
          onConfirm={() => {
            setConfirmRequest(null)
            confirmRequest.onConfirm()
          }}
        />
      ) : null}
    </>
  )
}

export default App
