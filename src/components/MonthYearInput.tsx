import { getMonthYearParts } from '../loanForm'
import { capitalize, monthNames } from '../format'

export const MonthYearInput = ({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) => {
  const { year, month } = getMonthYearParts(value)
  const currentYear = new Date().getFullYear()
  const firstYear = Math.min(currentYear - 20, year)
  const lastYear = Math.max(currentYear + 40, year)
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index)

  const updateDate = (nextYear: number, nextMonth: number) => {
    onChange(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`)
  }

  return (
    <div className="month-year-picker">
      <select
        aria-label="Miesiąc"
        value={month}
        onChange={(event) => updateDate(year, Number(event.target.value))}
      >
        {monthNames.map((monthName, index) => (
          <option key={monthName} value={index + 1}>
            {capitalize(monthName)}
          </option>
        ))}
      </select>
      <select
        aria-label="Rok"
        value={year}
        onChange={(event) => updateDate(Number(event.target.value), month)}
      >
        {years.map((yearOption) => (
          <option key={yearOption} value={yearOption}>
            {yearOption}
          </option>
        ))}
      </select>
    </div>
  )
}
