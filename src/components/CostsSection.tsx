import { formatCurrency } from '../format'
import type { LoanFormController } from '../hooks/useLoanForm'
import {
  calculationTypeOptions,
  getApplicationFee,
  getLifeInsuranceMonthlyPremium,
  getPropertyInsuranceMonthlyPremium,
} from '../loanForm'
import { SegmentedControl } from './SegmentedControl'
import { UnitInput } from './UnitInput'

export const CostsSection = ({
  loan,
  totalAdditionalCosts,
}: {
  loan: LoanFormController
  totalAdditionalCosts: number
}) => {
  const {
    form,
    updateField,
    changeLifeInsuranceUnit,
    changeApplicationFeeCalculationType,
    changeLifeInsuranceCalculationType,
    changePropertyInsuranceCalculationType,
  } = loan

  return (
    <details className="subsection collapsible-section">
      <summary>
        Koszty około-kredytowe
        <span className="section-badge">Łącznie {formatCurrency(totalAdditionalCosts)}</span>
      </summary>
      <div className="field-grid compact">
        <div className="field-group full-width">
          <span>Prowizja</span>
          <SegmentedControl
            label="Sposób naliczania prowizji"
            value={form.applicationFeeCalculationType}
            options={calculationTypeOptions}
            onChange={changeApplicationFeeCalculationType}
          />
        </div>

        {form.applicationFeeCalculationType === 'percentage' ? (
          <>
            <label>
              <span>Stawka prowizji</span>
              <UnitInput
                unit="%"
                aria-label="Stawka prowizji"
                min="0"
                step="0.01"
                value={form.applicationFeePercent}
                onValueChange={(value) => updateField('applicationFeePercent', value)}
              />
            </label>

            <label>
              <span>Kwota prowizji</span>
              <UnitInput
                unit="zł"
                aria-label="Kwota prowizji"
                value={Number(getApplicationFee(form).toFixed(2))}
                readOnly
                aria-readonly="true"
              />
            </label>
          </>
        ) : (
          <label>
            <span>Kwota prowizji</span>
            <UnitInput
              unit="zł"
              aria-label="Kwota prowizji"
              min="0"
              step="100"
              value={form.applicationFee}
              onValueChange={(value) => updateField('applicationFee', value)}
            />
          </label>
        )}

        <label>
          <span>Notariusz / dokumenty</span>
          <UnitInput
            unit="zł"
            min="0"
            step="100"
            value={form.notary}
            onValueChange={(value) => updateField('notary', value)}
          />
        </label>

        <label>
          <span>Wycena / ekspertyza</span>
          <UnitInput
            unit="zł"
            min="0"
            step="100"
            value={form.appraisal}
            onValueChange={(value) => updateField('appraisal', value)}
          />
        </label>

        <label>
          <span>Inne</span>
          <UnitInput
            unit="zł"
            min="0"
            step="100"
            value={form.commission}
            onValueChange={(value) => updateField('commission', value)}
          />
        </label>
      </div>

      <div className="insurance-block">
        <h3>Ubezpieczenie na życie</h3>
        <div className="field-grid compact">
          <div className="field-group full-width">
            <span>Sposób naliczania</span>
            <SegmentedControl
              label="Sposób naliczania ubezpieczenia na życie"
              value={form.lifeInsuranceCalculationType}
              options={calculationTypeOptions}
              onChange={changeLifeInsuranceCalculationType}
            />
          </div>

          {form.lifeInsuranceCalculationType === 'percentage' ? (
            <>
              <label>
                <span>Stawka ubezpieczenia</span>
                <UnitInput
                  unit="%"
                  aria-label="Stawka ubezpieczenia na życie"
                  min="0"
                  step="0.01"
                  value={form.lifeInsuranceRatePercent}
                  onValueChange={(value) => updateField('lifeInsuranceRatePercent', value)}
                />
              </label>

              <label>
                <span>Składka miesięczna</span>
                <UnitInput
                  unit="zł"
                  aria-label="Składka miesięczna ubezpieczenia na życie"
                  min="0"
                  step="0.01"
                  value={Number(getLifeInsuranceMonthlyPremium(form).toFixed(2))}
                  readOnly
                  aria-readonly="true"
                />
              </label>

              <p className="field-note full-width">
                Stawka miesięczna liczona od aktualnego salda kredytu. Wyświetlona składka dotyczy
                pierwszego miesiąca.
              </p>
            </>
          ) : (
            <label>
              <span>Składka miesięczna</span>
              <UnitInput
                unit="zł"
                aria-label="Składka miesięczna ubezpieczenia na życie"
                min="0"
                step="10"
                value={form.lifeInsuranceMonthlyPremium}
                onValueChange={(value) => updateField('lifeInsuranceMonthlyPremium', value)}
              />
            </label>
          )}

          <label>
            <span>Czas ubezpieczenia</span>
            <div className="input-with-unit">
              <input
                type="number"
                aria-label="Czas ubezpieczenia"
                min="0"
                step="1"
                value={form.lifeInsuranceMonths}
                onChange={(event) => updateField('lifeInsuranceMonths', Number(event.target.value))}
              />
              <div className="unit-toggle" role="group" aria-label="Jednostka czasu">
                {(['months', 'years'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    aria-pressed={form.lifeInsuranceDurationUnit === unit}
                    onClick={() => changeLifeInsuranceUnit(unit)}
                  >
                    {unit === 'months' ? 'Miesiące' : 'Lata'}
                  </button>
                ))}
              </div>
            </div>
          </label>
        </div>
      </div>

      <div className="insurance-block">
        <h3>Ubezpieczenie nieruchomości</h3>
        <div className="field-grid compact">
          <div className="field-group full-width">
            <span>Sposób naliczania</span>
            <SegmentedControl
              label="Sposób naliczania ubezpieczenia nieruchomości"
              value={form.propertyInsuranceCalculationType}
              options={calculationTypeOptions}
              onChange={changePropertyInsuranceCalculationType}
            />
          </div>

          {form.propertyInsuranceCalculationType === 'percentage' ? (
            <>
              <label>
                <span>Stawka ubezpieczenia</span>
                <UnitInput
                  unit="%"
                  aria-label="Stawka ubezpieczenia nieruchomości"
                  min="0"
                  step="0.01"
                  value={form.propertyInsuranceRatePercent}
                  onValueChange={(value) => updateField('propertyInsuranceRatePercent', value)}
                />
              </label>

              <label>
                <span>Składka miesięczna</span>
                <UnitInput
                  unit="zł"
                  aria-label="Składka ubezpieczenia nieruchomości"
                  min="0"
                  step="0.01"
                  value={Number(getPropertyInsuranceMonthlyPremium(form).toFixed(2))}
                  readOnly
                  aria-readonly="true"
                />
              </label>

              <label>
                <span>Częstotliwość składki</span>
                <select
                  aria-label="Częstotliwość składki ubezpieczenia nieruchomości"
                  value={form.propertyInsuranceFrequency}
                  onChange={(event) =>
                    updateField(
                      'propertyInsuranceFrequency',
                      event.target.value as 'monthly' | 'annual',
                    )
                  }
                >
                  <option value="monthly">Miesięcznie</option>
                  <option value="annual">Rocznie</option>
                </select>
              </label>

              <label>
                <span>Podstawa kalkulacji</span>
                <select
                  value={form.propertyInsuranceBasis}
                  onChange={(event) =>
                    updateField(
                      'propertyInsuranceBasis',
                      event.target.value as 'propertyValue' | 'loanAmount',
                    )
                  }
                >
                  <option value="propertyValue">Wartość nieruchomości</option>
                  <option value="loanAmount">Kwota kredytu</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                <span>Składka</span>
                <UnitInput
                  unit="zł"
                  aria-label="Składka ubezpieczenia nieruchomości"
                  min="0"
                  step="0.01"
                  value={form.propertyInsuranceAmount}
                  onValueChange={(value) => updateField('propertyInsuranceAmount', value)}
                />
              </label>

              <label>
                <span>Częstotliwość składki</span>
                <select
                  aria-label="Częstotliwość składki ubezpieczenia nieruchomości"
                  value={form.propertyInsuranceFrequency}
                  onChange={(event) =>
                    updateField(
                      'propertyInsuranceFrequency',
                      event.target.value as 'monthly' | 'annual',
                    )
                  }
                >
                  <option value="monthly">Miesięcznie</option>
                  <option value="annual">Rocznie</option>
                </select>
              </label>
            </>
          )}
        </div>
      </div>
    </details>
  )
}
