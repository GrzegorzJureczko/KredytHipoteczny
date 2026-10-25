import type { ExtraPaymentMode } from '../calculator'
import { pluralize } from '../format'
import type { LoanFormController } from '../hooks/useLoanForm'
import { addMonthsToDate, getRegularOverpaymentWarning, type LoanTimeline } from '../loanForm'
import { MonthYearInput } from './MonthYearInput'
import { UnitInput } from './UnitInput'

export const OverpaymentsSection = ({
  loan,
  timeline,
}: {
  loan: LoanFormController
  timeline: LoanTimeline
}) => {
  const {
    form,
    addRegularOverpayment,
    updateRegularOverpayment,
    removeRegularOverpayment,
    addExtraPayment,
    updateExtraPayment,
    removeExtraPayment,
  } = loan

  const oneTimeCount = form.extraPayments.length
  const regularCount = form.regularOverpayments.length
  const badgeParts = [
    regularCount > 0
      ? `${regularCount} ${pluralize(regularCount, 'regularna', 'regularne', 'regularnych')}`
      : null,
    oneTimeCount > 0
      ? `${oneTimeCount} ${pluralize(oneTimeCount, 'jednorazowa', 'jednorazowe', 'jednorazowych')}`
      : null,
  ].filter((part): part is string => part !== null)
  const badge = badgeParts.length > 0 ? badgeParts.join(' + ') : 'Brak'

  return (
    <details className="subsection collapsible-section">
      <summary>
        Nadpłaty
        <span className="section-badge">{badge}</span>
      </summary>
      <div className="extra-payment-list">
        <div className="extra-payment-header is-end">
          <button type="button" className="secondary-button" onClick={addRegularOverpayment}>
            + Dodaj nadpłatę regularną
          </button>
          <button type="button" className="secondary-button" onClick={addExtraPayment}>
            + Dodaj nadpłatę jednorazową
          </button>
        </div>

        {regularCount === 0 && oneTimeCount === 0 ? (
          <p className="empty-state">
            Brak nadpłat. Dodaj nadpłatę regularną (co miesiąc, z datą startu i końca) albo
            jednorazową.
          </p>
        ) : null}

        {form.regularOverpayments.map((entry) => {
          const warning = getRegularOverpaymentWarning(entry, timeline)

          return (
            <div key={entry.id} className="row-with-note">
              <div className="extra-payment-row is-recurring">
                <span className="row-tag">Regularna</span>
                <label>
                  <span>Kwota miesięczna</span>
                  <UnitInput
                    unit="zł"
                    min="0"
                    step="100"
                    value={entry.amount}
                    onValueChange={(value) => updateRegularOverpayment(entry.id, { amount: value })}
                  />
                </label>
                <label>
                  <span>Efekt</span>
                  <select
                    value={entry.effect}
                    onChange={(event) =>
                      updateRegularOverpayment(entry.id, {
                        effect: event.target.value as ExtraPaymentMode,
                      })
                    }
                  >
                    <option value="reduceTerm">Skrócenie okresu</option>
                    <option value="reduceInstallment">Obniżenie raty</option>
                  </select>
                  <small className="field-note">
                    {entry.effect === 'reduceTerm'
                      ? 'Rata zostaje bez zmian, a nadpłata skraca okres spłaty.'
                      : 'Rata jest przeliczana po każdej nadpłacie dla pozostałego okresu.'}
                  </small>
                </label>
                <label>
                  <span>Od</span>
                  <MonthYearInput
                    value={entry.startDate}
                    onChange={(value) => updateRegularOverpayment(entry.id, { startDate: value })}
                  />
                </label>
                <div className="field-group">
                  <span>Do</span>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={entry.endDate === ''}
                      onChange={(event) =>
                        updateRegularOverpayment(entry.id, {
                          endDate: event.target.checked ? '' : addMonthsToDate(entry.startDate, 24),
                        })
                      }
                    />
                    Do końca kredytu
                  </label>
                  {entry.endDate !== '' ? (
                    <MonthYearInput
                      value={entry.endDate}
                      onChange={(value) => updateRegularOverpayment(entry.id, { endDate: value })}
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  className="remove-button icon-button"
                  aria-label="Usuń nadpłatę regularną"
                  onClick={() => removeRegularOverpayment(entry.id)}
                >
                  ×
                </button>
              </div>
              {warning ? <p className="row-note">{warning}</p> : null}
            </div>
          )
        })}

        {form.extraPayments.map((payment) => (
          <div key={payment.id} className="extra-payment-row">
            <span className="row-tag">Jednorazowa</span>
            <label>
              <span>Kwota</span>
              <UnitInput
                unit="zł"
                min="0"
                step="100"
                value={payment.amount}
                onValueChange={(value) => updateExtraPayment(payment.id, 'amount', value)}
              />
            </label>
            <label>
              <span>Data</span>
              <MonthYearInput
                value={payment.date}
                onChange={(value) => updateExtraPayment(payment.id, 'date', value)}
              />
            </label>
            <label>
              <span>Efekt</span>
              <select
                value={payment.effect}
                onChange={(event) =>
                  updateExtraPayment(payment.id, 'effect', event.target.value as ExtraPaymentMode)
                }
              >
                <option value="reduceTerm">Skrócenie okresu</option>
                <option value="reduceInstallment">Obniżenie raty</option>
              </select>
            </label>
            <button
              type="button"
              className="remove-button icon-button"
              aria-label="Usuń nadpłatę"
              onClick={() => removeExtraPayment(payment.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </details>
  )
}
