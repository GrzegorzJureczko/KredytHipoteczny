import { useMemo, useState } from 'react'
import './App.css'
import { calculateLoanSummary, type ExtraPaymentMode, type RepaymentType } from './calculator'

type ExtraPaymentEntry = {
  id: number
  amount: number
  date: string
  effect: ExtraPaymentMode
}

type FormState = {
  amount: number
  rate: number
  years: number
  repaymentType: RepaymentType
  extraMonthlyPayment: number
  extraMonthlyPaymentStartDate: string
  extraPaymentMode: ExtraPaymentMode
  extraPayments: ExtraPaymentEntry[]
  applicationFee: number
  insurance: number
  notary: number
  appraisal: number
  commission: number
}

const getNextMonthDate = () => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + 1)
  return date.toISOString().slice(0, 10)
}

const getDateOffsetMonths = (offsetMonths: number) => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + offsetMonths)
  return date.toISOString().slice(0, 10)
}

const initialForm: FormState = {
  amount: 350000,
  rate: 5.2,
  years: 30,
  repaymentType: 'annuity',
  extraMonthlyPayment: 500,
  extraMonthlyPaymentStartDate: getNextMonthDate(),
  extraPaymentMode: 'reduceTerm',
  extraPayments: [],
  applicationFee: 1500,
  insurance: 4200,
  notary: 3500,
  appraisal: 1800,
  commission: 0,
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)

const monthNames = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
]

function App() {
  const [form, setForm] = useState<FormState>(initialForm)

  const additionalCosts =
    form.applicationFee +
    form.insurance +
    form.notary +
    form.appraisal +
    form.commission

  const loanStartDate = useMemo(() => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() + 1)
    return date.toISOString().slice(0, 10)
  }, [])

  const summary = useMemo(
    () =>
      calculateLoanSummary({
        loanAmount: form.amount,
        annualRate: form.rate,
        termMonths: form.years * 12,
        repaymentType: form.repaymentType,
        loanStartDate,
        extraMonthlyPayment: form.extraMonthlyPayment,
        extraMonthlyPaymentStartDate: form.extraMonthlyPaymentStartDate,
        extraPayments: form.extraPayments.map(({ amount, date, effect }) => ({
          amount,
          date,
          effect,
        })),
        extraPaymentMode: form.extraPaymentMode,
      }),
    [form, loanStartDate],
  )

  const totalCost = summary.totalPaid + additionalCosts
  const monthlyBurden = summary.monthlyPayment + additionalCosts / Math.max(form.years * 12, 1)

  const resetForm = () => setForm(initialForm)

  const addExtraPayment = () => {
    setForm((current) => ({
      ...current,
      extraPayments: [
        ...current.extraPayments,
        {
          id: Date.now() + Math.random(),
          amount: 500,
          date: getDateOffsetMonths(12),
          effect: 'reduceTerm',
        },
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

  const scheduleWithDates = summary.schedule.map((row, index) => {
    const baseDate = new Date()
    const paymentDate = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + 1 + index,
      1,
    )

    return {
      ...row,
      paymentDate,
      monthLabel: `${monthNames[paymentDate.getMonth()]} ${paymentDate.getFullYear()}`,
      year: paymentDate.getFullYear(),
    }
  })

  const groupedByYear = Object.values(
    scheduleWithDates.reduce<Record<number, typeof scheduleWithDates>>((acc, item) => {
      if (!acc[item.year]) {
        acc[item.year] = []
      }
      acc[item.year].push(item)
      return acc
    }, {}),
  )

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
        <button type="button" className="reset-button" onClick={resetForm}>
          Przywróć domyślne
        </button>
      </header>

      <main className="app-grid">
        <section className="panel form-panel">
          <h2>Dane podstawowe</h2>

          <div className="field-grid">
            <label>
              <span>Kwota kredytu</span>
              <small>Całkowita kwota, którą chcesz pożyczyć</small>
              <input
                type="number"
                min="0"
                value={form.amount}
                onChange={(event) => updateField('amount', Number(event.target.value))}
              />
            </label>

            <label>
              <span>Oprocentowanie</span>
              <small>Roczna stopa procentowa kredytu</small>
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
              <small>Na ile lat rozciągasz spłatę</small>
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
              <small>Wybierz wariant składanych płatności</small>
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
                <small>Stała nadpłata powtarzana co miesiąc</small>
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
                <span>Data rozpoczęcia nadpłaty</span>
                <small>Od kiedy ma zaczynać działać stała nadpłata</small>
                <input
                  type="date"
                  value={form.extraMonthlyPaymentStartDate}
                  onChange={(event) =>
                    updateField('extraMonthlyPaymentStartDate', event.target.value)
                  }
                />
              </label>

              <label className="full-width">
                <span>Efekt nadpłaty</span>
                <small>Co ma się zmienić po dodatkowej wpłacie</small>
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

            <div className="extra-payment-list">
              <div className="extra-payment-header">
                <h4>Dodatkowe nadpłaty jednorazowe</h4>
                <button type="button" className="secondary-button" onClick={addExtraPayment}>
                  + Dodaj nadpłatę
                </button>
              </div>

              {form.extraPayments.length === 0 ? (
                <p className="empty-state">Brak dodatkowych nadpłat. Dodaj datę i kwotę, aby uwzględnić ją w harmonogramie.</p>
              ) : (
                form.extraPayments.map((payment) => (
                  <div key={payment.id} className="extra-payment-row">
                    <label>
                      <span>Kwota</span>
                      <input
                        type="number"
                        min="0"
                        value={payment.amount}
                        onChange={(event) =>
                          updateExtraPayment(payment.id, 'amount', Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      <span>Data</span>
                      <input
                        type="date"
                        value={payment.date}
                        onChange={(event) =>
                          updateExtraPayment(payment.id, 'date', event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>Efekt</span>
                      <select
                        value={payment.effect}
                        onChange={(event) =>
                          updateExtraPayment(
                            payment.id,
                            'effect',
                            event.target.value as ExtraPaymentMode,
                          )
                        }
                      >
                        <option value="reduceTerm">Skrócenie okresu</option>
                        <option value="reduceInstallment">Obniżenie raty</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removeExtraPayment(payment.id)}
                    >
                      Usuń
                    </button>
                  </div>
                ))
              )}
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
            <article className="summary-highlight">
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
          <span>po latach</span>
        </div>

        <div className="schedule-table-header">
          <table>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Miesiąc</th>
                <th>Rata</th>
                <th>Kapitał</th>
                <th>Odsetki</th>
                <th>Nadpłata</th>
                <th>Saldo</th>
              </tr>
            </thead>
          </table>
        </div>

        <div className="year-groups">
          {groupedByYear.map((rows, index) => (
            <details key={rows[0]?.year ?? index} open={index === 0} className="year-group">
              <summary>{rows[0]?.year}</summary>
              <div className="table-wrap">
                <table>
                  <colgroup>
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.year}-${row.month}`}>
                        <td>{row.monthLabel}</td>
                        <td>{formatCurrency(row.payment)}</td>
                        <td>{formatCurrency(row.principal)}</td>
                        <td>{formatCurrency(row.interest)}</td>
                        <td>{formatCurrency(row.extraPayment)}</td>
                        <td>{formatCurrency(row.remainingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}

export default App
