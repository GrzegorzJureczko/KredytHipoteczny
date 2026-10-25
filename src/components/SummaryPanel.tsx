import { formatCurrency, formatDuration } from '../format'
import type { SummaryView } from '../summaryView'

export const SummaryPanel = ({ view }: { view: SummaryView }) => (
  <aside className="panel summary-panel" id="podsumowanie">
    <h2>Podsumowanie</h2>

    <div className="summary-cards">
      <article className="summary-highlight">
        <span>{view.paymentLabel}</span>
        <strong>{formatCurrency(view.firstPayment)}</strong>
        {view.paymentChanges ? (
          <small>Ostatnia rata: {formatCurrency(view.lastRegularPayment)}</small>
        ) : null}
      </article>
      <article>
        <span>Okres spłaty</span>
        <strong>{formatDuration(view.loanTermMonths)}</strong>
        {view.endMonthLabel ? <small>do: {view.endMonthLabel}</small> : null}
      </article>
      <article>
        <span>Obciążenie miesięczne</span>
        <strong>{formatCurrency(view.monthlyBurden)}</strong>
        <small>rata + średnie koszty dodatkowe</small>
      </article>
    </div>

    <div className="cost-breakdown">
      <div className="cost-breakdown-header">
        <span>Całkowity koszt</span>
        <strong>{formatCurrency(view.totalCost)}</strong>
      </div>
      <div
        className="cost-bar"
        role="img"
        aria-label="Struktura kosztu: kapitał, odsetki i koszty dodatkowe"
      >
        {view.costParts.map((part) => (
          <span
            key={part.key}
            className={`cost-bar-segment cost-tone-${part.key}`}
            style={{ flexGrow: part.value }}
          />
        ))}
      </div>
      <ul className="cost-legend">
        {view.costParts.map((part) => (
          <li key={part.key}>
            <span className={`cost-dot cost-tone-${part.key}`} aria-hidden="true" />
            <span>{part.label}</span>
            <strong>{formatCurrency(part.value)}</strong>
            <small>
              {view.costPartsTotal > 0 ? Math.round((part.value / view.costPartsTotal) * 100) : 0}%
            </small>
          </li>
        ))}
      </ul>
    </div>

    {view.hasOverpayments && (view.interestSaved > 0 || view.monthsSaved > 0) ? (
      <div className="savings-box">
        <h3>Efekt nadpłat</h3>
        <div>
          <span>Mniej odsetek</span>
          <strong>{formatCurrency(view.interestSaved)}</strong>
        </div>
        {view.monthsSaved > 0 ? (
          <div>
            <span>Krótszy okres</span>
            <strong>{formatDuration(view.monthsSaved)}</strong>
          </div>
        ) : null}
      </div>
    ) : null}
  </aside>
)
