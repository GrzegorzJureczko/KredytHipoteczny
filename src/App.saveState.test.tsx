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
