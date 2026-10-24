/** @vitest-environment jsdom */

import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

configure({ asyncUtilTimeout: 5000 })

const getInputByLabel = (labelText: string) =>
  Array.from(document.querySelectorAll('label'))
    .find((label) => label.textContent?.includes(labelText))
    ?.querySelector('input') as HTMLInputElement

const digitsOf = (input: HTMLInputElement) => input.value.replace(/\s/g, '')

const addRegularOverpayment = (amount: string) => {
  fireEvent.click(screen.getByRole('button', { name: '+ Dodaj nadpłatę regularną' }))

  const rows = document.querySelectorAll('.extra-payment-row.is-recurring')
  const row = rows[rows.length - 1] as HTMLElement
  fireEvent.change(row.querySelector('input') as HTMLInputElement, { target: { value: amount } })

  return row
}

const getSummaryText = () => document.querySelector('.summary-panel')?.textContent ?? ''

const calculationTypeButton = (
  view: ReturnType<typeof within>,
  groupLabel: string,
  type: 'amount' | 'percentage',
) =>
  within(view.getByRole('group', { name: groupLabel })).getByRole('button', {
    name: type === 'amount' ? 'Kwotowo' : 'Procentowo',
  })

const chooseCalculationType = (
  view: ReturnType<typeof within>,
  groupLabel: string,
  type: 'amount' | 'percentage',
) => fireEvent.click(calculationTypeButton(view, groupLabel, type))

const baseSavedPayload = {
  amount: 300000,
  rate: 5.2,
  years: 25,
  repaymentType: 'annuity',
  rateChanges: [],
  extraMonthlyPayment: 500,
  extraMonthlyPaymentStartDate: '2027-10-01',
  extraPaymentMode: 'reduceTerm',
  extraPayments: [],
  applicationFee: 1500,
  insurance: 4200,
  notary: 3500,
  appraisal: 1800,
  commission: 0,
}

const savedRecord = {
  id: 'saved-1',
  name: 'Moja kalkulacja',
  payload: baseSavedPayload,
  created_at: '2026-01-15T12:00:00Z',
}

const { mockSupabase, tableCalls } = vi.hoisted(() => ({
  tableCalls: {
    listResult: vi.fn(),
    update: vi.fn(),
    updateEq: vi.fn(),
    updateResult: vi.fn(),
    insert: vi.fn(),
    deleteEq: vi.fn(),
  },
  mockSupabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}))

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: mockSupabase,
}))

beforeEach(() => {
  vi.clearAllMocks()

  mockSupabase.auth.getSession.mockResolvedValue({
    data: {
      session: {
        user: {
          email: 'test@example.com',
          id: 'user-1',
        },
      },
    },
  })

  mockSupabase.auth.signOut.mockResolvedValue({ error: null })
  tableCalls.listResult.mockResolvedValue({ data: [savedRecord], error: null })
  tableCalls.updateResult.mockResolvedValue({ data: [{ id: 'saved-1' }], error: null })

  mockSupabase.from.mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn(() => tableCalls.listResult()),
      }),
    }),
    update: (payload: unknown) => {
      tableCalls.update(payload)
      const chain = {
        eq: (column: string, value: string) => {
          tableCalls.updateEq(column, value)
          return chain
        },
        select: () => tableCalls.updateResult(),
      }
      return chain
    },
    insert: (rows: unknown) => {
      tableCalls.insert(rows)
      return {
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'new-save-id' }, error: null }),
        }),
      }
    },
    delete: () => ({
      eq: (column: string, value: string) => {
        tableCalls.deleteEq(column, value)
        return {
          eq: (nextColumn: string, nextValue: string) => {
            tableCalls.deleteEq(nextColumn, nextValue)
            return Promise.resolve({ error: null })
          },
        }
      },
    }),
  }))
})

afterEach(() => {
  cleanup()
})

