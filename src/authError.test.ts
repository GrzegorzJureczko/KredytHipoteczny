import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage } from './authError'

describe('getAuthErrorMessage', () => {
  it('returns a friendly message for rate-limit errors', () => {
    expect(getAuthErrorMessage('Email rate limit exceeded')).toBe(
      'Za dużo prób wysłania linku resetującego. Poczekaj kilka minut i spróbuj ponownie.',
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
