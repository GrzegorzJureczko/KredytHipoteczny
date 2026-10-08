import { useMemo, useState } from 'react'
import './App.css'
import { calculateLoanSummary, type ExtraPaymentMode, type RepaymentType } from './calculator'

type FormState = {
  amount: number
  rate: number
  years: number
  repaymentType: RepaymentType
  extraMonthlyPayment: number
  extraPaymentMode: ExtraPaymentMode
  applicationFee: number
  insurance: number
  notary: number
  appraisal: number
  commission: number
}

const initialForm: FormState = {
  amount: 350000,
  rate: 5.2,
  years: 30,
  repaymentType: 'annuity',
  extraMonthlyPayment: 500,
  extraPaymentMode: 'reduceTerm',
  applicationFee: 1500,
  insurance: 4200,
  notary: 3500,
  appraisal: 1800,
  commission: 0,
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)

function App() {
  const [form, setForm] = useState<FormState>(initialForm)

  const additionalCosts =
    form.applicationFee +
    form.insurance +
    form.notary +
    form.appraisal +
    form.commission

  const summary = useMemo(
    () =>
      calculateLoanSummary({
        loanAmount: form.amount,
        annualRate: form.rate,
        termMonths: form.years * 12,
        repaymentType: form.repaymentType,
        extraMonthlyPayment: form.extraMonthlyPayment,
        extraPaymentMode: form.extraPaymentMode,
      }),
    [form],
  )

  const totalCost = summary.totalPaid + additionalCosts
  const monthlyBurden = summary.monthlyPayment + additionalCosts / Math.max(form.years * 12, 1)
  const tableRows = summary.schedule.slice(0, 12)

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Kalkulator kredytowy</p>
          <h1>Porównaj realny koszt kredytu hipotecznego</h1>
        </div>
      </header>

      <main className="app-grid">
        <section className="panel form-panel">
          <h2>Dane podstawowe</h2>

          <div className="field-grid">
            <label>
              <span>Kwota kredytu</span>
              <input
                type="number"
                min="0"
                value={form.amount}
                onChange={(event) => updateField('amount', Number(event.target.value))}
              />
            </label>

            <label>
              <span>Oprocentowanie</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.rate}
                onChange={(event) => updateField('rate', Number(event.target.value))}
              />
            </label>

            <label>
              <span>Okres kredytowania</span>
              <select
                value={form.years}
                onChange={(event) => updateField('years', Number(event.target.value))}
              >
                {[5, 10, 15, 20, 25, 30, 35, 40].map((year) => (
                  <option key={year} value={year}>
                    {year} lat
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Rodzaj raty</span>
              <select
                value={form.repaymentType}
                onChange={(event) =>
                  updateField('repaymentType', event.target.value as RepaymentType)
                }
              >
                <option value="annuity">Równe</option>
                <option value="decreasing">Malejące</option>
              </select>
            </label>
          </div>

          <div className="subsection">
            <h3>Nadpłaty</h3>
            <div className="field-grid compact">
              <label>
                <span>Dodatkowa wpłata miesięczna</span>
                <input
                  type="number"
                  min="0"
                  value={form.extraMonthlyPayment}
                  onChange={(event) =>
                    updateField('extraMonthlyPayment', Number(event.target.value))
                  }
                />
              </label>

              <label>
                <span>Efekt nadpłaty</span>
                <select
                  value={form.extraPaymentMode}
                  onChange={(event) =>
                    updateField('extraPaymentMode', event.target.value as ExtraPaymentMode)
                  }
                >
                  <option value="reduceTerm">Skrócenie okresu</option>
                  <option value="reduceInstallment">Obniżenie raty</option>
                </select>
              </label>
            </div>
          </div>

          <div className="subsection">
            <h3>Koszty około-kredytowe</h3>
            <div className="field-grid compact">
              <label>
                <span>Opłata za wniosek</span>
                <input
                  type="number"
                  min="0"
                  value={form.applicationFee}
                  onChange={(event) => updateField('applicationFee', Number(event.target.value))}
                />
              </label>

              <label>
                <span>Ubezpieczenie</span>
                <input
                  type="number"
                  min="0"
                  value={form.insurance}
                  onChange={(event) => updateField('insurance', Number(event.target.value))}
                />
              </label>

              <label>
                <span>Notariusz / dokumenty</span>
                <input
                  type="number"
                  min="0"
                  value={form.notary}
                  onChange={(event) => updateField('notary', Number(event.target.value))}
                />
              </label>

              <label>
                <span>Wycena / ekspertyza</span>
                <input
                  type="number"
                  min="0"
                  value={form.appraisal}
                  onChange={(event) => updateField('appraisal', Number(event.target.value))}
                />
              </label>

              <label>
                <span>Prowizja / inne</span>
                <input
                  type="number"
                  min="0"
                  value={form.commission}
                  onChange={(event) => updateField('commission', Number(event.target.value))}
                />
              </label>
            </div>
          </div>
        </section>

        <aside className="panel summary-panel">
          <h2>Podsumowanie</h2>

          <div className="summary-cards">
            <article>
              <span>Rata miesięczna</span>
              <strong>{formatCurrency(summary.monthlyPayment)}</strong>
            </article>
            <article>
              <span>Łącznie odsetki</span>
              <strong>{formatCurrency(summary.totalInterest)}</strong>
            </article>
            <article>
              <span>Całkowity koszt</span>
              <strong>{formatCurrency(totalCost)}</strong>
            </article>
            <article>
              <span>Obciążenie miesięczne</span>
              <strong>{formatCurrency(monthlyBurden)}</strong>
            </article>
          </div>

          <div className="kpi-row">
            <div>
              <small>Koszty dodatkowe</small>
              <strong>{formatCurrency(additionalCosts)}</strong>
            </div>
            <div>
              <small>Skumulowana spłata</small>
              <strong>{formatCurrency(summary.totalPaid)}</strong>
            </div>
            <div>
              <small>Okres spłaty</small>
              <strong>{summary.loanTermMonths} mies.</strong>
            </div>
          </div>

          <div className="note-box">
            <p>
              W praktyce realny koszt zobowiązania często jest wyższy niż sama rata. Dodanie
              opłat okołokredytowych pozwala lepiej porównać oferty banków i zidentyfikować
              ukryte różnice między propozycjami.
            </p>
          </div>
        </aside>
      </main>

      <section className="panel schedule-panel">
        <div className="section-header">
          <h2>Harmonogram spłat</h2>
          <span>pierwsze 12 miesięcy</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Miesiąc</th>
                <th>Rata</th>
                <th>Kapitał</th>
                <th>Odsetki</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>{formatCurrency(row.payment)}</td>
                  <td>{formatCurrency(row.principal)}</td>
                  <td>{formatCurrency(row.interest)}</td>
                  <td>{formatCurrency(row.remainingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default App