describe('save button behavior', () => {
  it('derives the total interest rate from WIBOR and margin', () => {
    render(<App />)

    const getInputByLabel = (labelText: string) =>
      Array.from(document.querySelectorAll('label')).find((label) =>
        label.textContent?.includes(labelText),
      )?.querySelector('input') as HTMLInputElement

    const wibor = getInputByLabel('WIBOR')
    const margin = getInputByLabel('Marża')
    const total = getInputByLabel('Oprocentowanie')

    fireEvent.change(wibor, { target: { value: '3.2' } })
    fireEvent.change(margin, { target: { value: '2.1' } })

    expect(total.value).toBe('5.3')
    expect(total.readOnly).toBe(true)
  })

  it('converts the life insurance duration when the unit changes', () => {
    const { unmount } = render(<App />)

    const duration = screen.getAllByRole('spinbutton', { name: 'Czas ubezpieczenia' })[0] as HTMLInputElement
    const years = screen.getAllByRole('button', { name: 'Lata' })[0]
    const months = screen.getAllByRole('button', { name: 'Miesiące' })[0]

    expect(duration.value).toBe('24')
    expect(months.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(years)
    expect(duration.value).toBe('2')
    expect(years.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(months)
    expect(duration.value).toBe('24')

    fireEvent.change(duration, { target: { value: '13' } })
    fireEvent.click(years)
    expect(duration.value).toBe('1')

    fireEvent.click(months)
    expect(duration.value).toBe('12')

    unmount()
  })

  it('allows expanding and collapsing additional calculation sections', async () => {
    render(<App />)

    for (const title of ['Koszty około-kredytowe', 'Zmiany oprocentowania', 'Nadpłaty']) {
      const sectionTitle = screen
        .getAllByText(title)
        .find((element) => element.closest('details')) ?? screen.getAllByText(title)[0]
      const section = sectionTitle.closest('details')

      expect(section).not.toBeNull()
      expect((section as HTMLDetailsElement).open).toBe(false)

      fireEvent.click(sectionTitle)
      expect((section as HTMLDetailsElement).open).toBe(true)

      fireEvent.click(sectionTitle)
      expect((section as HTMLDetailsElement).open).toBe(false)
    }
  })

  const getSaveButton = () => document.querySelector('.save-disk-button') as HTMLButtonElement
  const getSaveStatus = () => document.querySelector('.save-status')

  const renderLoggedIn = async () => {
    render(<App />)
    await screen.findByRole('button', { name: /Zapisane kalkulacje/ })
  }

  const openSavedPanel = async () => {
    fireEvent.click(screen.getByRole('button', { name: /Zapisane kalkulacje/ }))
    await screen.findByPlaceholderText('Nazwa kalkulacji')
  }

  const loadFirstSavedCalculation = async () => {
    await openSavedPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Wczytaj' }))
    await waitFor(() => {
      expect(getSaveStatus()?.textContent).toContain('Moja kalkulacja')
    })
  }

  const changeAmount = (value: string) => {
    const amountInput = getInputByLabel('Kwota kredytu')
    fireEvent.change(amountInput, { target: { value } })
    return amountInput
  }

  it('keeps the save button active right after login and clicking it opens the name field', async () => {
    await renderLoggedIn()

    expect(getSaveButton().getAttribute('aria-disabled')).toBe('false')
    expect(getSaveButton().textContent).toContain('Zapisz')
    expect(screen.queryByPlaceholderText('Nazwa kalkulacji')).toBeNull()

    fireEvent.click(getSaveButton())

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nazwa kalkulacji')).toBeTruthy()
    })
  })

  it('stays inactive after loading a saved calculation, shows its name and collapses the list', async () => {
    await renderLoggedIn()
    await loadFirstSavedCalculation()

    expect(getSaveButton().getAttribute('aria-disabled')).toBe('true')
    expect(getSaveStatus()?.textContent).toContain('Zapisano')
    expect(screen.queryByPlaceholderText('Nazwa kalkulacji')).toBeNull()
  })

  it('shows unsaved changes and overwrites only the payload of the loaded calculation', async () => {
    await renderLoggedIn()
    await loadFirstSavedCalculation()

    changeAmount('400000')

    expect(getSaveButton().getAttribute('aria-disabled')).toBe('false')
    expect(getSaveStatus()?.textContent).toContain('Niezapisane zmiany')

    fireEvent.click(getSaveButton())

    await waitFor(() => {
      expect(tableCalls.update).toHaveBeenCalledTimes(1)
    })

    const updatedValues = tableCalls.update.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(updatedValues)).toEqual(['payload'])
    expect((updatedValues.payload as { amount: number }).amount).toBe(400000)
    expect(updatedValues.payload).toHaveProperty('regularOverpayments')
    expect(updatedValues.payload).not.toHaveProperty('extraMonthlyPayment')
    expect(tableCalls.updateEq).toHaveBeenCalledWith('id', 'saved-1')
    expect(tableCalls.updateEq).toHaveBeenCalledWith('user_id', 'user-1')

    await waitFor(() => {
      expect(getSaveStatus()?.textContent).toContain('Zapisano')
      expect(getSaveButton().getAttribute('aria-disabled')).toBe('true')
    })
  })

  it('saves a new record with the typed name and marks it as the open calculation', async () => {
    await renderLoggedIn()
    fireEvent.click(getSaveButton())

    const nameInput = (await screen.findByPlaceholderText('Nazwa kalkulacji')) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Nowa kalkulacja' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nową kalkulację' }))

    await waitFor(() => {
      expect(tableCalls.insert).toHaveBeenCalledTimes(1)
    })

    const [row] = tableCalls.insert.mock.calls[0][0] as Array<{ name: string; user_id: string }>
    expect(row.name).toBe('Nowa kalkulacja')
    expect(row.user_id).toBe('user-1')

    await waitFor(() => {
      expect(nameInput.value).toBe('')
      expect(getSaveStatus()?.textContent).toContain('Nowa kalkulacja')
    })
  })

  it('saves a copy under a new name without touching the loaded record', async () => {
    await renderLoggedIn()
    await loadFirstSavedCalculation()
    await openSavedPanel()

    fireEvent.change(screen.getByPlaceholderText('Nazwa kalkulacji'), {
      target: { value: 'Kopia kalkulacji' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz jako kopię' }))

    await waitFor(() => {
      expect(tableCalls.insert).toHaveBeenCalledTimes(1)
    })

    expect(tableCalls.update).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(getSaveStatus()?.textContent).toContain('Kopia kalkulacji')
    })
  })

  it('asks for confirmation before loading a saved calculation over unsaved changes', async () => {
    await renderLoggedIn()
    await loadFirstSavedCalculation()

    const amountInput = changeAmount('400000')
    await openSavedPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Wczytaj' }))

    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Anuluj' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(digitsOf(amountInput)).toBe('400000')

    fireEvent.click(screen.getByRole('button', { name: 'Wczytaj' }))
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Odrzuć zmiany',
      }),
    )

    await waitFor(() => {
      expect(digitsOf(amountInput)).toBe('300000')
    })
  })

  it('does not ask for confirmation when nothing changed since loading', async () => {
    await renderLoggedIn()
    await loadFirstSavedCalculation()
    await openSavedPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Wczytaj' }))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Nazwa kalkulacji')).toBeNull()
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('confirms before deleting and detaches the calculation when the open record is removed', async () => {
    await renderLoggedIn()
    await loadFirstSavedCalculation()
    await openSavedPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Usuń' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(tableCalls.deleteEq).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Usuń' }))

    await waitFor(() => {
      expect(tableCalls.deleteEq).toHaveBeenCalledWith('id', 'saved-1')
      expect(tableCalls.deleteEq).toHaveBeenCalledWith('user_id', 'user-1')
    })

    await waitFor(() => {
      expect(getSaveStatus()?.textContent).toContain('Niezapisana kalkulacja')
    })
    expect(getSaveStatus()?.textContent).not.toContain('Moja kalkulacja')
    expect(getSaveButton().getAttribute('aria-disabled')).toBe('false')
  })

  it('renames a saved calculation without changing its data', async () => {
    await renderLoggedIn()
    await openSavedPanel()

    fireEvent.click(await screen.findByRole('button', { name: 'Zmień nazwę' }))
    fireEvent.change(screen.getByLabelText('Nowa nazwa zapisu'), {
      target: { value: 'Mieszkanie na Woli' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nazwę' }))

    await waitFor(() => {
      expect(tableCalls.update).toHaveBeenCalledWith({ name: 'Mieszkanie na Woli' })
    })
    expect(tableCalls.updateEq).toHaveBeenCalledWith('id', 'saved-1')
    expect(tableCalls.updateEq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('reports an error and detaches the calculation when the saved record no longer exists', async () => {
    tableCalls.updateResult.mockResolvedValue({ data: [], error: null })

    await renderLoggedIn()
    await loadFirstSavedCalculation()
    changeAmount('400000')
    fireEvent.click(getSaveButton())

    expect(await screen.findByText(/Nie znaleziono zapisu/)).toBeTruthy()
    await waitFor(() => {
      expect(getSaveStatus()?.textContent).toContain('Niezapisana kalkulacja')
    })
    expect(getSaveStatus()?.textContent).not.toContain('Moja kalkulacja')
  })

  it('warns before logging out with unsaved changes', async () => {
    await renderLoggedIn()
    changeAmount('400000')

    fireEvent.click(screen.getByRole('button', { name: 'Wyloguj' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Anuluj' }))
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Wyloguj' }))
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Odrzuć zmiany',
      }),
    )

    await waitFor(() => {
      expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1)
    })
  })

  it('warns before closing the tab only when a logged-in user has unsaved changes', async () => {
    await renderLoggedIn()

    const cleanEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(cleanEvent)
    expect(cleanEvent.defaultPrevented).toBe(false)

    changeAmount('400000')

    const dirtyEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirtyEvent)
    expect(dirtyEvent.defaultPrevented).toBe(true)
  })

  it('shows the key parameters of each saved calculation', async () => {
    await renderLoggedIn()
    await openSavedPanel()

    const item = (await screen.findByRole('button', { name: 'Wczytaj' })).closest('li') as HTMLElement

    expect(item.textContent).toMatch(/300.000,00.zł/)
    expect(item.textContent).toContain('25 lat')
    expect(item.textContent).toContain('5,2%')
    expect(item.textContent).toMatch(/rata\s+\d/)
    expect(item.textContent).toContain('Utworzono:')
  })

  it('uses a stable start date derived from creation time for legacy saved calculations', async () => {
    await renderLoggedIn()
    await loadFirstSavedCalculation()

    const month = screen.getAllByRole('combobox', { name: 'Miesiąc' })[0] as HTMLSelectElement
    const year = screen.getAllByRole('combobox', { name: 'Rok' })[0] as HTMLSelectElement

    // The record was created 2026-01-15, so the legacy schedule starts the next month
    expect(month.value).toBe('2')
    expect(year.value).toBe('2026')
  })

  it('turns a legacy monthly overpayment into a regular overpayment when loading', async () => {
    await renderLoggedIn()
    await loadFirstSavedCalculation()

    // The saved payload has the old single field: 500 zl monthly from 2027-10
    const badge = screen
      .getByText('Nadpłaty', { selector: 'summary' })
      .querySelector('.section-badge')?.textContent
    expect(badge).toBe('1 regularna')

    const row = document.querySelector('.extra-payment-row.is-recurring') as HTMLElement
    expect(digitsOf(row.querySelector('input') as HTMLInputElement)).toBe('500')
    expect((row.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true)
  })

  it('converts legacy rate changes to a WIBOR using the saved margin', async () => {
    tableCalls.listResult.mockResolvedValue({
      data: [
        {
          ...savedRecord,
          payload: {
            ...baseSavedPayload,
            wibor: 3,
            margin: 2,
            rate: 5,
            rateChanges: [{ id: 1, date: '2028-02-01', rate: 4.5 }],
          },
        },
      ],
      error: null,
    })

    await renderLoggedIn()
    await loadFirstSavedCalculation()

    const row = document.querySelector('.row-with-note') as HTMLElement
    expect((row.querySelector('input') as HTMLInputElement).value).toBe('2.5')
    expect(row.textContent).toContain('4,5%')
  })

  it('tells the user when a saved calculation cannot be read', async () => {
    tableCalls.listResult.mockResolvedValue({
      data: [savedRecord, { id: 'broken', name: 'Uszkodzony', payload: {}, created_at: '2026-01-15T12:00:00Z' }],
      error: null,
    })

    await renderLoggedIn()
    await openSavedPanel()

    expect(await screen.findByText(/Nie udało się odczytać zapisów: 1/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Wczytaj' })).toHaveLength(1)
  })
})

describe('form usability', () => {
  const getSectionBadge = (title: string) =>
    screen.getByText(title, { selector: 'summary' }).querySelector('.section-badge')?.textContent

  it('starts without a hidden overpayment so the default term is the full loan term', () => {
    render(<App />)

    expect(getSummaryText()).toContain('30 lat')
    expect(getSectionBadge('Nadpłaty')).toBe('Brak')
    expect(getSectionBadge('Zmiany oprocentowania')).toBe('Brak')
  })

  it('summarizes collapsed sections in their headers', () => {
    render(<App />)

    expect(getSectionBadge('Koszty około-kredytowe')).toMatch(/^Łącznie .*zł$/)

    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj zmianę' }))
    expect(getSectionBadge('Zmiany oprocentowania')).toBe('1 zmiana')

    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj zmianę' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj zmianę' }))
    expect(getSectionBadge('Zmiany oprocentowania')).toBe('3 zmiany')

    addRegularOverpayment('700')
    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj nadpłatę' }))
    expect(getSectionBadge('Nadpłaty')).toBe('1 regularna + 1 jednorazowa')

    addRegularOverpayment('300')
    expect(getSectionBadge('Nadpłaty')).toBe('2 regularne + 1 jednorazowa')
  })

  it('lets the user clear an amount field while typing and falls back to zero on blur', () => {
    render(<App />)

    const amountInput = getInputByLabel('Kwota kredytu')

    fireEvent.change(amountInput, { target: { value: '' } })
    expect(amountInput.value).toBe('')
    expect(screen.getByText('Kwota kredytu musi być większa od zera.')).toBeTruthy()

    fireEvent.change(amountInput, { target: { value: '250000' } })
    expect(digitsOf(amountInput)).toBe('250000')
    expect(screen.queryByText('Kwota kredytu musi być większa od zera.')).toBeNull()

    fireEvent.change(amountInput, { target: { value: '' } })
    fireEvent.blur(amountInput)
    expect(amountInput.value).toBe('0')
  })

  it('groups thousands inside amount fields and accepts a decimal comma', () => {
    render(<App />)

    const amountInput = getInputByLabel('Kwota kredytu')

    fireEvent.change(amountInput, { target: { value: '3500000' } })
    expect(amountInput.value).toBe('3\u00a0500\u00a0000')

    fireEvent.change(amountInput, { target: { value: '1234567,5' } })
    expect(amountInput.value).toBe('1\u00a0234\u00a0567,5')

    fireEvent.change(amountInput, { target: { value: '12ab3' } })
    expect(amountInput.value).toBe('123')
  })

  it('warns when the loan amount exceeds the property value', () => {
    render(<App />)

    fireEvent.change(getInputByLabel('Kwota kredytu'), { target: { value: '500000' } })
    expect(screen.getByText('Kwota kredytu przekracza wartość nieruchomości.')).toBeTruthy()

    fireEvent.change(getInputByLabel('Wartość nieruchomości'), { target: { value: '600000' } })
    expect(screen.queryByText('Kwota kredytu przekracza wartość nieruchomości.')).toBeNull()
  })

  it('labels amount and percentage fields with their units', () => {
    render(<App />)

    const unitsOf = (labelText: string) =>
      Array.from(document.querySelectorAll('label'))
        .find((label) => label.textContent?.includes(labelText))
        ?.querySelector('.input-unit')
        ?.getAttribute('data-unit')

    expect(unitsOf('Kwota kredytu')).toBe('zł')
    expect(unitsOf('WIBOR')).toBe('%')
    expect(unitsOf('Marża')).toBe('%')
    expect(unitsOf('Kwota prowizji')).toBe('zł')
  })
})

describe('loan form details', () => {
  const getRateChangeRows = () => Array.from(document.querySelectorAll('.row-with-note'))

  it('shows LTV and own contribution, flagging high LTV', () => {
    render(<App />)

    // 350 000 / 400 000 = 87,5%
    const ltv = document.querySelector('.loan-ltv') as HTMLElement
    expect(ltv.textContent).toContain('87,5%')
    expect(ltv.textContent).toMatch(/50.000,00.z\u0142/)
    expect(ltv.textContent).toContain('Wysokie LTV')

    fireEvent.change(getInputByLabel('Kwota kredytu'), { target: { value: '200000' } })
    expect(document.querySelector('.loan-ltv')?.textContent).toContain('50%')
    expect(document.querySelector('.loan-ltv')?.textContent).not.toContain('Wysokie LTV')
  })

  it('lets the user type any loan term in years and warns outside 1-40', () => {
    render(<App />)

    const termInput = getInputByLabel('Okres kredytowania')
    fireEvent.change(termInput, { target: { value: '27' } })
    expect(getSummaryText()).toContain('27 lat')

    fireEvent.change(termInput, { target: { value: '45' } })
    expect(screen.getByText('Okres kredytowania powinien mie\u015bci\u0107 si\u0119 w zakresie 1\u201340 lat.')).toBeTruthy()
  })

  it('switches the application fee to a percentage of the loan amount', () => {
    render(<App />)
    const view = within(document.body)
    const group = 'Spos\u00f3b naliczania prowizji'

    expect(calculationTypeButton(view, group, 'amount').getAttribute('aria-pressed')).toBe('true')

    chooseCalculationType(view, group, 'percentage')
    // 1500 / 350000 carried over as a percentage
    expect(getInputByLabel('Stawka prowizji').value).toBe('0.4286')

    fireEvent.change(getInputByLabel('Stawka prowizji'), { target: { value: '1' } })
    // 1% of 350 000 = 3 500
    expect(digitsOf(getInputByLabel('Kwota prowizji')).replace(',', '.')).toBe('3500')

    const firstRowCosts = document.querySelectorAll('.table-wrap tbody tr')[0].querySelectorAll('td')[6]
    // 3500 fee + 3500 notary + 1800 appraisal + 200 life + 200 property
    expect(firstRowCosts.textContent).toMatch(/9.?200,00/)

    chooseCalculationType(view, group, 'amount')
    expect(digitsOf(getInputByLabel('Kwota prowizji'))).toBe('3500')
  })

  it('sorts rate changes by date and explains unusual dates', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj zmian\u0119' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj zmian\u0119' }))

    const [firstRow] = getRateChangeRows()
    const firstYear = firstRow.querySelectorAll('select')[1] as HTMLSelectElement
    // Move the first change far beyond the end of the loan (the year list reaches 40 years ahead)
    fireEvent.change(firstYear, { target: { value: String(Number(firstYear.value) + 39) } })

    const rows = getRateChangeRows()
    expect(rows).toHaveLength(2)
    // The shifted change is now sorted last and flagged
    expect(rows[1].textContent).toContain('po zako\u0144czeniu sp\u0142aty')
    expect(rows[0].textContent).not.toContain('po zako\u0144czeniu sp\u0142aty')
  })

  it('warns about two rate changes in the same month', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj zmian\u0119' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj zmian\u0119' }))

    expect(getRateChangeRows()[0].textContent).toContain('tym samym miesi\u0105cu')
    expect(getRateChangeRows()[1].textContent).toContain('tym samym miesi\u0105cu')
  })

  it('removes a rate change with the icon button', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj zmian\u0119' }))
    expect(getRateChangeRows()).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Usu\u0144 zmian\u0119 oprocentowania' }))
    expect(getRateChangeRows()).toHaveLength(0)
  })

  it('describes the effect of a regular overpayment', () => {
    render(<App />)

    const row = addRegularOverpayment('500')
    expect(row.textContent).toContain('nadpłata skraca okres spłaty')

    fireEvent.change(row.querySelector('select') as HTMLSelectElement, {
      target: { value: 'reduceInstallment' },
    })

    expect(row.textContent).toContain('Rata jest przeliczana po każdej nadpłacie')
  })

  it('adds several regular overpayments with their own start and end', () => {
    render(<App />)

    const first = addRegularOverpayment('500')
    const second = addRegularOverpayment('200')

    expect(document.querySelectorAll('.extra-payment-row.is-recurring')).toHaveLength(2)
    expect(first).not.toBe(second)

    // Both run to the end of the loan by default
    const endCheckbox = second.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(endCheckbox.checked).toBe(true)
    expect(second.querySelectorAll('select')).toHaveLength(3)

    fireEvent.click(endCheckbox)
    expect(endCheckbox.checked).toBe(false)
    // Effect select + start month/year + end month/year
    expect(second.querySelectorAll('select')).toHaveLength(5)
  })

  it('stops a regular overpayment after its end month', () => {
    render(<App />)

    const row = addRegularOverpayment('1000')
    fireEvent.click(row.querySelector('input[type="checkbox"]') as HTMLInputElement)

    const scheduleRows = Array.from(document.querySelectorAll('.table-wrap tbody tr'))
    const overpaidRows = scheduleRows.filter(
      (scheduleRow) => !/^0,00/.test(scheduleRow.querySelectorAll('td')[5].textContent ?? ''),
    )

    // Default end is 24 months after the start, so 1000 zl is paid for 25 months at most
    expect(overpaidRows.length).toBeGreaterThan(0)
    expect(overpaidRows.length).toBeLessThanOrEqual(25)
  })

  it('warns when a regular overpayment ends before it starts', () => {
    render(<App />)

    const row = addRegularOverpayment('500')
    fireEvent.click(row.querySelector('input[type="checkbox"]') as HTMLInputElement)

    const selects = row.querySelectorAll('select')
    // selects: effect, start month, start year, end month, end year
    const startYear = Number((selects[2] as HTMLSelectElement).value)
    fireEvent.change(selects[4], { target: { value: String(startYear - 1) } })

    expect(row.parentElement?.textContent).toContain('Koniec jest przed początkiem')
  })

  it('removes a regular overpayment with the icon button', () => {
    render(<App />)

    addRegularOverpayment('500')
    expect(document.querySelectorAll('.extra-payment-row.is-recurring')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Usuń nadpłatę regularną' }))
    expect(document.querySelectorAll('.extra-payment-row.is-recurring')).toHaveLength(0)
  })

  it('enters rate changes as a new WIBOR and shows the resulting rate', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj zmianę' }))
    const row = getRateChangeRows()[0] as HTMLElement
    const wiborInput = row.querySelector('input') as HTMLInputElement

    // Starts from the current WIBOR (2,7%) with margin 2,5%
    expect(wiborInput.value).toBe('2.7')
    expect(row.textContent).toContain('5,2%')

    fireEvent.change(wiborInput, { target: { value: '3.2' } })
    expect(row.textContent).toContain('5,7%')

    fireEvent.change(getInputByLabel('Marża'), { target: { value: '2' } })
    expect(row.textContent).toContain('5,2%')
  })

  it('opens a field tooltip on tap and closes it when tapping elsewhere', () => {
    render(<App />)

    const trigger = document.querySelector('.field-tooltip-trigger') as HTMLElement
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)
    expect(trigger.classList.contains('is-open')).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.pointerDown(document.body)
    expect(trigger.classList.contains('is-open')).toBe(false)
  })
})

