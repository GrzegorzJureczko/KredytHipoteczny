/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

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

const { mockSupabase } = vi.hoisted(() => ({
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

  mockSupabase.from.mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [savedRecord], error: null }),
      }),
    }),
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [savedRecord], error: null }),
    }),
    order: vi.fn().mockResolvedValue({ data: [savedRecord], error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'new-save-id' }, error: null }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }))
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

  it('is greyed out right after login and clicking it expands saved calculations', async () => {
    render(<App />)

    await waitFor(() => {
      expect(document.querySelector('.save-disk-button')).not.toBeNull()
    })

    const saveButton = document.querySelector('.save-disk-button') as HTMLButtonElement
    expect(saveButton.getAttribute('aria-disabled')).toBe('true')

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nazwa kalkulacji')).toBeTruthy()
    })
  })

  it('stays inactive after loading a saved calculation and shows its name', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Wczytaj' }).length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Wczytaj' })[0])

    await waitFor(() => {
      const saveButton = document.querySelector('.save-disk-button') as HTMLButtonElement
      expect(saveButton.getAttribute('aria-disabled')).toBe('true')
      expect(saveButton.textContent).toContain('Moja kalkulacja')
    })
  })

  it('becomes active after a field change and overwrites the loaded calculation', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Wczytaj' }).length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Wczytaj' })[0])

    await waitFor(() => {
      expect((document.querySelector('.save-disk-button') as HTMLButtonElement).getAttribute('aria-disabled')).toBe('true')
    })

    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: '400000' } })

    const saveButton = document.querySelector('.save-disk-button') as HTMLButtonElement
    expect(saveButton.getAttribute('aria-disabled')).toBe('false')

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('saved_calculations')
    })
  })

  it('shows the save new calculation action when panel is expanded and saves a new record', async () => {
    render(<App />)

    const saveButton = document.querySelector('.save-disk-button') as HTMLButtonElement
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Zapisz nową kalkulację' })).toBeTruthy()
    })

    const nameInput = screen.getByPlaceholderText('Nazwa kalkulacji') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Nowa kalkulacja' } })

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nową kalkulację' }))

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('saved_calculations')
    })

    expect((screen.getByPlaceholderText('Nazwa kalkulacji') as HTMLInputElement).value).toBe('')
  })

  it('saves a fresh record while a previous saved calculation is loaded', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Wczytaj' }).length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Wczytaj' })[0])

    const saveButton = document.querySelector('.save-disk-button') as HTMLButtonElement
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Zapisz nową kalkulację' })).toBeTruthy()
    })

    const nameInput = screen.getByPlaceholderText('Nazwa kalkulacji') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Kopia kalkulacji' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nową kalkulację' }))

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('saved_calculations')
    })

    expect((screen.getByPlaceholderText('Nazwa kalkulacji') as HTMLInputElement).value).toBe('')
  })

  it('keeps the loaded record name visible while creating a new save draft', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Wczytaj' }).length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Wczytaj' })[0])

    const saveButton = document.querySelector('.save-disk-button') as HTMLButtonElement
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Zapisz nową kalkulację' })).toBeTruthy()
    })

    expect((saveButton).textContent).toContain('Moja kalkulacja')
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

    const calculationTypeSelect = view.getByRole('combobox', { name: 'Sposób naliczania' }) as HTMLSelectElement
    expect(calculationTypeSelect.value).toBe('percentage')

    const rateInput = view.getByLabelText('Stawka ubezpieczenia') as HTMLInputElement
    const sumInput = view.getByLabelText('Suma ubezpieczenia') as HTMLInputElement
    const frequencySelect = view.getByLabelText('Częstotliwość składki') as HTMLSelectElement
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

    const calculationTypeSelect = view.getByRole('combobox', { name: 'Sposób naliczania' })
    fireEvent.change(calculationTypeSelect, { target: { value: 'amount' } })

    expect(view.queryByLabelText('Stawka ubezpieczenia')).toBeNull()
    expect(view.queryByLabelText('Podstawa kalkulacji')).toBeNull()

    const sumInput = view.getByLabelText('Suma ubezpieczenia') as HTMLInputElement
    const frequencySelect = view.getByLabelText('Częstotliwość składki') as HTMLSelectElement

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

    const calculationTypeSelect = view.getByRole('combobox', { name: 'Sposób naliczania' })
    fireEvent.change(calculationTypeSelect, { target: { value: 'amount' } })

    const sumInput = view.getByLabelText('Suma ubezpieczenia') as HTMLInputElement
    const frequencySelect = view.getByLabelText('Częstotliwość składki') as HTMLSelectElement

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
