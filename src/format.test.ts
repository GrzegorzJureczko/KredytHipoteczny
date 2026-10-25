import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  formatMoneyDraft,
  formatMoneyOrDash,
  pluralize,
  sanitizeMoneyInput,
} from './format'

describe('pluralize', () => {
  it.each([
    [1, 'rok'],
    [2, 'lata'],
    [4, 'lata'],
    [5, 'lat'],
    [12, 'lat'],
    [14, 'lat'],
    [22, 'lata'],
    [25, 'lat'],
  ])('uses the correct Polish form for %i', (count, expected) => {
    expect(pluralize(count, 'rok', 'lata', 'lat')).toBe(expected)
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0 mies.'],
    [5, '5 mies.'],
    [12, '1 rok'],
    [14, '1 rok 2 mies.'],
    [60, '5 lat'],
    [26, '2 lata 2 mies.'],
  ])('formats %i months', (months, expected) => {
    expect(formatDuration(months)).toBe(expected)
  })
})

describe('money input helpers', () => {
  it.each([
    ['', ''],
    ['0007', '7'],
    ['1 234,567', '1234.56'],
    [',5', '0.5'],
    ['12abc3', '123'],
    ['1.2.3', '1.23'],
  ])('sanitizes %j to %j', (raw, expected) => {
    expect(sanitizeMoneyInput(raw)).toBe(expected)
  })

  it('groups thousands with a non-breaking space and a decimal comma', () => {
    expect(formatMoneyDraft('1234567.5')).toBe('1\u00a0234\u00a0567,5')
    expect(formatMoneyDraft('999')).toBe('999')
  })

  it('shows a dash instead of zero', () => {
    expect(formatMoneyOrDash(0)).toBe('\u2013')
    expect(formatMoneyOrDash(10)).not.toBe('\u2013')
  })
})
