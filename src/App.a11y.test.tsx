/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

const findViolations = async () => {
  // jsdom cannot compute colors or layout, so those checks are left to real browsers.
  const results = await axe.run(document.body, {
    rules: { 'color-contrast': { enabled: false } },
  })

  return results.violations.map((violation) => {
    const targets = violation.nodes.slice(0, 5).map((node) => node.target.join(' '))
    const more = violation.nodes.length > 5 ? ` (+${violation.nodes.length - 5} more)` : ''

    return `${violation.id}: ${targets.join(' | ')}${more}`
  })
}

const openAllSections = () => {
  document.querySelectorAll('details').forEach((section) => {
    section.open = true
  })
}

// A short term keeps the schedule small, so axe finishes quickly in jsdom.
const renderWithShortLoan = () => {
  render(<App />)

  const termInput = Array.from(document.querySelectorAll('label'))
    .find((label) => label.textContent?.includes('Okres kredytowania'))
    ?.querySelector('input') as HTMLInputElement
  fireEvent.change(termInput, { target: { value: '2' } })

  openAllSections()
}

describe('accessibility', () => {
  afterEach(cleanup)

  it('has no detectable violations in the default view', async () => {
    renderWithShortLoan()

    expect(await findViolations()).toEqual([])
  }, 30_000)

  it('has no detectable violations with rate changes and overpayments added', async () => {
    renderWithShortLoan()

    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj zmianę' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj nadpłatę regularną' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj nadpłatę jednorazową' }))

    expect(await findViolations()).toEqual([])
  }, 30_000)

  it('exposes the repayment schedule as a table with column headers', () => {
    render(<App />)

    const table = screen.getByRole('table', { name: 'Harmonogram spłat' })
    const headers = Array.from(table.querySelectorAll('thead th')).map((cell) => cell.textContent)

    expect(headers).toEqual([
      'Miesiąc',
      'Oprocentowanie',
      'Rata',
      'Kapitał',
      'Odsetki',
      'Nadpłata',
      'Koszty dodatkowe',
      'Saldo',
    ])
  })

  it('names every form control', () => {
    render(<App />)
    openAllSections()

    const unnamed = Array.from(document.querySelectorAll('input, select, textarea')).filter(
      (control) =>
        !(control as HTMLInputElement).labels?.length &&
        !control.getAttribute('aria-label') &&
        !control.getAttribute('aria-labelledby'),
    )

    expect(unnamed.map((control) => control.outerHTML)).toEqual([])
  })
})
