export function getAuthErrorMessage(error: { message?: string } | string | null | undefined): string {
  const message = typeof error === 'string' ? error : error?.message ?? ''
  const normalized = message.toLowerCase()

  if (normalized.includes('rate limit exceeded') || normalized.includes('email rate limit exceeded')) {
    return 'Za dużo prób wysłania linku resetującego. Poczekaj kilka minut i spróbuj ponownie.'
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Nieprawidłowy e-mail lub hasło.'
  }

  return message || 'Wystąpił błąd uwierzytelniania.'
}
