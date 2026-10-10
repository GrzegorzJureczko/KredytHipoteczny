import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'
import { calculateLoanSummary, type ExtraPaymentMode, type RepaymentType } from './calculator'
import { getAuthErrorMessage } from './authError'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import {
  normalizeSavedCalculationPayload,
  type SavedCalculationPayload,
} from './savedCalculations'

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const isEmailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

type ExtraPaymentEntry = {
  id: number
  amount: number
  date: string
  effect: ExtraPaymentMode
}

type RateChangeEntry = {
  id: number
  date: string
  rate: number
}

type FormState = {
  amount: number
  rate: number
  years: number
  repaymentType: RepaymentType
  rateChanges: RateChangeEntry[]
  extraMonthlyPayment: number
  extraMonthlyPaymentStartDate: string
  extraPaymentMode: ExtraPaymentMode
  extraPayments: ExtraPaymentEntry[]
  applicationFee: number
  insurance: number
  notary: number
  appraisal: number
  commission: number
}

const getNextMonthDate = () => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + 1)
  return date.toISOString().slice(0, 10)
}

const getDateOffsetMonths = (offsetMonths: number) => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + offsetMonths)
  return date.toISOString().slice(0, 10)
}

const initialForm: FormState = {
  amount: 350000,
  rate: 5.2,
  years: 30,
  repaymentType: 'annuity',
  rateChanges: [],
  extraMonthlyPayment: 500,
  extraMonthlyPaymentStartDate: getNextMonthDate(),
  extraPaymentMode: 'reduceTerm',
  extraPayments: [],
  applicationFee: 1500,
  insurance: 4200,
  notary: 3500,
  appraisal: 1800,
  commission: 0,
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)

const monthNames = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
]

type SavedCalculationEntry = {
  id: string
  name: string
  payload: SavedCalculationPayload
  created_at?: string
}

