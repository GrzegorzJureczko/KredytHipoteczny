/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

type Listener = (event: string, session: unknown) => void

const { mockSupabase, redirectState, authListener } = vi.hoisted(() => ({
  redirectState: {
    value: null as null | { kind: 'recovery' } | { kind: 'error'; code: string | null },
  },
  authListener: { current: null as Listener | null },
  mockSupabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}))

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: mockSupabase,
}))

vi.mock('./authRedirect', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./authRedirect')>()),
  get initialAuthRedirect() {
    return redirectState.value
  },
}))

const session = { user: { email: 'test@example.com', id: 'user-1' } }

const heading = () => screen.queryByRole('heading', { name: 'Ustaw nowe hasło' })

const fillAndSubmit = (password: string, confirmation: string) => {
  fireEvent.change(screen.getByLabelText('Nowe hasło'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Powtórz nowe hasło'), { target: { value: confirmation } })
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz nowe hasło' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  redirectState.value = null
  authListener.current = null

  mockSupabase.auth.getSession.mockResolvedValue({ data: { session } })
  mockSupabase.auth.onAuthStateChange.mockImplementation((listener: Listener) => {
    authListener.current = listener
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  mockSupabase.auth.updateUser.mockResolvedValue({ error: null })
  mockSupabase.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    }),
  }))
})

afterEach(() => {
  cleanup()
})

describe('password recovery', () => {
  it('shows the new password form when Supabase reports a recovery session', async () => {
    render(<App />)
    await waitFor(() => expect(authListener.current).not.toBeNull())
    expect(heading()).toBeNull()

    await act(async () => {
      authListener.current?.('PASSWORD_RECOVERY', session)
    })

    expect(heading()).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Wyloguj' })).toBeNull()
  })

  it('shows the form right away when the page was opened from a recovery link', () => {
    redirectState.value = { kind: 'recovery' }
    render(<App />)

    expect(heading()).not.toBeNull()
  })

  it('explains an expired link instead of leaving the user on a blank error', () => {
    redirectState.value = { kind: 'error', code: 'otp_expired' }
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    render(<App />)

    expect(screen.getByText(/wygasł lub został już użyty/)).not.toBeNull()
    expect(heading()).toBeNull()
  })

  it('saves the new password and returns to the signed-in view', async () => {
    redirectState.value = { kind: 'recovery' }
    render(<App />)

    fillAndSubmit('nowehaslo1', 'nowehaslo1')

    await waitFor(() =>
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'nowehaslo1' }),
    )
    expect(await screen.findByText('Hasło zostało zmienione.')).not.toBeNull()
    expect(heading()).toBeNull()
    expect(await screen.findByRole('button', { name: 'Wyloguj' })).not.toBeNull()
  })

  it('rejects a password that is too short or does not match the confirmation', async () => {
    redirectState.value = { kind: 'recovery' }
    render(<App />)

    fillAndSubmit('abc', 'abc')
    expect(await screen.findByText('Hasło musi mieć co najmniej 6 znaków.')).not.toBeNull()

    fillAndSubmit('nowehaslo1', 'innehaslo2')
    expect(await screen.findByText('Hasła nie są zgodne.')).not.toBeNull()

    expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled()
    expect(heading()).not.toBeNull()
  })

  it('keeps the form open and shows the error when Supabase rejects the new password', async () => {
    redirectState.value = { kind: 'recovery' }
    mockSupabase.auth.updateUser.mockResolvedValue({
      error: { message: 'New password should be different from the old password.' },
    })
    render(<App />)

    fillAndSubmit('nowehaslo1', 'nowehaslo1')

    expect(
      await screen.findByText('New password should be different from the old password.'),
    ).not.toBeNull()
    expect(heading()).not.toBeNull()
  })
})
