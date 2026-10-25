import { capitalize } from './format'
import type { ScheduleTotals, ScheduleYearSection } from './scheduleView'

const SEPARATOR = ';'
const LINE_BREAK = '\r\n'

export const SCHEDULE_CSV_HEADERS = [
  'Miesiąc',
  'Oprocentowanie (%)',
  'Rata',
  'Kapitał',
  'Odsetki',
  'Nadpłata',
  'Koszty dodatkowe',
  'Saldo',
  'Uwagi',
]

// Polish spreadsheets expect a decimal comma, so amounts are plain numbers without currency or grouping.
const formatAmount = (value: number) => value.toFixed(2).replace('.', ',')

const escapeField = (value: string) =>
  /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

export const buildScheduleCsv = (sections: ScheduleYearSection[], totals: ScheduleTotals) => {
  const dataRows = sections.flatMap((section) =>
    section.rows.map((row) => [
      capitalize(row.monthLabel),
      String(row.annualRate).replace('.', ','),
      formatAmount(row.payment),
      formatAmount(row.principal),
      formatAmount(row.interest),
      formatAmount(row.extraPayment),
      formatAmount(row.additionalCosts),
      formatAmount(row.remainingBalance),
      row.events.map((event) => event.label).join(', '),
    ]),
  )

  const totalsRow = [
    'Razem',
    '',
    formatAmount(totals.payment),
    formatAmount(totals.principal),
    formatAmount(totals.interest),
    formatAmount(totals.extraPayment),
    formatAmount(totals.additionalCosts),
    '',
    '',
  ]

  return [SCHEDULE_CSV_HEADERS, ...dataRows, totalsRow]
    .map((fields) => fields.map(escapeField).join(SEPARATOR))
    .join(LINE_BREAK)
    .concat(LINE_BREAK)
}

export const downloadCsv = (filename: string, content: string) => {
  // The byte order mark makes Excel read the file as UTF-8, so Polish letters survive.
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
