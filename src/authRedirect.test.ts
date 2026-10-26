import { describe, expect, it } from 'vitest'
import { getAuthRedirectErrorMessage, parseAuthRedirect } from './authRedirect'

describe('parseAuthRedirect', () => {
  it('recognizes the error Supabase appends for an expired link', () => {
    const hash =
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb='

    expect(parseAuthRedirect(hash)).toEqual({ kind: 'error', code: 'otp_expired' })
  })

  it('recognizes a password recovery redirect', () => {
    expect(
      parseAuthRedirect('#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery'),
    ).toEqual({ kind: 'recovery' })
  })

  it('ignores a regular sign-in or sign-up confirmation redirect', () => {
    expect(parseAuthRedirect('#access_token=abc&refresh_token=def&type=signup')).toBeNull()
  })

  it('ignores unrelated fragments', () => {
    expect(parseAuthRedirect('')).toBeNull()
    expect(parseAuthRedirect('#podsumowanie')).toBeNull()
    expect(parseAuthRedirect('#dane-podstawowe')).toBeNull()
  })

  it('does not treat a recovery type without a token as a recovery', () => {
    expect(parseAuthRedirect('#type=recovery')).toBeNull()
  })
})

describe('getAuthRedirectErrorMessage', () => {
  it('explains an expired or already used link', () => {
    expect(getAuthRedirectErrorMessage({ code: 'otp_expired' })).toMatch(/wygasł lub został już użyty/)
  })

  it('falls back to a general message for other errors', () => {
    expect(getAuthRedirectErrorMessage({ code: null })).toMatch(/nieprawidłowy/)
  })
})