function App() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [savedCalculationName, setSavedCalculationName] = useState('')
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculationEntry[]>([])
  const [selectedSavedCalculationId, setSelectedSavedCalculationId] = useState<string | null>(null)
  const [savedCalculationsExpanded, setSavedCalculationsExpanded] = useState(false)
  const [lastSavedForm, setLastSavedForm] = useState<FormState>(initialForm)
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string }>({
    type: 'success',
    text: '',
  })
  const [isAuthMessageVisible, setIsAuthMessageVisible] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    if (currentUserEmail) {
      setSavedCalculationsExpanded(false)
    }
  }, [currentUserEmail])

  useEffect(() => {
    if (!authMessage.text) {
      setIsAuthMessageVisible(false)
      return
    }

    setIsAuthMessageVisible(true)

    const timeoutId = window.setTimeout(() => {
      setIsAuthMessageVisible(false)
      window.setTimeout(() => {
        setAuthMessage((current) => ({ ...current, text: '' }))
      }, 350)
    }, 2500)

    return () => window.clearTimeout(timeoutId)
  }, [authMessage.text])

  const loadSavedCalculations = async (userId: string) => {
    if (!supabase || !isSupabaseConfigured) {
      setSavedCalculations([])
      return
    }

    const { data, error } = await supabase
      .from('saved_calculations')
      .select('id, name, payload, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
      return
    }

    const normalized = (data ?? [])
      .map((entry) => {
        const payload = normalizeSavedCalculationPayload(entry.payload as unknown)

        if (!payload) {
          return null
        }

        return {
          id: entry.id,
          name: entry.name ?? 'Zapisana kalkulacja',
          payload,
          created_at: entry.created_at ?? undefined,
        }
      })
      .filter(Boolean) as SavedCalculationEntry[]

    setSavedCalculations(normalized)
  }

  useEffect(() => {
    if (!supabase) {
      return
    }

    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const user = session?.user
      setCurrentUserEmail(user?.email ?? null)
      setCurrentUserId(user?.id ?? null)

      if (user?.id) {
        await loadSavedCalculations(user.id)
      } else {
        setSavedCalculations([])
      }
    }

    syncSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user
      setCurrentUserEmail(user?.email ?? null)
      setCurrentUserId(user?.id ?? null)

      if (user?.id) {
        await loadSavedCalculations(user.id)
      } else {
        setSavedCalculations([])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!supabase || !isSupabaseConfigured) {
      setAuthMessage({
        type: 'error',
        text: 'Brakuje konfiguracji Supabase. Ustaw VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY.',
      })
      return
    }

    const email = normalizeEmail(authEmail)

    if (!isEmailValid(email)) {
      setAuthMessage({ type: 'error', text: 'Podaj poprawny adres e-mail.' })
      return
    }

    if (authMode === 'register') {
      if (authPassword.length < 6) {
        setAuthMessage({ type: 'error', text: 'Hasło musi mieć co najmniej 6 znaków.' })
        return
      }

      if (authPassword !== authConfirmPassword) {
        setAuthMessage({ type: 'error', text: 'Hasła nie są zgodne.' })
        return
      }

      const { error } = await supabase.auth.signUp({ email, password: authPassword })

      if (error) {
        setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
        return
      }

      setCurrentUserEmail(email)
      setAuthMessage({
        type: 'success',
        text: 'Konto zostało utworzone. Sprawdź e-mail, aby potwierdzić konto.',
      })
      setAuthEmail('')
      setAuthPassword('')
      setAuthConfirmPassword('')
      return
    }

    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword })

      if (error) {
        setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
        return
      }

      setAuthMessage({ type: 'success', text: 'Zalogowano pomyślnie.' })
      setAuthEmail('')
      setAuthPassword('')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    })

    if (error) {
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
      return
    }

    setAuthMessage({
      type: 'success',
      text: 'Link do resetu hasła został wysłany na podany adres e-mail.',
    })
    setAuthEmail('')
    setAuthPassword('')
    setAuthConfirmPassword('')
  }

  const handleLogout = async () => {
    if (!supabase || !isSupabaseConfigured) {
      setAuthMessage({ type: 'error', text: 'Brakuje konfiguracji Supabase.' })
      return
    }

    const { error } = await supabase.auth.signOut()

    if (error) {
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
      return
    }

    setCurrentUserEmail(null)
    setCurrentUserId(null)
    setSavedCalculations([])
    setSavedCalculationName('')
    setSelectedSavedCalculationId(null)
    setLastSavedForm(initialForm)
    setAuthMessage({ type: 'success', text: 'Wylogowano.' })
  }

  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(lastSavedForm)
  const isSaveDisabled = selectedSavedCalculationId ? !hasUnsavedChanges : false

  const startNewSavedCalculationDraft = () => {
    setSelectedSavedCalculationId(null)
    setSavedCalculationName('')
    setLastSavedForm(form)
    setSavedCalculationsExpanded(true)
  }

  const handleSaveCurrentCalculationClick = () => {
    if (!selectedSavedCalculationId && !savedCalculationsExpanded) {
      setSavedCalculationsExpanded(true)
      return
    }

    handleSaveCurrentCalculation()
  }

  const saveNewCalculation = async () => {
    if (!supabase || !isSupabaseConfigured || !currentUserId) {
      setAuthMessage({ type: 'error', text: 'Zaloguj się, aby zapisać kalkulację.' })
      return
    }

    const name = savedCalculationName.trim() || `Kalkulacja ${new Date().toLocaleDateString('pl-PL')}`

    const { data, error } = await supabase
      .from('saved_calculations')
      .insert([
        {
          user_id: currentUserId,
          name,
          payload: form,
        },
      ])
      .select('id')
      .single()

    if (error) {
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
      return
    }

    setSavedCalculationName('')
    setSelectedSavedCalculationId(data?.id ?? null)
    setLastSavedForm(form)
    setAuthMessage({ type: 'success', text: 'Kalkulacja została zapisana.' })
    await loadSavedCalculations(currentUserId)
  }

  const handleSaveCurrentCalculation = async () => {
    if (!supabase || !isSupabaseConfigured || !currentUserId) {
      setAuthMessage({ type: 'error', text: 'Zaloguj się, aby zapisać kalkulację.' })
      return
    }

    if (!selectedSavedCalculationId) {
      await saveNewCalculation()
      return
    }

    const name = savedCalculationName.trim() || `Kalkulacja ${new Date().toLocaleDateString('pl-PL')}`

    const { error } = await supabase
      .from('saved_calculations')
      .update({ name, payload: form })
      .eq('id', selectedSavedCalculationId)

    if (error) {
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
      return
    }

    setLastSavedForm(form)
    setAuthMessage({ type: 'success', text: 'Zapisano zmiany.' })
    await loadSavedCalculations(currentUserId)
  }

  const handleLoadSavedCalculation = async (entry: SavedCalculationEntry) => {
    const loadedSnapshot = JSON.parse(JSON.stringify(entry.payload)) as FormState

    setForm({
      ...initialForm,
      ...loadedSnapshot,
      rateChanges: loadedSnapshot.rateChanges,
      extraPayments: loadedSnapshot.extraPayments,
    })
    setLastSavedForm(loadedSnapshot)
    setSavedCalculationName(entry.name)
    setSelectedSavedCalculationId(entry.id)
    setAuthMessage({ type: 'success', text: `Wczytano zapis: ${entry.name}.` })
  }

  const handleDeleteSavedCalculation = async (entryId: string) => {
    if (!supabase || !isSupabaseConfigured || !currentUserId) {
      setAuthMessage({ type: 'error', text: 'Zaloguj się, aby usunąć zapis.' })
      return
    }

    const { error } = await supabase.from('saved_calculations').delete().eq('id', entryId)

    if (error) {
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
      return
    }

    setAuthMessage({ type: 'success', text: 'Zapis został usunięty.' })
    await loadSavedCalculations(currentUserId)
  }

  const additionalCosts =
    form.applicationFee +
    form.insurance +
    form.notary +
    form.appraisal +
    form.commission

  const loanStartDate = useMemo(() => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() + 1)
    return date.toISOString().slice(0, 10)
  }, [])

  const summary = useMemo(
    () =>
      calculateLoanSummary({
        loanAmount: form.amount,
        annualRate: form.rate,
        termMonths: form.years * 12,
        repaymentType: form.repaymentType,
        loanStartDate,
        rateChanges: form.rateChanges.map(({ date, rate }) => ({ date, rate })),
        extraMonthlyPayment: form.extraMonthlyPayment,
        extraMonthlyPaymentStartDate: form.extraMonthlyPaymentStartDate,
        extraPayments: form.extraPayments.map(({ amount, date, effect }) => ({
          amount,
          date,
          effect,
        })),
        extraPaymentMode: form.extraPaymentMode,
      }),
    [form, loanStartDate],
  )

  const totalCost = summary.totalPaid + additionalCosts
  const monthlyBurden = summary.monthlyPayment + additionalCosts / Math.max(form.years * 12, 1)

  const resetForm = () => setForm(initialForm)

  const addRateChange = () => {
    setForm((current) => ({
      ...current,
      rateChanges: [
        ...current.rateChanges,
        {
          id: Date.now() + Math.random(),
          date: getDateOffsetMonths(12),
          rate: current.rate,
        },
      ],
    }))
  }

  const updateRateChange = (id: number, field: 'date' | 'rate', value: string | number) => {
    setForm((current) => ({
      ...current,
      rateChanges: current.rateChanges.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    }))
  }

  const removeRateChange = (id: number) => {
    setForm((current) => ({
      ...current,
      rateChanges: current.rateChanges.filter((entry) => entry.id !== id),
    }))
  }

  const addExtraPayment = () => {
    setForm((current) => ({
      ...current,
      extraPayments: [
        ...current.extraPayments,
        {
          id: Date.now() + Math.random(),
          amount: 500,
          date: getDateOffsetMonths(12),
          effect: 'reduceTerm',
        },
      ],
    }))
  }

  const updateExtraPayment = (
    id: number,
    field: 'amount' | 'date' | 'effect',
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      extraPayments: current.extraPayments.map((payment) =>
        payment.id === id ? { ...payment, [field]: value } : payment,
      ),
    }))
  }

  const removeExtraPayment = (id: number) => {
    setForm((current) => ({
      ...current,
      extraPayments: current.extraPayments.filter((payment) => payment.id !== id),
    }))
  }

  const scheduleWithDates = summary.schedule.map((row, index) => {
    const baseDate = new Date()
    const paymentDate = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + 1 + index,
      1,
    )

    return {
      ...row,
      paymentDate,
      monthLabel: `${monthNames[paymentDate.getMonth()]} ${paymentDate.getFullYear()}`,
      year: paymentDate.getFullYear(),
    }
  })

  const groupedByYear = Object.values(
    scheduleWithDates.reduce<Record<number, typeof scheduleWithDates>>((acc, item) => {
      if (!acc[item.year]) {
        acc[item.year] = []
      }
      acc[item.year].push(item)
      return acc
    }, {}),
  )

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="page-shell">
      <section className="panel auth-panel">
        {currentUserEmail ? (
          <div className="auth-header logged-in-header">
            <div className="user-panel-row">
              <div className="left-user-actions">
                <button
                  type="button"
                  className="saved-toggle-button"
                  onClick={() => setSavedCalculationsExpanded((value) => !value)}
                  aria-expanded={savedCalculationsExpanded}
                >
                  <span className="collapse-indicator">{savedCalculationsExpanded ? '▾' : '▸'}</span>
                  <span>Zapisane kalkulacje</span>
                </button>

                <button
                  type="button"
                  className="save-disk-button"
                  onClick={handleSaveCurrentCalculationClick}
                  disabled={isSaveDisabled}
                  title={selectedSavedCalculationId ? 'Zapisz zmiany' : 'Zapisz'}
                  aria-label={selectedSavedCalculationId ? 'Zapisz zmiany' : 'Zapisz'}
                >
                  <span aria-hidden="true">💾</span>
                  {selectedSavedCalculationId ? (
                    <span className="save-disk-label">
                      {savedCalculationName || 'Zapisz zmiany'}
                    </span>
                  ) : null}
                </button>
              </div>

              <div className="user-badge">
                <span>{currentUserEmail}</span>
                <button type="button" className="secondary-button" onClick={handleLogout}>
                  Wyloguj
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="auth-header">
              <div>
                <p className="eyebrow">Konto użytkownika</p>
                <h2>Rejestracja i logowanie</h2>
              </div>
            </div>

            <div className="auth-tabs">
              <button
                type="button"
                className={authMode === 'login' ? 'auth-tab active' : 'auth-tab'}
                onClick={() => setAuthMode('login')}
              >
                Zaloguj się
              </button>
              <button
                type="button"
                className={authMode === 'register' ? 'auth-tab active' : 'auth-tab'}
                onClick={() => setAuthMode('register')}
              >
                Rejestracja
              </button>
              <button
                type="button"
                className={authMode === 'reset' ? 'auth-tab active' : 'auth-tab'}
                onClick={() => setAuthMode('reset')}
              >
                Reset hasła
              </button>
            </div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <label>
                <span>E-mail</span>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="twoj@email.pl"
                />
              </label>

              {authMode !== 'reset' ? (
                <label>
                  <span>Hasło</span>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="Minimum 6 znaków"
                  />
                </label>
              ) : null}

              {authMode === 'register' ? (
                <label>
                  <span>Powtórz hasło</span>
                  <input
                    type="password"
                    value={authConfirmPassword}
                    onChange={(event) => setAuthConfirmPassword(event.target.value)}
                    placeholder="Potwierdź hasło"
                  />
                </label>
              ) : null}

              <button type="submit" className="primary-button">
                {authMode === 'login'
                  ? 'Zaloguj się'
                  : authMode === 'register'
                    ? 'Utwórz konto'
                    : 'Wyślij link do resetu'}
              </button>
            </form>
          </>
        )}

        {authMessage.text || isAuthMessageVisible ? (
          <p
            className={
              authMessage.type === 'success' ? 'auth-message success' : 'auth-message error'
            }
            style={{
              opacity: isAuthMessageVisible ? 1 : 0,
              transform: isAuthMessageVisible ? 'translateY(0)' : 'translateY(-6px)',
              maxHeight: isAuthMessageVisible ? '80px' : '0px',
              marginTop: isAuthMessageVisible ? '14px' : '0px',
              paddingTop: isAuthMessageVisible ? '10px' : '0px',
              paddingBottom: isAuthMessageVisible ? '10px' : '0px',
            }}
          >
            {authMessage.text}
          </p>
        ) : null}

        {currentUserEmail && savedCalculationsExpanded ? (
          <div className="saved-calculations">
            <div className="saved-toolbar">
              <input
                type="text"
                value={savedCalculationName}
                onChange={(event) => setSavedCalculationName(event.target.value)}
                placeholder="Nazwa kalkulacji"
              />
              <button
                type="button"
                className="primary-button"
                onClick={saveNewCalculation}
                disabled={false}
              >
                Zapisz nową kalkulację
              </button>
            </div>

            {savedCalculations.length === 0 ? (
              <p className="empty-state">Brak zapisanych kalkulacji. Zapisz bieżący scenariusz, aby wrócić do niego później.</p>
            ) : (
              <ul className="saved-list">
                {savedCalculations.map((entry) => (
                  <li key={entry.id} className="saved-item">
                    <div className="saved-summary">
                      <strong>{entry.name}</strong>
                      <span>
                        {entry.created_at
                          ? new Date(entry.created_at).toLocaleDateString('pl-PL')
                          : 'Dziś'}
                      </span>
                    </div>
                    <div className="saved-actions">
                      <button type="button" className="secondary-button" onClick={() => handleLoadSavedCalculation(entry)}>
                        Wczytaj
                      </button>
                      <button type="button" className="remove-button" onClick={() => handleDeleteSavedCalculation(entry.id)}>
                        Usuń
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <header className="topbar">
        <div>
          <p className="eyebrow">Kalkulator kredytowy</p>
          <h1>Porównaj realny koszt kredytu hipotecznego</h1>
        </div>
        <button type="button" className="reset-button" onClick={resetForm}>
          Przywróć domyślne
        </button>
      </header>

      <main className="app-grid">
        <section className="panel form-panel">
          <h2>Dane podstawowe</h2>

          <div className="field-grid">
            <label>
              <span>Kwota kredytu</span>
              <small>Całkowita kwota, którą chcesz pożyczyć</small>
              <input
                type="number"
                min="0"
                value={form.amount}
                onChange={(event) => updateField('amount', Number(event.target.value))}
              />
            </label>

            <label>
              <span>Oprocentowanie</span>
              <small>Roczna stopa procentowa kredytu</small>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.rate}
                onChange={(event) => updateField('rate', Number(event.target.value))}
              />
            </label>

            <label>
              <span>Okres kredytowania</span>
              <small>Na ile lat rozciągasz spłatę</small>
              <select
                value={form.years}
                onChange={(event) => updateField('years', Number(event.target.value))}
              >
                {[5, 10, 15, 20, 25, 30, 35, 40].map((year) => (
                  <option key={year} value={year}>
                    {year} lat
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Rodzaj raty</span>
              <small>Wybierz wariant składanych płatności</small>
              <select
                value={form.repaymentType}
                onChange={(event) =>
                  updateField('repaymentType', event.target.value as RepaymentType)
                }
              >
                <option value="annuity">Równe</option>
                <option value="decreasing">Malejące</option>
              </select>
            </label>
          </div>

          <div className="subsection">
            <h3>Zmiany oprocentowania</h3>
            <div className="extra-payment-list">
              <div className="extra-payment-header">
                <h4>Daty zmiany stopy</h4>
                <button type="button" className="secondary-button" onClick={addRateChange}>
                  + Dodaj zmianę
                </button>
              </div>

              {form.rateChanges.length === 0 ? (
                <p className="empty-state">Brak zmian oprocentowania. Dodaj datę i nową stopę, aby zmienić odsetki od wybranego momentu.</p>
              ) : (
                form.rateChanges.map((entry) => (
                  <div key={entry.id} className="extra-payment-row">
                    <label>
                      <span>Data zmiany</span>
                      <input
                        type="date"
                        value={entry.date}
                        onChange={(event) => updateRateChange(entry.id, 'date', event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Nowe oprocentowanie</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={entry.rate}
                        onChange={(event) =>
                          updateRateChange(entry.id, 'rate', Number(event.target.value))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removeRateChange(entry.id)}
                    >
                      Usuń
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="subsection">
            <h3>Nadpłaty</h3>
            <div className="field-grid compact">
              <label>
                <span>Dodatkowa wpłata miesięczna</span>
                <small>Stała nadpłata powtarzana co miesiąc</small>
                <input
                  type="number"
                  min="0"
                  value={form.extraMonthlyPayment}
                  onChange={(event) =>
                    updateField('extraMonthlyPayment', Number(event.target.value))
                  }
                />
              </label>

              <label>
                <span>Data rozpoczęcia nadpłaty</span>
                <small>Od kiedy ma zaczynać działać stała nadpłata</small>
                <input
                  type="date"
                  value={form.extraMonthlyPaymentStartDate}
                  onChange={(event) =>
                    updateField('extraMonthlyPaymentStartDate', event.target.value)
                  }
                />
              </label>

              <label className="full-width">
                <span>Efekt nadpłaty</span>
                <small>Co ma się zmienić po dodatkowej wpłacie</small>
                <select
                  value={form.extraPaymentMode}
                  onChange={(event) =>
                    updateField('extraPaymentMode', event.target.value as ExtraPaymentMode)
                  }
                >
                  <option value="reduceTerm">Skrócenie okresu</option>
                  <option value="reduceInstallment">Obniżenie raty</option>
                </select>
              </label>
            </div>

            <div className="extra-payment-list">
              <div className="extra-payment-header">
                <h4>Dodatkowe nadpłaty jednorazowe</h4>
                <button type="button" className="secondary-button" onClick={addExtraPayment}>
                  + Dodaj nadpłatę
                </button>
              </div>

              {form.extraPayments.length === 0 ? (
                <p className="empty-state">Brak dodatkowych nadpłat. Dodaj datę i kwotę, aby uwzględnić ją w harmonogramie.</p>
              ) : (
                form.extraPayments.map((payment) => (
                  <div key={payment.id} className="extra-payment-row">
                    <label>
                      <span>Kwota</span>
                      <input
                        type="number"
                        min="0"
                        value={payment.amount}
                        onChange={(event) =>
                          updateExtraPayment(payment.id, 'amount', Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      <span>Data</span>
                      <input
                        type="date"
                        value={payment.date}
                        onChange={(event) =>
                          updateExtraPayment(payment.id, 'date', event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>Efekt</span>
                      <select
                        value={payment.effect}
                        onChange={(event) =>
                          updateExtraPayment(
                            payment.id,
                            'effect',
                            event.target.value as ExtraPaymentMode,
                          )
                        }
                      >
                        <option value="reduceTerm">Skrócenie okresu</option>
                        <option value="reduceInstallment">Obniżenie raty</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removeExtraPayment(payment.id)}
                    >
                      Usuń
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="subsection">
            <h3>Koszty około-kredytowe</h3>
            <div className="field-grid compact">
              <label>
                <span>Opłata za wniosek</span>
                <input
                  type="number"
                  min="0"
                  value={form.applicationFee}
                  onChange={(event) => updateField('applicationFee', Number(event.target.value))}
                />
              </label>

              <label>
                <span>Ubezpieczenie</span>
                <input
                  type="number"
                  min="0"
                  value={form.insurance}
                  onChange={(event) => updateField('insurance', Number(event.target.value))}
                />
              </label>

              <label>
                <span>Notariusz / dokumenty</span>
                <input
                  type="number"
                  min="0"
                  value={form.notary}
                  onChange={(event) => updateField('notary', Number(event.target.value))}
                />
              </label>

              <label>
                <span>Wycena / ekspertyza</span>
                <input
                  type="number"
                  min="0"
                  value={form.appraisal}
                  onChange={(event) => updateField('appraisal', Number(event.target.value))}
                />
              </label>

              <label>
                <span>Prowizja / inne</span>
                <input
                  type="number"
                  min="0"
                  value={form.commission}
                  onChange={(event) => updateField('commission', Number(event.target.value))}
                />
              </label>
            </div>
          </div>
        </section>

        <aside className="panel summary-panel">
          <h2>Podsumowanie</h2>

          <div className="summary-cards">
            <article className="summary-highlight">
              <span>Rata miesięczna</span>
              <strong>{formatCurrency(summary.monthlyPayment)}</strong>
            </article>
            <article>
              <span>Łącznie odsetki</span>
              <strong>{formatCurrency(summary.totalInterest)}</strong>
            </article>
            <article>
              <span>Całkowity koszt</span>
              <strong>{formatCurrency(totalCost)}</strong>
            </article>
            <article>
              <span>Obciążenie miesięczne</span>
              <strong>{formatCurrency(monthlyBurden)}</strong>
            </article>
          </div>

          <div className="kpi-row">
            <div>
              <small>Koszty dodatkowe</small>
              <strong>{formatCurrency(additionalCosts)}</strong>
            </div>
            <div>
              <small>Skumulowana spłata</small>
              <strong>{formatCurrency(summary.totalPaid)}</strong>
            </div>
            <div>
              <small>Okres spłaty</small>
              <strong>{summary.loanTermMonths} mies.</strong>
            </div>
          </div>

          <div className="note-box">
            <p>
              W praktyce realny koszt zobowiązania często jest wyższy niż sama rata. Dodanie
              opłat okołokredytowych pozwala lepiej porównać oferty banków i zidentyfikować
              ukryte różnice między propozycjami.
            </p>
          </div>
        </aside>
      </main>

      <section className="panel schedule-panel">
        <div className="section-header">
          <h2>Harmonogram spłat</h2>
          <span>po latach</span>
        </div>

        <div className="schedule-table-header">
          <table>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Miesiąc</th>
                <th>Rata</th>
                <th>Kapitał</th>
                <th>Odsetki</th>
                <th>Nadpłata</th>
                <th>Saldo</th>
              </tr>
            </thead>
          </table>
        </div>

        <div className="year-groups">
          {groupedByYear.map((rows, index) => (
            <details key={rows[0]?.year ?? index} open={index === 0} className="year-group">
              <summary>{rows[0]?.year}</summary>
              <div className="table-wrap">
                <table>
                  <colgroup>
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.year}-${row.month}`}>
                        <td>{row.monthLabel}</td>
                        <td>{formatCurrency(row.payment)}</td>
                        <td>{formatCurrency(row.principal)}</td>
                        <td>{formatCurrency(row.interest)}</td>
                        <td>{formatCurrency(row.extraPayment)}</td>
                        <td>{formatCurrency(row.remainingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}

export default App
