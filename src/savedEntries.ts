import type { SavedCalculationPayload } from './savedCalculations'

export type SavedCalculationEntry = {
  id: string
  name: string
  payload: SavedCalculationPayload
  created_at?: string
  updated_at?: string
}

const formatSavedDate = (value: string) =>
  new Date(value).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export const getSavedDateLabel = (entry: SavedCalculationEntry) => {
  if (entry.updated_at) {
    return `Ostatni zapis: ${formatSavedDate(entry.updated_at)}`
  }

  return entry.created_at ? `Utworzono: ${formatSavedDate(entry.created_at)}` : 'Utworzono: dziś'
}

export const getSavedActivityStamp = (entry: SavedCalculationEntry) =>
  Date.parse(entry.updated_at ?? entry.created_at ?? '') || 0
