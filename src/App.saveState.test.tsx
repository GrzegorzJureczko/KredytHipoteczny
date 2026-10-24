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

    expect(screen.getByText('360 mies.')).toBeTruthy()
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

    fireEvent.change(
      screen.getByText('Regularna wpłata miesięczna').closest('label')!.querySelector('input')!,
      { target: { value: '700' } },
    )
    fireEvent.click(screen.getByRole('button', { name: '+ Dodaj nadpłatę' }))
    expect(getSectionBadge('Nadpłaty')).toMatch(/^700,00.zł\/mies\. \+ 1 jednorazowa$/)
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
    expect(unitsOf('Prowizja')).toBe('zł')
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

    const calculationTypeSelect = view.getByRole('combobox', {
      name: 'Sposób naliczania ubezpieczenia nieruchomości',
    }) as HTMLSelectElement
    expect(calculationTypeSelect.value).toBe('percentage')

    const rateInput = view.getByLabelText('Stawka ubezpieczenia nieruchomości') as HTMLInputElement
    const sumInput = view.getByLabelText('Suma ubezpieczenia nieruchomości') as HTMLInputElement
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

    const calculationTypeSelect = view.getByRole('combobox', {
      name: 'Sposób naliczania ubezpieczenia nieruchomości',
    })
    fireEvent.change(calculationTypeSelect, { target: { value: 'amount' } })

    expect(view.queryByLabelText('Stawka ubezpieczenia nieruchomości')).toBeNull()
    expect(view.queryByLabelText('Podstawa kalkulacji')).toBeNull()

    const sumInput = view.getByLabelText('Suma ubezpieczenia nieruchomości') as HTMLInputElement
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

    const calculationTypeSelect = view.getByRole('combobox', {
      name: 'Sposób naliczania ubezpieczenia nieruchomości',
    })
    fireEvent.change(calculationTypeSelect, { target: { value: 'amount' } })

    const sumInput = view.getByLabelText('Suma ubezpieczenia nieruchomości') as HTMLInputElement
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

    const calculationTypeSelect = view.getByRole('combobox', {
      name: 'Sposób naliczania ubezpieczenia na życie',
    }) as HTMLSelectElement
    expect(calculationTypeSelect.value).toBe('amount')

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

    const calculationTypeSelect = view.getByRole('combobox', {
      name: 'Sposób naliczania ubezpieczenia na życie',
    })
    fireEvent.change(calculationTypeSelect, { target: { value: 'percentage' } })

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
    const calculationTypeSelect = view.getByRole('combobox', {
      name: 'Sposób naliczania ubezpieczenia na życie',
    })
    fireEvent.change(calculationTypeSelect, { target: { value: 'percentage' } })

    // Set property insurance to amount mode with 0 to isolate life insurance in additional costs
    const propertyCalcSelect = view.getByRole('combobox', {
      name: 'Sposób naliczania ubezpieczenia nieruchomości',
    })
    fireEvent.change(propertyCalcSelect, { target: { value: 'amount' } })
    const propertySumInput = view.getByLabelText('Suma ubezpieczenia nieruchomości') as HTMLInputElement
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
