export type AuthRedirect = { kind: 'recovery' } | { kind: 'error'; code: string | null }

// Supabase appends the outcome of an e-mail link to the URL fragment.
export const parseAuthRedirect = (hash: string): AuthRedirect | null => {
  const params = new URLSearchParams(hash.replace(/^#/, ''))

  if (params.get('error') || params.get('error_code')) {
    return { kind: 'error', code: params.get('error_code') }
  }

  if (params.get('type') === 'recovery' && params.get('access_token')) {
    return { kind: 'recovery' }
  }

  return null
}

export const getAuthRedirectErrorMessage = (redirect: { code: string | null }) =>
  redirect.code === 'otp_expired'
    ? 'Link z e-maila wygasł lub został już użyty. Poproś o nowy link do resetu hasła. Jeśli konto jest już potwierdzone, po prostu zaloguj się.'
    : 'Link z e-maila jest nieprawidłowy. Poproś o nowy.'

// Read at import time, before the Supabase client consumes and clears the fragment.
export const initialAuthRedirect: AuthRedirect | null =
  typeof window === 'undefined' ? null : parseAuthRedirect(window.location.hash)

export const clearAuthRedirectFromUrl = () => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}
