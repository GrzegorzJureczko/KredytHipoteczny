export type AuthAction = 'register' | 'login' | 'reset' | 'other'

export function getAuthErrorMessage(
  error: { message?: string } | string | null | undefined,
  action: AuthAction = 'other',
): string {
  const message = typeof error === 'string' ? error : error?.message ?? ''
  const normalized = message.toLowerCase()

  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('over_email_send_rate_limit')
  ) {
    if (action === 'register') {
      return 'Limit rejestracji lub wysyłki wiadomości e-mail został osiągnięty. Poczekaj kilka minut i spróbuj ponownie. Jeśli konto zostało już utworzone, potwierdź e-mail i zaloguj się.'
    }

    if (action === 'login') {
      return 'Za dużo prób logowania. Poczekaj kilka minut i spróbuj ponownie.'
    }

    if (action === 'reset') {
      return 'Za dużo prób wysłania linku resetującego. Poczekaj kilka minut i spróbuj ponownie.'
    }

    return 'Za dużo prób. Poczekaj kilka minut i spróbuj ponownie.'
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Nieprawidłowy e-mail lub hasło.'
  }

  return message || 'Wystąpił błąd uwierzytelniania.'
}
