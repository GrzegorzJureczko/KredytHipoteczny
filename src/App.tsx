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
  propertyValue: number
  lifeInsuranceMonthlyPremium: number
  lifeInsuranceMonths: number
  lifeInsuranceDurationUnit: 'months' | 'years'
  propertyInsuranceFrequency: 'monthly' | 'annual'
  propertyInsuranceBasis: 'propertyValue' | 'loanAmount'
  propertyInsuranceRatePercent: number
}

const toLocalDateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const getMonthYearParts = (value: string) => {
  const [yearValue, monthValue] = value.slice(0, 7).split('-')
  const now = new Date()
  const year = Number(yearValue)
  const month = Number(monthValue)

  return {
    year: Number.isInteger(year) && year > 0 ? year : now.getFullYear(),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
  }
}

const getNextMonthDate = () => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + 1)
  return toLocalDateString(date)
}

const getDateOffsetMonths = (offsetMonths: number) => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + offsetMonths)
  return toLocalDateString(date)
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
  insurance: 200,
  notary: 3500,
  appraisal: 1800,
  commission: 0,
  propertyValue: 400000,
  lifeInsuranceMonthlyPremium: 200,
  lifeInsuranceMonths: 24,
  lifeInsuranceDurationUnit: 'months',
  propertyInsuranceFrequency: 'monthly',
  propertyInsuranceBasis: 'propertyValue',
  propertyInsuranceRatePercent: 0.05,
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)
const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(value)}%`

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

const MonthYearInput = ({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) => {
  const { year, month } = getMonthYearParts(value)
  const currentYear = new Date().getFullYear()
  const firstYear = Math.min(currentYear - 20, year)
  const lastYear = Math.max(currentYear + 40, year)
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index)

  const updateDate = (nextYear: number, nextMonth: number) => {
    onChange(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`)
  }

  return (
    <div className="month-year-picker">
      <select
        aria-label="Miesiąc"
        value={month}
        onChange={(event) => updateDate(year, Number(event.target.value))}
      >
        {monthNames.map((monthName, index) => (
          <option key={monthName} value={index + 1}>
            {monthName[0].toUpperCase() + monthName.slice(1)}
          </option>
        ))}
      </select>
      <select
        aria-label="Rok"
        value={year}
        onChange={(event) => updateDate(Number(event.target.value), month)}
      >
        {years.map((yearOption) => (
          <option key={yearOption} value={yearOption}>
            {yearOption}
          </option>
        ))}
      </select>
    </div>
  )
}

