import { useState } from 'react'
import { buildScheduleCsv, downloadCsv } from '../csvExport'
import { capitalize, formatCurrency, formatMoneyOrDash, formatPercent } from '../format'
import type { ScheduleTotals, ScheduleYearSection } from '../scheduleView'

export const SchedulePanel = ({
  yearSections,
  totals,
}: {
  yearSections: ScheduleYearSection[]
  totals: ScheduleTotals
}) => {
  const [openYears, setOpenYears] = useState<number[] | null>(null)

  const defaultOpenYears = yearSections.length > 0 ? [yearSections[0].year] : []
  const isYearOpen = (year: number) => (openYears ?? defaultOpenYears).includes(year)

  const toggleYear = (year: number) =>
    setOpenYears((current) => {
      const base = current ?? defaultOpenYears
      return base.includes(year) ? base.filter((openYear) => openYear !== year) : [...base, year]
    })
  const expandAllYears = () => setOpenYears(yearSections.map((section) => section.year))
  const collapseAllYears = () => setOpenYears([])
  const exportCsv = () =>
    downloadCsv('harmonogram-splat.csv', buildScheduleCsv(yearSections, totals))

  return (
    <section className="panel schedule-panel" id="harmonogram">
      <div className="section-header">
        <h2>Harmonogram spłat</h2>
        <div className="schedule-actions">
          <button type="button" className="secondary-button" onClick={expandAllYears}>
            Rozwiń wszystko
          </button>
          <button type="button" className="secondary-button" onClick={collapseAllYears}>
            Zwiń wszystko
          </button>
          <button type="button" className="secondary-button" onClick={exportCsv}>
            Pobierz CSV
          </button>
          <button type="button" className="secondary-button" onClick={() => window.print()}>
            Drukuj
          </button>
        </div>
      </div>

      <div className="schedule-table">
        <table>
          <caption className="visually-hidden">Harmonogram spłat</caption>
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Miesiąc</th>
              <th scope="col" className="num">Oprocentowanie</th>
              <th scope="col" className="num">Rata</th>
              <th scope="col" className="num">Kapitał</th>
              <th scope="col" className="num">Odsetki</th>
              <th scope="col" className="num">Nadpłata</th>
              <th scope="col" className="num">Koszty dodatkowe</th>
              <th scope="col" className="num">Saldo</th>
            </tr>
          </thead>
          {yearSections.map((section) => {
            const isOpen = isYearOpen(section.year)

            return (
              <tbody key={section.year} className={isOpen ? 'year-section is-open' : 'year-section'}>
                <tr className="year-row">
                  <th scope="rowgroup" className="year-cell">
                    <button
                      type="button"
                      className="year-toggle"
                      aria-expanded={isOpen}
                      onClick={() => toggleYear(section.year)}
                    >
                      <span aria-hidden="true">{isOpen ? '−' : '+'}</span> {section.year}
                    </button>
                  </th>
                  <td className="num year-blank" aria-hidden="true" />
                  <td className="num" data-label="Rata">{formatCurrency(section.totals.payment)}</td>
                  <td className="num" data-label="Kapitał">{formatCurrency(section.totals.principal)}</td>
                  <td className="num" data-label="Odsetki">{formatCurrency(section.totals.interest)}</td>
                  <td className="num" data-label="Nadpłata">{formatMoneyOrDash(section.totals.extraPayment)}</td>
                  <td className="num" data-label="Koszty dodatkowe">{formatMoneyOrDash(section.totals.additionalCosts)}</td>
                  <td className="num" data-label="Saldo na koniec roku">{formatCurrency(section.endBalance)}</td>
                </tr>
                {section.rows.map((row) => (
                  <tr
                    key={`${row.year}-${row.month}`}
                    className={row.events.length > 0 ? 'schedule-row has-event' : 'schedule-row'}
                    hidden={!isOpen}
                  >
                    <td data-label="Miesiąc">
                      {capitalize(row.monthLabel)}
                      {row.events.length > 0 ? (
                        <span className="row-events">
                          {row.events.map((event) => (
                            <span key={event.key} className={`event-tag event-${event.key}`}>
                              {event.label}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={row.rateChanged ? 'num' : 'num is-unchanged'}
                      data-label="Oprocentowanie"
                    >
                      {formatPercent(row.annualRate)}
                    </td>
                    <td className="num" data-label="Rata">{formatCurrency(row.payment)}</td>
                    <td className="num" data-label="Kapitał">{formatCurrency(row.principal)}</td>
                    <td className="num" data-label="Odsetki">{formatCurrency(row.interest)}</td>
                    <td className="num" data-label="Nadpłata">{formatMoneyOrDash(row.extraPayment)}</td>
                    <td className="num" data-label="Koszty dodatkowe">{formatMoneyOrDash(row.additionalCosts)}</td>
                    <td className="num" data-label="Saldo">{formatCurrency(row.remainingBalance)}</td>
                  </tr>
                ))}
              </tbody>
            )
          })}
          <tfoot>
            <tr className="schedule-total-row">
              <th scope="row">Razem</th>
              <td className="num year-blank" aria-hidden="true" />
              <td className="num" data-label="Rata">{formatCurrency(totals.payment)}</td>
              <td className="num" data-label="Kapitał">{formatCurrency(totals.principal)}</td>
              <td className="num" data-label="Odsetki">{formatCurrency(totals.interest)}</td>
              <td className="num" data-label="Nadpłata">{formatMoneyOrDash(totals.extraPayment)}</td>
              <td className="num" data-label="Koszty dodatkowe">{formatMoneyOrDash(totals.additionalCosts)}</td>
              <td className="num" data-label="Saldo" aria-hidden="true" />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
