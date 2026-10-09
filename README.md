# Kalkulator kredytowy

Aplikacja React + TypeScript do kalkulacji kredytów hipotecznych z harmonogramem spłat, nadpłatami i zmianami oprocentowania.

## Wymagania

- Node.js 22+
- konto Supabase

## Konfiguracja auth

1. Utwórz projekt w Supabase.
2. Skopiuj wartości:
   - URL projektu
   - anon public key
3. Utwórz plik `.env` na podstawie `.env.example`.

```bash
cp .env.example .env
```

Przykład:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Uruchomienie

```bash
npm install
npm run dev
```

## Funkcje

- rejestracja użytkownika
- logowanie
- reset hasła po adresie e-mail
- kalkulator kredytowy, nadpłaty i zmiany oprocentowania

## Uwaga

Dla działania auth w środowisku realnym trzeba podłączyć projekt Supabase i włączyć email auth w panelu projektu.
