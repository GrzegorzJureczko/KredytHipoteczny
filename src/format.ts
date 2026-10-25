export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)

export const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(value)}%`

export const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

export const formatMoneyOrDash = (value: number) => (value === 0 ? '\u2013' : formatCurrency(value))

export const monthNames = [
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

const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')

export const formatMoneyDraft = (draft: string) => {
  const [integerPart, decimalPart] = draft.split('.')
  const grouped = groupDigits(integerPart)

  return decimalPart === undefined ? grouped : `${grouped},${decimalPart}`
}

export const sanitizeMoneyInput = (raw: string) => {
  const cleaned = raw.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const [integerPart, ...decimalParts] = cleaned.split('.')
  const integerDigits = integerPart.replace(/^0+(?=\d)/, '')

  if (decimalParts.length === 0) {
    return integerDigits
  }

  return `${integerDigits || '0'}.${decimalParts.join('').slice(0, 2)}`
}

export const pluralize = (count: number, one: string, few: string, many: string) => {
  const lastTwo = count % 100
  const last = count % 10

  if (count === 1) {
    return one
  }

  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? few : many
}

export const formatDuration = (months: number) => {
  const years = Math.floor(months / 12)
  const restMonths = months % 12
  const parts: string[] = []

  if (years > 0) {
    parts.push(`${years} ${pluralize(years, 'rok', 'lata', 'lat')}`)
  }

  if (restMonths > 0 || years === 0) {
    parts.push(`${restMonths} mies.`)
  }

  return parts.join(' ')
}
