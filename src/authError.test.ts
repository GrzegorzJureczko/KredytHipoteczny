import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage } from './authError'

describe('getAuthErrorMessage', () => {
  it('describes registration email rate limits as registration limits', () => {
    expect(getAuthErrorMessage('Email rate limit exceeded', 'register')).toBe(
      'Limit rejestracji lub wysyłki wiadomości e-mail został osiągnięty. Poczekaj kilka minut i spróbuj ponownie. Jeśli konto zostało już utworzone, potwierdź e-mail i zaloguj się.',
    )
  })

  it('describes password-reset email rate limits as reset limits', () => {
    expect(getAuthErrorMessage('Email rate limit exceeded', 'reset')).toBe(
      'Za dużo prób wysłania linku resetującego. Poczekaj kilka minut i spróbuj ponownie.',
    )
  })

  it('recognizes the Supabase email send rate-limit code', () => {
    expect(getAuthErrorMessage('over_email_send_rate_limit', 'register')).toContain(
      'Limit rejestracji',
    )
  })

  it('returns a friendly message for invalid credentials', () => {
    expect(getAuthErrorMessage({ message: 'Invalid login credentials' })).toBe(
      'Nieprawidłowy e-mail lub hasło.',
    )
  })

  it('keeps the original message for other errors', () => {
    expect(getAuthErrorMessage({ message: 'User already registered' })).toBe('User already registered')
  })
})