const FieldTooltip = ({ id, text }: { id: string; text: string }) => (
  <span className="field-tooltip-trigger" tabIndex={0} aria-describedby={id} aria-label={text}>
    <span aria-hidden="true">i</span>
    <span className="field-tooltip" id={id} role="tooltip">
      {text}
    </span>
  </span>
)

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
    const visibleDuration = Math.min(12_000, Math.max(4_000, authMessage.text.trim().length * 45))
    let clearMessageTimeout: number | undefined

    const timeoutId = window.setTimeout(() => {
      setIsAuthMessageVisible(false)
      clearMessageTimeout = window.setTimeout(() => {
        setAuthMessage((current) => ({ ...current, text: '' }))
      }, 350)
    }, visibleDuration)

    return () => {
      window.clearTimeout(timeoutId)
      if (clearMessageTimeout !== undefined) {
        window.clearTimeout(clearMessageTimeout)
      }
    }
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
    const client = supabase

    if (!client || !isSupabaseConfigured) {
      return
    }

    const syncSession = async () => {
      const {
        data: { session },
      } = await client.auth.getSession()
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
    } = client.auth.onAuthStateChange(async (_event, session) => {
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

      const { data, error } = await supabase.auth.signUp({
        email,
        password: authPassword,
        options: { emailRedirectTo: `${window.location.origin}/` },
      })

      if (error) {
        setAuthMessage({ type: 'error', text: getAuthErrorMessage(error, 'register') })
        return
      }

      const sessionUser = data.session?.user
      if (sessionUser?.id) {
        setCurrentUserEmail(sessionUser.email ?? email)
        setCurrentUserId(sessionUser.id)
        await loadSavedCalculations(sessionUser.id)
        setAuthMessage({ type: 'success', text: 'Konto zostało utworzone i zalogowano.' })
      } else {
        setAuthMode('login')
        setAuthMessage({
          type: 'success',
          text: 'Konto zostało utworzone. Potwierdź adres e-mail, a następnie zaloguj się.',
        })
      }
      setAuthEmail('')
      setAuthPassword('')
      setAuthConfirmPassword('')
      return
    }

    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword })

      if (error) {
        setAuthMessage({ type: 'error', text: getAuthErrorMessage(error, 'login') })
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
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error, 'reset') })
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
  const isSaveButtonInactive = selectedSavedCalculationId ? !hasUnsavedChanges : true

  const handleSaveCurrentCalculationClick = () => {
    if (isSaveButtonInactive) {
      if (!selectedSavedCalculationId && !savedCalculationsExpanded) {
        setSavedCalculationsExpanded(true)
      }
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
          created_at: new Date().toISOString(),
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
      .update({
        name,
        payload: form,
        created_at: new Date().toISOString(),
      })
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

  const getLifeInsuranceMonths = (currentForm: FormState) => {
    const months = currentForm.lifeInsuranceMonths || 0
    const units = currentForm.lifeInsuranceDurationUnit || 'months'
    return units === 'years' ? months * 12 : months
  }

  const getPropertyInsuranceMonthlyPremium = (currentForm: FormState) => {
    const propertyBase =
      currentForm.propertyInsuranceBasis === 'loanAmount' ? currentForm.amount : currentForm.propertyValue
    const rateDecimal = (Number(currentForm.propertyInsuranceRatePercent) || 0) / 100
    const annualPremium = Math.max(0, propertyBase * rateDecimal)

    return currentForm.propertyInsuranceFrequency === 'annual'
      ? annualPremium / 12
      : annualPremium
  }

  const getMonthlyAdditionalCost = (monthNumber: number, currentForm: FormState) => {
    const firstMonthFee =
      currentForm.applicationFee +
      currentForm.notary +
      currentForm.appraisal +
      currentForm.commission

    const lifeInsurancePeriod = getLifeInsuranceMonths(currentForm)
    const lifeInsuranceCost =
      monthNumber <= lifeInsurancePeriod ? Number(currentForm.lifeInsuranceMonthlyPremium || 0) : 0

    const propertyInsuranceCost = getPropertyInsuranceMonthlyPremium(currentForm)

    return monthNumber === 1 ? firstMonthFee + lifeInsuranceCost + propertyInsuranceCost : lifeInsuranceCost + propertyInsuranceCost
  }

  const totalAdditionalCosts = Array.from({ length: form.years * 12 }, (_, index) =>
    getMonthlyAdditionalCost(index + 1, form),
  ).reduce((sum, value) => sum + value, 0)

  const loanStartDate = useMemo(() => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() + 1)
    return toLocalDateString(date)
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

  const totalCost = summary.totalPaid + totalAdditionalCosts
  const monthlyBurden = summary.monthlyPayment + totalAdditionalCosts / Math.max(form.years * 12, 1)

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
      additionalCosts: getMonthlyAdditionalCost(index + 1, form),
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
                  aria-disabled={isSaveButtonInactive}
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
              maxHeight: isAuthMessageVisible ? '240px' : '0px',
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
                          ? `Ostatni zapis: ${new Date(entry.created_at).toLocaleString('pl-PL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : 'Ostatni zapis: dziś'}
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
              <span className="field-title">
                Kwota kredytu
                <FieldTooltip id="loan-amount-help" text="Całkowita kwota, którą chcesz pożyczyć" />
              </span>
              <input
                type="number"
                min="0"
                value={form.amount}
                onChange={(event) => updateField('amount', Number(event.target.value))}
              />
            </label>

            <label>
              <span>Wartość nieruchomości</span>
              <input
                type="number"
                min="0"
                value={form.propertyValue}
                onChange={(event) => updateField('propertyValue', Number(event.target.value))}
              />
            </label>

            <label>
              <span className="field-title">
                Oprocentowanie
                <FieldTooltip id="loan-rate-help" text="Roczna stopa procentowa kredytu" />
              </span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.rate}
                onChange={(event) => updateField('rate', Number(event.target.value))}
              />
            </label>

            <label>
              <span className="field-title">
                Okres kredytowania
                <FieldTooltip id="loan-term-help" text="Na ile lat rozciągasz spłatę" />
              </span>
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
              <span className="field-title">
                Rodzaj raty
                <FieldTooltip id="repayment-type-help" text="Wybierz wariant składanych płatności" />
              </span>
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

          <details className="subsection collapsible-section">
            <summary>Koszty około-kredytowe</summary>
            <div className="field-grid compact">
              <label>
                <span>Prowizja</span>
                <input
                  type="number"
                  min="0"
                  value={form.applicationFee}
                  onChange={(event) => updateField('applicationFee', Number(event.target.value))}
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

            <div className="insurance-block">
              <h4>Ubezpieczenie na życie</h4>
              <div className="field-grid compact">
                <label>
                  <span>Składka miesięczna</span>
                  <input
                    type="number"
                    min="0"
                    value={form.lifeInsuranceMonthlyPremium}
                    onChange={(event) =>
                      updateField('lifeInsuranceMonthlyPremium', Number(event.target.value))
                    }
                  />
                </label>

                <label>
                  <span>Czas ubezpieczenia</span>
                  <input
                    type="number"
                    min="0"
                    value={form.lifeInsuranceMonths}
                    onChange={(event) => updateField('lifeInsuranceMonths', Number(event.target.value))}
                  />
                </label>

                <label className="full-width">
                  <span>Jednostka czasu</span>
                  <select
                    value={form.lifeInsuranceDurationUnit}
                    onChange={(event) =>
                      updateField('lifeInsuranceDurationUnit', event.target.value as 'months' | 'years')
                    }
                  >
                    <option value="months">Miesiące</option>
                    <option value="years">Lata</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="insurance-block">
              <h4>Ubezpieczenie nieruchomości</h4>
              <div className="field-grid compact">
                <label>
                  <span>Stawka ubezpieczenia</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.propertyInsuranceRatePercent}
                    onChange={(event) =>
                      updateField('propertyInsuranceRatePercent', Number(event.target.value))
                    }
                  />
                </label>

                <label>
                  <span>Częstotliwość składki</span>
                  <select
                    value={form.propertyInsuranceFrequency}
                    onChange={(event) =>
                      updateField('propertyInsuranceFrequency', event.target.value as 'monthly' | 'annual')
                    }
                  >
                    <option value="monthly">Miesięcznie</option>
                    <option value="annual">Rocznie</option>
                  </select>
                </label>

                <label>
                  <span>Podstawa kalkulacji</span>
                  <select
                    value={form.propertyInsuranceBasis}
                    onChange={(event) =>
                      updateField('propertyInsuranceBasis', event.target.value as 'propertyValue' | 'loanAmount')
                    }
                  >
                    <option value="propertyValue">Wartość nieruchomości</option>
                    <option value="loanAmount">Kwota kredytu</option>
                  </select>
                </label>
              </div>
            </div>
          </details>

          <details className="subsection collapsible-section">
            <summary>Zmiany oprocentowania</summary>
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
                    <label>
                      <span>Data zmiany</span>
                      <MonthYearInput
                        value={entry.date}
                        onChange={(value) => updateRateChange(entry.id, 'date', value)}
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
          </details>

          <details className="subsection collapsible-section">
            <summary>Nadpłaty</summary>
            <div className="field-grid compact overpayment-settings">
              <label>
                <span className="field-title">
                  Regularna wpłata miesięczna
                  <FieldTooltip id="recurring-overpayment-help" text="Stała nadpłata powtarzana co miesiąc" />
                </span>
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
                <span className="field-title">
                  Data rozpoczęcia nadpłaty
                  <FieldTooltip id="overpayment-start-help" text="Od kiedy ma zaczynać działać stała nadpłata" />
                </span>
                <MonthYearInput
                  value={form.extraMonthlyPaymentStartDate}
                  onChange={(value) => updateField('extraMonthlyPaymentStartDate', value)}
                />
              </label>

              <label>
                <span className="field-title">
                  Efekt nadpłaty
                  <FieldTooltip id="overpayment-effect-help" text="Co ma się zmienić po dodatkowej wpłacie" />
                </span>
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
                      <MonthYearInput
                        value={payment.date}
                        onChange={(value) => updateExtraPayment(payment.id, 'date', value)}
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
          </details>

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
              <strong>{formatCurrency(totalAdditionalCosts)}</strong>
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
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Miesiąc</th>
                <th>Oprocentowanie</th>
                <th>Rata</th>
                <th>Kapitał</th>
                <th>Odsetki</th>
                <th>Nadpłata</th>
                <th>Koszty dodatkowe</th>
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
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '8%' }} />
                  </colgroup>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.year}-${row.month}`}>
                        <td>{row.monthLabel}</td>
                        <td>{formatPercent(row.annualRate)}</td>
                        <td>{formatCurrency(row.payment)}</td>
                        <td>{formatCurrency(row.principal)}</td>
                        <td>{formatCurrency(row.interest)}</td>
                        <td>{formatCurrency(row.extraPayment)}</td>
                        <td>{formatCurrency(row.additionalCosts)}</td>
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
