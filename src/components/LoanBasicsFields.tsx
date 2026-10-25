import type { RepaymentType } from '../calculator'
import { formatCurrency, formatPercent } from '../format'
import type { LoanFormController } from '../hooks/useLoanForm'
import { getLoanValidationMessages } from '../loanForm'
import { FieldTooltip } from './FieldTooltip'
import { MonthYearInput } from './MonthYearInput'
import { UnitInput } from './UnitInput'

export const LoanBasicsFields = ({ loan }: { loan: LoanFormController }) => {
  const { form, updateField } = loan
  const validationMessages = getLoanValidationMessages(form)
  const ltvPercent =
    form.propertyValue > 0 && form.amount > 0 ? (form.amount / form.propertyValue) * 100 : null
  const ownContribution = Math.max(0, form.propertyValue - form.amount)

  return (
    <div className="field-grid">
      <label>
        <span className="field-title">
          Kwota kredytu
          <FieldTooltip id="loan-amount-help" text="Całkowita kwota, którą chcesz pożyczyć" />
        </span>
        <UnitInput
          unit="zł"
          min="0"
          step="5000"
          value={form.amount}
          onValueChange={(value) => updateField('amount', value)}
        />
      </label>

      <label>
        <span>Wartość nieruchomości</span>
        <UnitInput
          unit="zł"
          min="0"
          step="5000"
          value={form.propertyValue}
          onValueChange={(value) => updateField('propertyValue', value)}
        />
      </label>

      {validationMessages.length > 0 ? (
        <div className="field-warnings full-width" role="status">
          {validationMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      {ltvPercent !== null ? (
        <p className={ltvPercent > 80 ? 'loan-ltv is-high full-width' : 'loan-ltv full-width'}>
          <span>
            LTV <strong>{formatPercent(ltvPercent)}</strong>
          </span>
          {ownContribution > 0 ? (
            <span>
              Własny wkład <strong>{formatCurrency(ownContribution)}</strong>
            </span>
          ) : null}
          {ltvPercent > 80 ? <span>Wysokie LTV</span> : null}
        </p>
      ) : null}

      <label>
        <span className="field-title">
          Data startu kredytu
          <FieldTooltip
            id="loan-start-help"
            text="Miesiąc i rok uruchomienia kredytu, od którego liczony jest harmonogram"
          />
        </span>
        <MonthYearInput
          value={form.loanStartDate}
          onChange={(value) => updateField('loanStartDate', value)}
        />
      </label>

      <div className="field-grid interest-rate-row full-width">
        <label>
          <span className="field-title">
            WIBOR
            <FieldTooltip id="loan-rate-help" text="Roczna stopa procentowa WIBOR" />
          </span>
          <UnitInput
            unit="%"
            min="0"
            step="0.1"
            value={form.wibor}
            onValueChange={(value) => updateField('wibor', value)}
          />
        </label>

        <label>
          <span className="field-title">
            Marża
            <FieldTooltip id="loan-margin-help" text="Marża banku dodawana do WIBOR-u" />
          </span>
          <UnitInput
            unit="%"
            min="0"
            step="0.1"
            value={form.margin}
            onValueChange={(value) => updateField('margin', value)}
          />
        </label>

        <label>
          <span className="field-title">
            Oprocentowanie
            <FieldTooltip id="loan-rate-total-help" text="Suma WIBOR-u i marży" />
          </span>
          <UnitInput
            unit="%"
            min="0"
            step="0.1"
            value={form.rate}
            readOnly
            aria-readonly="true"
          />
        </label>
      </div>

      <div className="field-grid compact full-width">
        <label>
          <span className="field-title">
            Okres kredytowania
            <FieldTooltip id="loan-term-help" text="Na ile lat rozciągasz spłatę" />
          </span>
          <UnitInput
            unit="lat"
            min="1"
            max="40"
            step="1"
            value={form.years}
            onValueChange={(value) => updateField('years', value)}
          />
        </label>

        <label>
          <span className="field-title">
            Rodzaj raty
            <FieldTooltip id="repayment-type-help" text="Wybierz wariant składanych płatności" />
          </span>
          <select
            value={form.repaymentType}
            onChange={(event) => updateField('repaymentType', event.target.value as RepaymentType)}
          >
            <option value="annuity">Raty równe (annuitetowe)</option>
            <option value="decreasing">Raty malejące</option>
          </select>
        </label>
      </div>
    </div>
  )
}