describe('summary panel', () => {
  const setStartDate = (year: string, month: string) => {
    fireEvent.change(screen.getAllByRole('combobox', { name: 'Rok' })[0], { target: { value: year } })
    fireEvent.change(screen.getAllByRole('combobox', { name: 'Miesiąc' })[0], {
      target: { value: month },
    })
  }

  it('shows the repayment period together with the month of the last payment', () => {
    render(<App />)
    setStartDate('2030', '1')

    const text = getSummaryText()
    expect(text).toContain('30 lat')
    expect(text).toContain('do: grudzień 2059')
  })

  it('splits the total cost into principal, interest and additional costs that add up', () => {
    render(<App />)

    const legendRows = Array.from(document.querySelectorAll('.cost-legend li'))
    expect(legendRows.map((row) => row.querySelector('span:nth-of-type(2)')?.textContent)).toEqual([
      'Kapitał',
      'Odsetki',
      'Koszty dodatkowe',
    ])
    expect(document.querySelectorAll('.cost-bar-segment')).toHaveLength(3)

    const parseAmount = (text: string | null | undefined) =>
      Number((text ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
    const [principal, interest, additional] = legendRows.map((row) =>
      parseAmount(row.querySelector('strong')?.textContent),
    )
    const total = parseAmount(document.querySelector('.cost-breakdown-header strong')?.textContent)

    // Default loan: 350 000 zł fully repaid
    expect(Math.abs(principal - 350000)).toBeLessThan(0.02)
    expect(Math.abs(principal + interest + additional - total)).toBeLessThan(0.02)
  })

  it('hides the overpayment effect without overpayments and shows interest saved with them', () => {
    render(<App />)

    expect(document.querySelector('.savings-box')).toBeNull()

    addRegularOverpayment('1000')

    const savings = document.querySelector('.savings-box')
    expect(savings?.textContent).toContain('Mniej odsetek')
    expect(savings?.textContent).toContain('Krótszy okres')
  })

  it('does not claim a shorter period when a one-off overpayment only lowers the installment', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj nadpłatę' }))

    const row = document.querySelector('.extra-payment-row') as HTMLElement
    fireEvent.change(row.querySelector('input') as HTMLInputElement, { target: { value: '100000' } })
    const effectSelects = row.querySelectorAll('select')
    fireEvent.change(effectSelects[effectSelects.length - 1], {
      target: { value: 'reduceInstallment' },
    })

    const savings = document.querySelector('.savings-box')
    expect(savings?.textContent).toContain('Mniej odsetek')
    expect(savings?.textContent).not.toContain('Krótszy okres')
  })

  it('counts additional costs only while the loan runs, matching the schedule rows', () => {
    render(<App />)

    addRegularOverpayment('3000')

    const rows = Array.from(document.querySelectorAll('.table-wrap tbody tr'))
    expect(rows.length).toBeLessThan(360)

    const parseAmount = (text: string | null | undefined) =>
      Number((text ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
    const scheduleCosts = rows.reduce(
      (sum, row) => sum + parseAmount(row.querySelectorAll('td')[6].textContent),
      0,
    )
    const summaryCosts = parseAmount(
      document.querySelectorAll('.cost-legend li')[2].querySelector('strong')?.textContent,
    )

    expect(Math.abs(summaryCosts - scheduleCosts)).toBeLessThan(rows.length * 0.01)
  })

  it('labels the first installment and shows the last one for decreasing installments', () => {
    render(<App />)

    expect(getSummaryText()).toContain('Rata miesięczna')
    expect(getSummaryText()).not.toContain('Ostatnia rata')

    const repaymentSelect = screen.getByDisplayValue('Raty równe (annuitetowe)')
    fireEvent.change(repaymentSelect, { target: { value: 'decreasing' } })

    expect(getSummaryText()).toContain('Pierwsza rata')
    expect(getSummaryText()).toContain('Ostatnia rata')
  })
})

describe('registration flow', () => {
  it('allows selecting the month and year independently', async () => {
    render(<App />)

    const month = screen.getAllByRole('combobox', { name: 'Miesiąc' })[0]
    const year = screen.getAllByRole('combobox', { name: 'Rok' })[0]
    const nextYear = String(new Date().getFullYear() + 5)

    fireEvent.change(year, { target: { value: nextYear } })
    fireEvent.change(month, { target: { value: '11' } })

    expect((year as HTMLSelectElement).value).toBe(nextYear)
    expect((month as HTMLSelectElement).value).toBe('11')
  })

  it('updates the first schedule payment date when credit start date changes', async () => {
    render(<App />)

    const monthSelects = screen.getAllByRole('combobox', { name: 'Miesiąc' })
    const yearSelects = screen.getAllByRole('combobox', { name: 'Rok' })

    // The first month/year pair is "Data startu kredytu" in Dane podstawowe
    fireEvent.change(yearSelects[0], { target: { value: '2025' } })
    fireEvent.change(monthSelects[0], { target: { value: '6' } })

    const firstYearGroup = document.querySelector('.year-group')
    expect(firstYearGroup?.textContent).toContain('czerwiec 2025')
  })

  it('does not show a user as logged in until email confirmation creates a session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: { email: 'new@example.com' }, session: null },
      error: null,
    })

    const { container } = render(<App />)
    const registration = within(container)

    fireEvent.click(registration.getByRole('button', { name: 'Rejestracja' }))
    fireEvent.change(registration.getByPlaceholderText('twoj@email.pl'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.change(registration.getByPlaceholderText('Minimum 6 znaków'), {
      target: { value: 'password123' },
    })
    fireEvent.change(registration.getByPlaceholderText('Potwierdź hasło'), {
      target: { value: 'password123' },
    })
    fireEvent.click(registration.getByRole('button', { name: 'Utwórz konto' }))

    expect(
      await registration.findByText(
        'Konto zostało utworzone. Potwierdź adres e-mail, a następnie zaloguj się.',
      ),
    ).toBeTruthy()
    expect(registration.queryByRole('button', { name: 'Wyloguj' })).toBeNull()
    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
  })
})

describe('property insurance calculation modes', () => {
  it('renders percentage mode by default with rate, readonly sum, frequency, and basis', () => {
    const { container, unmount } = render(<App />)
    const view = within(container)

    expect(calculationTypeButton(view, 'Sposób naliczania ubezpieczenia nieruchomości', 'percentage').getAttribute('aria-pressed')).toBe('true')

    const rateInput = view.getByLabelText('Stawka ubezpieczenia nieruchomości') as HTMLInputElement
    const sumInput = view.getByLabelText('Składka ubezpieczenia nieruchomości') as HTMLInputElement
    const frequencySelect = view.getByLabelText(
      'Częstotliwość składki ubezpieczenia nieruchomości',
    ) as HTMLSelectElement
    const basisSelect = view.getByLabelText('Podstawa kalkulacji') as HTMLSelectElement

    expect(rateInput).toBeTruthy()
    expect(sumInput).toBeTruthy()
    expect(sumInput.readOnly).toBe(true)
    // 400 000 * 0.05% = 200
    expect(sumInput.value).toBe('200')
    expect(frequencySelect).toBeTruthy()
    expect(basisSelect).toBeTruthy()

    // Changing the percentage rate updates the calculated sum
    fireEvent.change(rateInput, { target: { value: '0.1' } })
    expect(sumInput.value).toBe('400')

    unmount()
  })

  it('switches to amount mode, hides rate and basis, and allows entering sum directly', () => {
    const { container, unmount } = render(<App />)
    const view = within(container)

    chooseCalculationType(view, 'Sposób naliczania ubezpieczenia nieruchomości', 'amount')

    expect(view.queryByLabelText('Stawka ubezpieczenia nieruchomości')).toBeNull()
    expect(view.queryByLabelText('Podstawa kalkulacji')).toBeNull()

    const sumInput = view.getByLabelText('Składka ubezpieczenia nieruchomości') as HTMLInputElement
    const frequencySelect = view.getByLabelText(
      'Częstotliwość składki ubezpieczenia nieruchomości',
    ) as HTMLSelectElement

    expect(sumInput).toBeTruthy()
    expect(sumInput.readOnly).toBe(false)
    expect(frequencySelect).toBeTruthy()

    // User can edit the sum in amount mode
    fireEvent.change(sumInput, { target: { value: '350' } })
    expect(sumInput.value).toBe('350')

    unmount()
  })

  it('divides annual insurance amount by 12 in monthly schedule rows', () => {
    const { container, unmount } = render(<App />)
    const view = within(container)

    chooseCalculationType(view, 'Sposób naliczania ubezpieczenia nieruchomości', 'amount')

    const sumInput = view.getByLabelText('Składka ubezpieczenia nieruchomości') as HTMLInputElement
    const frequencySelect = view.getByLabelText(
      'Częstotliwość składki ubezpieczenia nieruchomości',
    ) as HTMLSelectElement

    fireEvent.change(sumInput, { target: { value: '1200' } })
    fireEvent.change(frequencySelect, { target: { value: 'annual' } })

    // Month 2 additional costs: life insurance 200 + property insurance (1200 / 12 = 100) = 300 zł
    const rows = container.querySelectorAll('.table-wrap tbody tr')
    expect(rows.length).toBeGreaterThan(1)
    // In row 2 (index 1), Koszty dodatkowe column (index 6) should show 300,00 zł
    const cells = rows[1].querySelectorAll('td')
    expect(cells[6].textContent).toContain('300,00')

    unmount()
  })
})

describe('life insurance calculation modes', () => {
  it('renders amount mode by default with premium input, duration, and units', () => {
    const { container, unmount } = render(<App />)
    const view = within(container)

    expect(calculationTypeButton(view, 'Sposób naliczania ubezpieczenia na życie', 'amount').getAttribute('aria-pressed')).toBe('true')

    const premiumInput = view.getByLabelText(
      'Składka miesięczna ubezpieczenia na życie',
    ) as HTMLInputElement
    const durationInput = view.getByLabelText('Czas ubezpieczenia') as HTMLInputElement
    const yearsButton = view.getByRole('button', { name: 'Lata' })
    const monthsButton = view.getByRole('button', { name: 'Miesiące' })

    expect(premiumInput).toBeTruthy()
    expect(premiumInput.readOnly).toBe(false)
    expect(premiumInput.value).toBe('200')
    expect(durationInput.value).toBe('24')
    expect(monthsButton.getAttribute('aria-pressed')).toBe('true')
    expect(yearsButton.getAttribute('aria-pressed')).toBe('false')

    expect(view.queryByLabelText('Stawka ubezpieczenia na życie')).toBeNull()

    unmount()
  })

  it('switches to percentage mode, calculates premium from loan amount, keeps duration and units', () => {
    const { container, unmount } = render(<App />)
    const view = within(container)

    chooseCalculationType(view, 'Sposób naliczania ubezpieczenia na życie', 'percentage')

    const rateInput = view.getByLabelText('Stawka ubezpieczenia na życie') as HTMLInputElement
    const premiumInput = view.getByLabelText(
      'Składka miesięczna ubezpieczenia na życie',
    ) as HTMLInputElement
    const durationInput = view.getByLabelText('Czas ubezpieczenia') as HTMLInputElement
    const monthsButton = view.getByRole('button', { name: 'Miesiące' })

    expect(rateInput).toBeTruthy()
    expect(rateInput.value).toBe('0.05')
    expect(premiumInput.readOnly).toBe(true)
    // 350 000 * 0.05% = 175
    expect(premiumInput.value).toBe('175')
    expect(durationInput.value).toBe('24')
    expect(monthsButton.getAttribute('aria-pressed')).toBe('true')

    // Changing rate updates monthly premium: 350 000 * 0.1% = 350
    fireEvent.change(rateInput, { target: { value: '0.1' } })
    expect(premiumInput.value).toBe('350')

    unmount()
  })

  it('reduces life insurance monthly cost in schedule as loan balance decreases in percentage mode', () => {
    const { container, unmount } = render(<App />)
    const view = within(container)

    // Set life insurance to percentage mode
    chooseCalculationType(view, 'Sposób naliczania ubezpieczenia na życie', 'percentage')

    // Set property insurance to amount mode with 0 to isolate life insurance in additional costs
    chooseCalculationType(view, 'Sposób naliczania ubezpieczenia nieruchomości', 'amount')
    const propertySumInput = view.getByLabelText('Składka ubezpieczenia nieruchomości') as HTMLInputElement
    fireEvent.change(propertySumInput, { target: { value: '0' } })

    const rows = container.querySelectorAll('.table-wrap tbody tr')
    expect(rows.length).toBeGreaterThan(12)

    // Row 2 (month 2, index 1) vs Row 12 (month 12, index 11)
    // Month 1 has upfront fees, so compare months 2 and 12
    const cellMonth2Costs = rows[1].querySelectorAll('td')[6].textContent || ''
    const cellMonth12Costs = rows[11].querySelectorAll('td')[6].textContent || ''

    const parsePln = (txt: string) =>
      Number(txt.replace(/\s|zł/g, '').replace(',', '.'))

    const costMonth2 = parsePln(cellMonth2Costs)
    const costMonth12 = parsePln(cellMonth12Costs)

    // As principal is repaid, balance decreases, so month 12 insurance cost should be strictly lower than month 2
    expect(costMonth12).toBeLessThan(costMonth2)

    unmount()
  })
})
