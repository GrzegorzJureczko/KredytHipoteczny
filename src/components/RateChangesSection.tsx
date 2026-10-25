import { pluralize } from '../format'
import type { LoanFormController } from '../hooks/useLoanForm'
import {
  getAnnualRateFromSplit,
  getMonthIndex,
  getRateChangeWarning,
  type LoanTimeline,
} from '../loanForm'
import { MonthYearInput } from './MonthYearInput'
import { UnitInput } from './UnitInput'

export const RateChangesSection = ({
  loan,
  timeline,
}: {
  loan: LoanFormController
  timeline: LoanTimeline
}) => {
  const { form, addRateChange, updateRateChange, removeRateChange } = loan
  const sortedRateChanges = [...form.rateChanges].sort(
    (a, b) => getMonthIndex(a.date) - getMonthIndex(b.date),
  )

  return (
    <details className="subsection collapsible-section">
      <summary>
        Zmiany oprocentowania
        <span className="section-badge">
          {form.rateChanges.length === 0
            ? 'Brak'
            : `${form.rateChanges.length} ${pluralize(form.rateChanges.length, 'zmiana', 'zmiany', 'zmian')}`}
        </span>
      </summary>
      <div className="extra-payment-list">
        <div className="extra-payment-header is-end">
          <button type="button" className="secondary-button" onClick={addRateChange}>
            + Dodaj zmianę
          </button>
        </div>

        {form.rateChanges.length === 0 ? (
          <p className="empty-state">
            Brak zmian oprocentowania. Dodaj zmianę i ustaw datę, WIBOR oraz marżę, aby zmienić
            odsetki od wybranego momentu. Każda kolejna zmiana startuje od wartości poprzedniej.
          </p>
        ) : (
          sortedRateChanges.map((entry) => {
            const warning = getRateChangeWarning(entry, sortedRateChanges, timeline)

            return (
              <div key={entry.id} className="row-with-note">
                <div className="extra-payment-row is-rate-change">
                  <label>
                    <span>Data zmiany</span>
                    <MonthYearInput
                      value={entry.date}
                      onChange={(value) => updateRateChange(entry.id, 'date', value)}
                    />
                  </label>
                  <label>
                    <span>WIBOR</span>
                    <UnitInput
                      unit="%"
                      min="0"
                      step="0.1"
                      value={entry.wibor}
                      onValueChange={(value) => updateRateChange(entry.id, 'wibor', value)}
                    />
                  </label>
                  <label>
                    <span>Marża</span>
                    <UnitInput
                      unit="%"
                      min="0"
                      step="0.1"
                      value={entry.margin}
                      onValueChange={(value) => updateRateChange(entry.id, 'margin', value)}
                    />
                  </label>
                  <label>
                    <span>Oprocentowanie</span>
                    <UnitInput
                      unit="%"
                      min="0"
                      step="0.1"
                      value={getAnnualRateFromSplit(entry.wibor, entry.margin)}
                      readOnly
                      aria-readonly="true"
                    />
                  </label>
                  <button
                    type="button"
                    className="remove-button icon-button"
                    aria-label="Usuń zmianę oprocentowania"
                    onClick={() => removeRateChange(entry.id)}
                  >
                    ×
                  </button>
                </div>
                {warning ? <p className="row-note">{warning}</p> : null}
              </div>
            )
          })
        )}
      </div>
    </details>
  )
}
