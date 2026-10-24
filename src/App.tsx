import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from 'react'
import './App.css'
import { calculateLoanSummary, type ExtraPaymentMode, type RepaymentType } from './calculator'
import { getAuthErrorMessage } from './authError'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import {
  getLegacyLoanStartDate,
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
  wibor: number
}

type RegularOverpaymentEntry = {
  id: number
  amount: number
  startDate: string
  endDate: string
  effect: ExtraPaymentMode
}

type FormState = {
  amount: number
  loanStartDate: string
  rate: number
  wibor: number
  margin: number
  years: number
  repaymentType: RepaymentType
  rateChanges: RateChangeEntry[]
  regularOverpayments: RegularOverpaymentEntry[]
  extraPayments: ExtraPaymentEntry[]
  applicationFee: number
  applicationFeeCalculationType: 'percentage' | 'amount'
  applicationFeePercent: number
  insurance: number
  notary: number
  appraisal: number
  commission: number
  propertyValue: number
  lifeInsuranceCalculationType: 'percentage' | 'amount'
  lifeInsuranceRatePercent: number
  lifeInsuranceMonthlyPremium: number
  lifeInsuranceMonths: number
  lifeInsuranceDurationUnit: 'months' | 'years'
  propertyInsuranceCalculationType: 'percentage' | 'amount'
  propertyInsuranceAmount: number
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

const addMonthsToDate = (value: string, months: number) => {
  const { year, month } = getMonthYearParts(value)
  return toLocalDateString(new Date(year, month - 1 + months, 1))
}

const getAnnualRateFromSplit = (wibor: number, margin: number) =>
  Number((Number(wibor || 0) + Number(margin || 0)).toFixed(4))

const initialForm: FormState = {
  amount: 350000,
  loanStartDate: getNextMonthDate(),
  rate: 5.2,
  wibor: 2.7,
  margin: 2.5,
  years: 30,
  repaymentType: 'annuity',
  rateChanges: [],
  regularOverpayments: [],
  extraPayments: [],
  applicationFee: 1500,
  applicationFeeCalculationType: 'amount',
  applicationFeePercent: 0.43,
  insurance: 200,
  notary: 3500,
  appraisal: 1800,
  commission: 0,
  propertyValue: 400000,
  lifeInsuranceCalculationType: 'amount',
  lifeInsuranceRatePercent: 0.05,
  lifeInsuranceMonthlyPremium: 200,
  lifeInsuranceMonths: 24,
  lifeInsuranceDurationUnit: 'months',
  propertyInsuranceCalculationType: 'percentage',
  propertyInsuranceAmount: 200,
  propertyInsuranceFrequency: 'monthly',
  propertyInsuranceBasis: 'propertyValue',
  propertyInsuranceRatePercent: 0.05,
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)
const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(value)}%`

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

const formatMoneyOrDash = (value: number) => (value === 0 ? '\u2013' : formatCurrency(value))

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

const FieldTooltip = ({ id, text }: { id: string; text: string }) => {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const closeOnOutsideTap = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideTap)
    return () => document.removeEventListener('pointerdown', closeOnOutsideTap)
  }, [open])

  return (
    <span
      ref={triggerRef}
      className={open ? 'field-tooltip-trigger is-open' : 'field-tooltip-trigger'}
      role="button"
      tabIndex={0}
      aria-describedby={id}
      aria-expanded={open}
      aria-label={text}
      onClick={(event) => {
        event.preventDefault()
        setOpen((value) => !value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false)
        }
      }}
    >
      <span aria-hidden="true">i</span>
      <span className="field-tooltip" id={id} role="tooltip">
        {text}
      </span>
    </span>
  )
}

const SegmentedControl = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
}) => (
  <div className="segmented-control" role="group" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
)

const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')

const formatMoneyDraft = (draft: string) => {
  const [integerPart, decimalPart] = draft.split('.')
  const grouped = groupDigits(integerPart)

  return decimalPart === undefined ? grouped : `${grouped},${decimalPart}`
}

const sanitizeMoneyInput = (raw: string) => {
  const cleaned = raw.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const [integerPart, ...decimalParts] = cleaned.split('.')
  const integerDigits = integerPart.replace(/^0+(?=\d)/, '')

  if (decimalParts.length === 0) {
    return integerDigits
  }

  return `${integerDigits || '0'}.${decimalParts.join('').slice(0, 2)}`
}

const pluralize = (count: number, one: string, few: string, many: string) => {
  const lastTwo = count % 100
  const last = count % 10

  if (count === 1) {
    return one
  }

  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? few : many
}

const formatDuration = (months: number) => {
  const years = Math.floor(months / 12)
  const restMonths = months % 12
  const parts: string[] = []

  if (years > 0) {
    parts.push(`${years} ${pluralize(years, 'rok', 'lata', 'lat')}`)
  }

  if (restMonths > 0 || years === 0) {
    parts.push(`${restMonths} mies.`)
  }

  return parts.join(' ')
}

const calculationTypeOptions = [
  { value: 'amount', label: 'Kwotowo' },
  { value: 'percentage', label: 'Procentowo' },
] as const

type UnitInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onBlur' | 'type'
> & {
  unit: string
  value: number
  onValueChange?: (value: number) => void
}

const UnitInput = ({
  unit,
  value,
  onValueChange,
  min,
  step,
  ...inputProps
}: UnitInputProps) => {
  const isMoney = unit === 'zł'
  const typeProps = isMoney
    ? ({ type: 'text', inputMode: 'decimal', autoComplete: 'off' } as const)
    : ({ type: 'number', min, step } as const)
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCaret = useRef<number | null>(null)
  const displayValue = isMoney
    ? formatMoneyDraft(
        draft !== null && Number(draft) === value ? draft : String(Number(value.toFixed(2))),
      )
    : draft !== null && Number(draft) === value
      ? draft
      : String(value)

  useLayoutEffect(() => {
    const input = inputRef.current
    const caretSymbols = pendingCaret.current

    if (!input || caretSymbols === null) {
      return
    }

    let position = 0
    let seen = 0

    while (position < input.value.length && seen < caretSymbols) {
      if (/[\d,]/.test(input.value[position])) {
        seen += 1
      }
      position += 1
    }

    input.setSelectionRange(position, position)
    pendingCaret.current = null
  })

  return (
    <span className="input-unit" data-unit={unit}>
      <input
        {...inputProps}
        ref={inputRef}
        {...typeProps}
        value={displayValue}
        onChange={(event) => {
          const raw = event.target.value
          const nextDraft = isMoney ? sanitizeMoneyInput(raw) : raw

          if (isMoney) {
            const caret = event.target.selectionStart ?? raw.length
            pendingCaret.current = raw.slice(0, caret).replace(/[^\d,.]/g, '').length
          }

          setDraft(nextDraft)

          if (nextDraft === '') {
            onValueChange?.(0)
          } else if (Number.isFinite(Number(nextDraft))) {
            onValueChange?.(Number(nextDraft))
          }
        }}
        onBlur={() => setDraft(null)}
      />
    </span>
  )
}

type SavedCalculationEntry = {
  id: string
  name: string
  payload: SavedCalculationPayload
  created_at?: string
  updated_at?: string
}

type LoanInput = Parameters<typeof calculateLoanSummary>[0]

type ConfirmRequest = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
}

type ScheduleEvent = {
  key: 'rate' | 'onetime' | 'regularStart' | 'regularEnd' | 'last'
  label: string
}

const buildLoanInput = (source: FormState): LoanInput => ({
  loanAmount: source.amount,
  annualRate: source.rate,
  termMonths: source.years * 12,
  repaymentType: source.repaymentType,
  loanStartDate: source.loanStartDate,
  rateChanges: source.rateChanges.map(({ date, wibor }) => ({
    date,
    rate: getAnnualRateFromSplit(wibor, source.margin),
  })),
  recurringExtraPayments: source.regularOverpayments.map(
    ({ amount, startDate, endDate, effect }) => ({
      amount,
      startDate,
      endDate: endDate || undefined,
      effect,
    }),
  ),
  extraPayments: source.extraPayments.map(({ amount, date, effect }) => ({
    amount,
    date,
    effect,
  })),
})

const payloadToFormState = (payload: SavedCalculationPayload): FormState => {
  const {
    extraMonthlyPayment,
    extraMonthlyPaymentStartDate,
    extraPaymentMode,
    regularOverpayments: savedRegularOverpayments,
    rateChanges: savedRateChanges,
    ...rest
  } = JSON.parse(JSON.stringify(payload)) as SavedCalculationPayload
  const wibor = Number(rest.wibor ?? rest.rate ?? 0)
  const margin = Number(rest.margin ?? 0)
  const totalRate = getAnnualRateFromSplit(wibor, margin)
  const startDate = rest.loanStartDate || initialForm.loanStartDate

  const regularOverpayments: RegularOverpaymentEntry[] =
    savedRegularOverpayments ??
    ((extraMonthlyPayment ?? 0) > 0
      ? [
          {
            id: 1,
            amount: extraMonthlyPayment ?? 0,
            startDate: extraMonthlyPaymentStartDate || startDate,
            endDate: '',
            effect: extraPaymentMode ?? 'reduceTerm',
          },
        ]
      : [])

  return {
    ...initialForm,
    ...(rest as Partial<FormState>),
    rate: totalRate,
    wibor,
    margin,
    rateChanges: (savedRateChanges ?? []).map((entry) => ({
      id: entry.id,
      date: entry.date,
      wibor: entry.wibor ?? Number(((entry.rate ?? totalRate) - margin).toFixed(4)),
    })),
    regularOverpayments,
    extraPayments: rest.extraPayments ?? [],
  }
}

const formatSavedDate = (value: string) =>
  new Date(value).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const getSavedDateLabel = (entry: SavedCalculationEntry) => {
  if (entry.updated_at) {
    return `Ostatni zapis: ${formatSavedDate(entry.updated_at)}`
  }

  return entry.created_at ? `Utworzono: ${formatSavedDate(entry.created_at)}` : 'Utworzono: dziś'
}

const getSavedActivityStamp = (entry: SavedCalculationEntry) =>
  Date.parse(entry.updated_at ?? entry.created_at ?? '') || 0

const ConfirmDialog = ({
  request,
  onCancel,
  onConfirm,
}: {
  request: ConfirmRequest
  onCancel: () => void
  onConfirm: () => void
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButtonRef.current?.focus()
  }, [])

  return (
    <div className="confirm-backdrop">
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onCancel()
          }
        }}
      >
        <h3 id="confirm-dialog-title">{request.title}</h3>
        <p id="confirm-dialog-message">{request.message}</p>
        <div className="confirm-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
            Anuluj
          </button>
          <button type="button" className="primary-button" onClick={onConfirm}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [saveDraftName, setSaveDraftName] = useState('')
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculationEntry[]>([])
  const [invalidSavedCount, setInvalidSavedCount] = useState(0)
  const [activeCalculation, setActiveCalculation] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [openYears, setOpenYears] = useState<number[] | null>(null)
  const [savedCalculationsExpanded, setSavedCalculationsExpanded] = useState(false)
  const [lastSavedForm, setLastSavedForm] = useState<FormState>(initialForm)
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string }>({
    type: 'success',
    text: '',
  })
  const [isAuthMessageVisible, setIsAuthMessageVisible] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(lastSavedForm)
  const shouldWarnAboutChanges = Boolean(currentUserEmail) && hasUnsavedChanges

  useEffect(() => {
    if (!shouldWarnAboutChanges) {
      return
    }

    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()

    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [shouldWarnAboutChanges])

  const savedCalculationSummaries = useMemo(
    () =>
      new Map(
        savedCalculations.map((entry) => {
          const savedForm = payloadToFormState(entry.payload)
          const savedSummary = calculateLoanSummary(buildLoanInput(savedForm))

          return [
            entry.id,
            {
              amount: savedForm.amount,
              years: savedForm.years,
              rate: savedForm.rate,
              monthlyPayment: savedSummary.monthlyPayment,
            },
          ] as const
        }),
      ),
    [savedCalculations],
  )

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
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
      return
    }

    let invalidCount = 0
    const normalized = (data ?? [])
      .map((entry) => {
        const payload = normalizeSavedCalculationPayload(
          entry.payload as unknown,
          getLegacyLoanStartDate(entry.created_at ?? undefined),
        )

        if (!payload) {
          invalidCount += 1
          return null
        }

        return {
          id: entry.id,
          name: entry.name ?? 'Zapisana kalkulacja',
          payload,
          created_at: entry.created_at ?? undefined,
          updated_at: entry.updated_at ?? undefined,
        }
      })
      .filter(Boolean) as SavedCalculationEntry[]

    normalized.sort((a, b) => getSavedActivityStamp(b) - getSavedActivityStamp(a))

    setSavedCalculations(normalized)
    setInvalidSavedCount(invalidCount)
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

  const discardChangesThen = (action: () => void, message: string) => {
    if (!shouldWarnAboutChanges) {
      action()
      return
    }

    setConfirmRequest({
      title: 'Niezapisane zmiany',
      message,
      confirmLabel: 'Odrzuć zmiany',
      onConfirm: action,
    })
  }

  const detachActiveCalculation = () => {
    setActiveCalculation(null)
    setLastSavedForm(initialForm)
  }

  const performLogout = async () => {
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
    setInvalidSavedCount(0)
    setSaveDraftName('')
    setRenamingId(null)
    setSavedCalculationsExpanded(false)
    detachActiveCalculation()
    setAuthMessage({ type: 'success', text: 'Wylogowano.' })
  }

  const handleLogout = () =>
    discardChangesThen(
      () => void performLogout(),
      'Wylogowanie odrzuci niezapisane zmiany w kalkulacji.',
    )

  const isSaveButtonInactive = activeCalculation ? !hasUnsavedChanges : false

  const focusNameInput = () => {
    setSavedCalculationsExpanded(true)
    window.setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  const handleSaveCurrentCalculationClick = () => {
    if (isSaveButtonInactive) {
      return
    }

    if (!activeCalculation) {
      focusNameInput()
      return
    }

    void handleSaveCurrentCalculation()
  }

  const saveNewCalculation = async () => {
    if (!supabase || !isSupabaseConfigured || !currentUserId) {
      setAuthMessage({ type: 'error', text: 'Zaloguj się, aby zapisać kalkulację.' })
      return
    }

    const name = saveDraftName.trim() || `Kalkulacja ${new Date().toLocaleDateString('pl-PL')}`

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

    setSaveDraftName('')
    setActiveCalculation(data?.id ? { id: data.id, name } : null)
    setLastSavedForm(form)
    setAuthMessage({ type: 'success', text: 'Kalkulacja została zapisana.' })
    await loadSavedCalculations(currentUserId)
  }

  const handleSaveCurrentCalculation = async () => {
    if (!supabase || !isSupabaseConfigured || !currentUserId) {
      setAuthMessage({ type: 'error', text: 'Zaloguj się, aby zapisać kalkulację.' })
      return
    }

    if (!activeCalculation) {
      await saveNewCalculation()
      return
    }

    const { data, error } = await supabase
      .from('saved_calculations')
      .update({ payload: form })
      .eq('id', activeCalculation.id)
      .eq('user_id', currentUserId)
      .select('id')

    if (error) {
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
      return
    }

    if (!data || data.length === 0) {
      detachActiveCalculation()
      setAuthMessage({
        type: 'error',
        text: 'Nie znaleziono zapisu. Może został usunięty – zapisz kalkulację jako nową.',
      })
      await loadSavedCalculations(currentUserId)
      return
    }

    setLastSavedForm(form)
    setAuthMessage({ type: 'success', text: 'Zapisano zmiany.' })
    await loadSavedCalculations(currentUserId)
  }

  const loadCalculation = (entry: SavedCalculationEntry) => {
    const loadedForm = payloadToFormState(entry.payload)

    setForm(loadedForm)
    setLastSavedForm(loadedForm)
    setActiveCalculation({ id: entry.id, name: entry.name })
    setRenamingId(null)
    setSavedCalculationsExpanded(false)
    setAuthMessage({ type: 'success', text: `Wczytano zapis: ${entry.name}.` })
  }

  const handleLoadSavedCalculation = (entry: SavedCalculationEntry) =>
    discardChangesThen(
      () => loadCalculation(entry),
      `Wczytanie „${entry.name}” odrzuci niezapisane zmiany w bieżącej kalkulacji.`,
    )

  const startNewCalculation = () =>
    discardChangesThen(() => {
      setForm(initialForm)
      setLastSavedForm(initialForm)
      setActiveCalculation(null)
      setSaveDraftName('')
      setRenamingId(null)
    }, 'Rozpoczęcie nowej kalkulacji odrzuci niezapisane zmiany.')

  const deleteSavedCalculation = async (entry: SavedCalculationEntry) => {
    if (!supabase || !isSupabaseConfigured || !currentUserId) {
      setAuthMessage({ type: 'error', text: 'Zaloguj się, aby usunąć zapis.' })
      return
    }

    const { error } = await supabase
      .from('saved_calculations')
      .delete()
      .eq('id', entry.id)
      .eq('user_id', currentUserId)

    if (error) {
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
      return
    }

    setRenamingId(null)

    if (activeCalculation?.id === entry.id) {
      detachActiveCalculation()
      setAuthMessage({
        type: 'success',
        text: 'Zapis został usunięty. Bieżąca kalkulacja nie jest już zapisana.',
      })
    } else {
      setAuthMessage({ type: 'success', text: 'Zapis został usunięty.' })
    }

    await loadSavedCalculations(currentUserId)
  }

  const handleDeleteSavedCalculation = (entry: SavedCalculationEntry) =>
    setConfirmRequest({
      title: 'Usunąć zapis?',
      message: `Zapis „${entry.name}” zostanie usunięty bezpowrotnie.`,
      confirmLabel: 'Usuń',
      onConfirm: () => void deleteSavedCalculation(entry),
    })

  const startRename = (entry: SavedCalculationEntry) => {
    setRenamingId(entry.id)
    setRenameValue(entry.name)
  }

  const submitRename = async (entry: SavedCalculationEntry) => {
    const name = renameValue.trim()

    if (!name) {
      setAuthMessage({ type: 'error', text: 'Nazwa zapisu nie może być pusta.' })
      return
    }

    if (name === entry.name) {
      setRenamingId(null)
      return
    }

    if (!supabase || !isSupabaseConfigured || !currentUserId) {
      setAuthMessage({ type: 'error', text: 'Zaloguj się, aby zmienić nazwę zapisu.' })
      return
    }

    const { data, error } = await supabase
      .from('saved_calculations')
      .update({ name })
      .eq('id', entry.id)
      .eq('user_id', currentUserId)
      .select('id')

    if (error) {
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
      return
    }

    if (!data || data.length === 0) {
      setAuthMessage({ type: 'error', text: 'Nie znaleziono zapisu. Mogło go usunąć inne okno.' })
      setRenamingId(null)
      await loadSavedCalculations(currentUserId)
      return
    }

    if (activeCalculation?.id === entry.id) {
      setActiveCalculation({ id: entry.id, name })
    }

    setRenamingId(null)
    setAuthMessage({ type: 'success', text: 'Zmieniono nazwę zapisu.' })
    await loadSavedCalculations(currentUserId)
  }

  const getLifeInsuranceMonths = (currentForm: FormState) => {
    const months = currentForm.lifeInsuranceMonths || 0
    const units = currentForm.lifeInsuranceDurationUnit || 'months'
    return units === 'years' ? Math.round(months * 12) : months
  }

  const getLifeInsuranceMonthlyPremium = (currentForm: FormState, balance?: number) => {
    if (currentForm.lifeInsuranceCalculationType === 'percentage') {
      const rateDecimal = (Number(currentForm.lifeInsuranceRatePercent) || 0) / 100
      const base = balance !== undefined ? balance : currentForm.amount
      return Math.max(0, base * rateDecimal)
    }

    return Math.max(0, Number(currentForm.lifeInsuranceMonthlyPremium) || 0)
  }

  const getPropertyInsuranceMonthlyPremium = (currentForm: FormState) => {
    if (currentForm.propertyInsuranceCalculationType === 'amount') {
      const amount = Math.max(0, Number(currentForm.propertyInsuranceAmount) || 0)
      return currentForm.propertyInsuranceFrequency === 'annual'
        ? amount / 12
        : amount
    }

    const propertyBase =
      currentForm.propertyInsuranceBasis === 'loanAmount' ? currentForm.amount : currentForm.propertyValue
    const rateDecimal = (Number(currentForm.propertyInsuranceRatePercent) || 0) / 100
    const annualPremium = Math.max(0, propertyBase * rateDecimal)

    return currentForm.propertyInsuranceFrequency === 'annual'
      ? annualPremium / 12
      : annualPremium
  }

  const getApplicationFee = (currentForm: FormState) =>
    currentForm.applicationFeeCalculationType === 'percentage'
      ? Math.max(0, currentForm.amount * ((Number(currentForm.applicationFeePercent) || 0) / 100))
      : currentForm.applicationFee

  const getMonthlyAdditionalCost = (
    monthNumber: number,
    currentForm: FormState,
    balance?: number,
  ) => {
    const firstMonthFee =
      getApplicationFee(currentForm) +
      currentForm.notary +
      currentForm.appraisal +
      currentForm.commission

    const lifeInsurancePeriod = getLifeInsuranceMonths(currentForm)
    const lifeInsuranceCost =
      monthNumber <= lifeInsurancePeriod
        ? getLifeInsuranceMonthlyPremium(currentForm, balance)
        : 0

    const propertyInsuranceCost = getPropertyInsuranceMonthlyPremium(currentForm)

    return monthNumber === 1 ? firstMonthFee + lifeInsuranceCost + propertyInsuranceCost : lifeInsuranceCost + propertyInsuranceCost
  }

  const summary = useMemo(() => calculateLoanSummary(buildLoanInput(form)), [form])

  const hasOverpayments =
    form.regularOverpayments.some((entry) => entry.amount > 0) ||
    form.extraPayments.some((payment) => payment.amount > 0)

  const baselineSummary = useMemo(
    () =>
      hasOverpayments
        ? calculateLoanSummary(
            buildLoanInput({ ...form, regularOverpayments: [], extraPayments: [] }),
          )
        : null,
    [form, hasOverpayments],
  )

  const totalAdditionalCosts = useMemo(() => {
    return summary.schedule
      .map((_, index) => {
        const startBalance =
          index === 0 ? form.amount : summary.schedule[index - 1]?.remainingBalance ?? 0
        return getMonthlyAdditionalCost(index + 1, form, startBalance)
      })
      .reduce((sum, value) => sum + value, 0)
  }, [form, summary.schedule])

  const totalCost = summary.totalPaid + totalAdditionalCosts
  const monthlyBurden =
    summary.monthlyPayment + totalAdditionalCosts / Math.max(summary.loanTermMonths, 1)

  const loanValidationMessages = [
    form.amount <= 0 ? 'Kwota kredytu musi być większa od zera.' : null,
    form.propertyValue > 0 && form.amount > form.propertyValue
      ? 'Kwota kredytu przekracza wartość nieruchomości.'
      : null,
    form.years < 1 || form.years > 40
      ? 'Okres kredytowania powinien mieścić się w zakresie 1–40 lat.'
      : null,
  ].filter((message): message is string => message !== null)

  const ltvPercent =
    form.propertyValue > 0 && form.amount > 0 ? (form.amount / form.propertyValue) * 100 : null
  const ownContribution = Math.max(0, form.propertyValue - form.amount)

  const toMonthIndex = (value: string) => {
    const { year, month } = getMonthYearParts(value)
    return year * 12 + month
  }
  const loanStartIndex = toMonthIndex(form.loanStartDate)
  const loanEndIndex = loanStartIndex + Math.max(summary.loanTermMonths, 1) - 1
  const sortedRateChanges = [...form.rateChanges].sort(
    (a, b) => toMonthIndex(a.date) - toMonthIndex(b.date),
  )

  const getRateChangeWarning = (entry: RateChangeEntry) => {
    const monthIndex = toMonthIndex(entry.date)

    if (monthIndex > loanEndIndex) {
      return 'Zmiana po zako\u0144czeniu sp\u0142aty \u2013 nie wp\u0142ywa na harmonogram.'
    }

    if (sortedRateChanges.filter((other) => toMonthIndex(other.date) === monthIndex).length > 1) {
      return 'Kilka zmian w tym samym miesi\u0105cu \u2013 obowi\u0105zuje ostatnia z listy.'
    }

    if (monthIndex < loanStartIndex) {
      return 'Zmiana sprzed startu kredytu obowi\u0105zuje ju\u017c od pierwszej raty.'
    }

    return null
  }

  const getRegularOverpaymentWarning = (entry: RegularOverpaymentEntry) => {
    const startIndex = toMonthIndex(entry.startDate)

    if (entry.endDate !== '' && toMonthIndex(entry.endDate) < startIndex) {
      return 'Koniec jest przed początkiem – ta nadpłata nie będzie naliczana.'
    }

    if (startIndex > loanEndIndex) {
      return 'Start po zakończeniu spłaty – nadpłata nie wpływa na harmonogram.'
    }

    return null
  }

  const oneTimeOverpaymentCount = form.extraPayments.length
  const regularOverpaymentCount = form.regularOverpayments.length
  const overpaymentBadgeParts = [
    regularOverpaymentCount > 0
      ? `${regularOverpaymentCount} ${pluralize(regularOverpaymentCount, 'regularna', 'regularne', 'regularnych')}`
      : null,
    oneTimeOverpaymentCount > 0
      ? `${oneTimeOverpaymentCount} ${pluralize(oneTimeOverpaymentCount, 'jednorazowa', 'jednorazowe', 'jednorazowych')}`
      : null,
  ].filter((part): part is string => part !== null)
  const overpaymentBadge = overpaymentBadgeParts.length > 0 ? overpaymentBadgeParts.join(' + ') : 'Brak'

  const resetForm = () =>
    discardChangesThen(
      () => setForm(initialForm),
      'Przywrócenie wartości domyślnych odrzuci niezapisane zmiany.',
    )

  const addRateChange = () => {
    setForm((current) => ({
      ...current,
      rateChanges: [
        ...current.rateChanges,
        {
          id: Date.now() + Math.random(),
          date: getDateOffsetMonths(12),
          wibor: current.wibor,
        },
      ],
    }))
  }

  const updateRateChange = (id: number, field: 'date' | 'wibor', value: string | number) => {
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

  const addRegularOverpayment = () => {
    setForm((current) => ({
      ...current,
      regularOverpayments: [
        ...current.regularOverpayments,
        {
          id: Date.now() + Math.random(),
          amount: 500,
          startDate: current.loanStartDate,
          endDate: '',
          effect: 'reduceTerm',
        },
      ],
    }))
  }

  const updateRegularOverpayment = (
    id: number,
    changes: Partial<Omit<RegularOverpaymentEntry, 'id'>>,
  ) => {
    setForm((current) => ({
      ...current,
      regularOverpayments: current.regularOverpayments.map((entry) =>
        entry.id === id ? { ...entry, ...changes } : entry,
      ),
    }))
  }

  const removeRegularOverpayment = (id: number) => {
    setForm((current) => ({
      ...current,
      regularOverpayments: current.regularOverpayments.filter((entry) => entry.id !== id),
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
    const { year: startYear, month: startMonth } = getMonthYearParts(form.loanStartDate)
    const paymentDate = new Date(
      startYear,
      startMonth - 1 + index,
      1,
    )

    const startBalance =
      index === 0
        ? form.amount
        : summary.schedule[index - 1]?.remainingBalance ?? 0

    const rowMonthIndex = paymentDate.getFullYear() * 12 + paymentDate.getMonth() + 1
    const events: ScheduleEvent[] = []

    if (index > 0 && row.annualRate !== summary.schedule[index - 1].annualRate) {
      events.push({ key: 'rate', label: 'Zmiana stopy' })
    }

    if (
      form.extraPayments.some(
        (payment) => payment.amount > 0 && toMonthIndex(payment.date) === rowMonthIndex,
      )
    ) {
      events.push({ key: 'onetime', label: 'Nadpłata jednorazowa' })
    }

    const activeRegularOverpayments = form.regularOverpayments.filter((entry) => {
      const startIndex = Math.max(toMonthIndex(entry.startDate), loanStartIndex)
      return (
        entry.amount > 0 &&
        (entry.endDate === '' || toMonthIndex(entry.endDate) >= startIndex)
      )
    })

    if (
      activeRegularOverpayments.some(
        (entry) => Math.max(toMonthIndex(entry.startDate), loanStartIndex) === rowMonthIndex,
      )
    ) {
      events.push({ key: 'regularStart', label: 'Start nadpłaty regularnej' })
    }

    if (
      activeRegularOverpayments.some(
        (entry) => entry.endDate !== '' && toMonthIndex(entry.endDate) === rowMonthIndex,
      )
    ) {
      events.push({ key: 'regularEnd', label: 'Koniec nadpłaty regularnej' })
    }

    if (index === summary.schedule.length - 1) {
      events.push({ key: 'last', label: 'Ostatnia rata' })
    }

    return {
      ...row,
      paymentDate,
      monthLabel: `${monthNames[paymentDate.getMonth()]} ${paymentDate.getFullYear()}`,
      year: paymentDate.getFullYear(),
      rateChanged: index === 0 || row.annualRate !== summary.schedule[index - 1].annualRate,
      events,
      additionalCosts: getMonthlyAdditionalCost(index + 1, form, startBalance),
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

  const firstPayment = summary.schedule[0]?.payment ?? summary.monthlyPayment
  const lastRegularPayment =
    summary.schedule.length > 1
      ? summary.schedule[summary.schedule.length - 2].payment
      : firstPayment
  const paymentChanges = Math.abs(lastRegularPayment - firstPayment) >= 1
  const paymentLabel =
    form.repaymentType === 'decreasing' || paymentChanges ? 'Pierwsza rata' : 'Rata miesięczna'
  const endMonthLabel = scheduleWithDates[scheduleWithDates.length - 1]?.monthLabel

  const costParts = [
    { key: 'principal', label: 'Kapitał', value: Math.max(0, summary.totalPaid - summary.totalInterest) },
    { key: 'interest', label: 'Odsetki', value: summary.totalInterest },
    { key: 'additional', label: 'Koszty dodatkowe', value: totalAdditionalCosts },
  ]
  const costPartsTotal = costParts.reduce((sum, part) => sum + part.value, 0)

  const interestSaved = baselineSummary
    ? Math.max(0, baselineSummary.totalInterest - summary.totalInterest)
    : 0
  const monthsSaved = baselineSummary
    ? Math.max(0, baselineSummary.loanTermMonths - summary.loanTermMonths)
    : 0

  const sumRows = (rows: typeof scheduleWithDates) =>
    rows.reduce(
      (totals, row) => ({
        payment: totals.payment + row.payment,
        principal: totals.principal + row.principal,
        interest: totals.interest + row.interest,
        extraPayment: totals.extraPayment + row.extraPayment,
        additionalCosts: totals.additionalCosts + row.additionalCosts,
      }),
      { payment: 0, principal: 0, interest: 0, extraPayment: 0, additionalCosts: 0 },
    )

  const yearSections = groupedByYear.map((rows) => ({
    year: rows[0].year,
    rows,
    totals: sumRows(rows),
    endBalance: rows[rows.length - 1].remainingBalance,
  }))
  const scheduleTotals = sumRows(scheduleWithDates)
  const defaultOpenYears = yearSections.length > 0 ? [yearSections[0].year] : []
  const isYearOpen = (year: number) => (openYears ?? defaultOpenYears).includes(year)

  const toggleYear = (year: number) =>
    setOpenYears((current) => {
      const base = current ?? defaultOpenYears
      return base.includes(year) ? base.filter((openYear) => openYear !== year) : [...base, year]
    })
  const expandAllYears = () => setOpenYears(yearSections.map((section) => section.year))
  const collapseAllYears = () => setOpenYears([])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value }

      if (key === 'wibor' || key === 'margin') {
        const wibor = key === 'wibor' ? Number(value) || 0 : current.wibor
        const margin = key === 'margin' ? Number(value) || 0 : current.margin
        return { ...next, rate: getAnnualRateFromSplit(wibor, margin) }
      }

      return next
    })
  }

  const changeLifeInsuranceUnit = (unit: FormState['lifeInsuranceDurationUnit']) => {
    setForm((current) => {
      if (current.lifeInsuranceDurationUnit === unit) {
        return current
      }

      const value = Number(current.lifeInsuranceMonths) || 0
      const converted =
        unit === 'years'
          ? Math.floor(value / 12)
          : Math.floor(value * 12)

      return {
        ...current,
        lifeInsuranceDurationUnit: unit,
        lifeInsuranceMonths: converted,
      }
    })
  }

  const handleApplicationFeeCalculationTypeChange = (
    calculationType: 'percentage' | 'amount',
  ) => {
    setForm((current) => {
      if (current.applicationFeeCalculationType === calculationType) {
        return current
      }

      return calculationType === 'amount'
        ? {
            ...current,
            applicationFeeCalculationType: calculationType,
            applicationFee: Number(getApplicationFee(current).toFixed(2)),
          }
        : {
            ...current,
            applicationFeeCalculationType: calculationType,
            applicationFeePercent:
              current.amount > 0
                ? Number(((current.applicationFee / current.amount) * 100).toFixed(4))
                : 0,
          }
    })
  }

  const handleLifeInsuranceCalculationTypeChange = (
    calculationType: 'percentage' | 'amount',
  ) => {
    setForm((current) => ({
      ...current,
      lifeInsuranceCalculationType: calculationType,
      lifeInsuranceMonthlyPremium:
        calculationType === 'amount'
          ? Number(
              getLifeInsuranceMonthlyPremium({
                ...current,
                lifeInsuranceCalculationType: 'percentage',
              }).toFixed(2),
            )
          : current.lifeInsuranceMonthlyPremium,
    }))
  }

  const handlePropertyInsuranceCalculationTypeChange = (
    calculationType: 'percentage' | 'amount',
  ) => {
    setForm((current) => ({
      ...current,
      propertyInsuranceCalculationType: calculationType,
      propertyInsuranceAmount:
        calculationType === 'amount'
          ? Number(
              getPropertyInsuranceMonthlyPremium({
                ...current,
                propertyInsuranceCalculationType: 'percentage',
              }).toFixed(2),
            )
          : current.propertyInsuranceAmount,
    }))
  }

  return (
    <>
    <nav className="site-nav" aria-label="Nawigacja główna">
      <span className="site-nav-brand">Kredyt hipoteczny</span>
      <div className="site-nav-links">
        <a href="#dane-podstawowe">Dane</a>
        <a href="#podsumowanie">Podsumowanie</a>
        <a href="#harmonogram">Harmonogram</a>
      </div>
    </nav>

    <header className="hero">
      <div className="hero-inner">
        <p className="eyebrow">Pełna kontrola nad kosztem kredytu</p>
        <div className="hero-actions">
          <a className="hero-button hero-button-primary" href="#dane-podstawowe">
            Oblicz ratę
          </a>
          <button type="button" className="hero-button" onClick={resetForm}>
            Przywróć domyślne
          </button>
        </div>
      </div>
    </header>

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
                  title={activeCalculation ? 'Zapisz zmiany' : 'Zapisz'}
                  aria-label={activeCalculation ? 'Zapisz zmiany' : 'Zapisz'}
                >
                  <svg
                    className="save-icon"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="square"
                    aria-hidden="true"
                  >
                    <path d="M12 4v11M7 10.5l5 5 5-5M4 19.5h16" />
                  </svg>
                  <span className="save-disk-label">
                    {activeCalculation ? 'Zapisz zmiany' : 'Zapisz'}
                  </span>
                </button>

                {activeCalculation || hasUnsavedChanges ? (
                  <span
                    className={hasUnsavedChanges ? 'save-status is-dirty' : 'save-status'}
                    role="status"
                  >
                    {activeCalculation ? (
                      <strong className="save-status-name">{activeCalculation.name}</strong>
                    ) : null}
                    <span>
                      {hasUnsavedChanges
                        ? activeCalculation
                          ? 'Niezapisane zmiany'
                          : 'Niezapisana kalkulacja'
                        : 'Zapisano'}
                    </span>
                  </span>
                ) : null}
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
            <form
              className="saved-toolbar"
              onSubmit={(event) => {
                event.preventDefault()
                void saveNewCalculation()
              }}
            >
              <input
                ref={nameInputRef}
                type="text"
                value={saveDraftName}
                onChange={(event) => setSaveDraftName(event.target.value)}
                placeholder="Nazwa kalkulacji"
                aria-label="Nazwa kalkulacji"
              />
              <button type="submit" className="primary-button">
                {activeCalculation ? 'Zapisz jako kopię' : 'Zapisz nową kalkulację'}
              </button>
              <button type="button" className="secondary-button" onClick={startNewCalculation}>
                Nowa kalkulacja
              </button>
            </form>

            {invalidSavedCount > 0 ? (
              <p className="empty-state">
                Nie udało się odczytać zapisów: {invalidSavedCount} (nieprawidłowy format danych).
              </p>
            ) : null}

            {savedCalculations.length === 0 ? (
              <p className="empty-state">Brak zapisanych kalkulacji. Zapisz bieżący scenariusz, aby wrócić do niego później.</p>
            ) : (
              <ul className="saved-list">
                {savedCalculations.map((entry) => {
                  const isActive = activeCalculation?.id === entry.id
                  const entrySummary = savedCalculationSummaries.get(entry.id)

                  return (
                    <li
                      key={entry.id}
                      className={isActive ? 'saved-item is-active' : 'saved-item'}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <div className="saved-summary">
                        {renamingId === entry.id ? (
                          <form
                            className="rename-form"
                            onSubmit={(event) => {
                              event.preventDefault()
                              void submitRename(entry)
                            }}
                          >
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(event) => setRenameValue(event.target.value)}
                              aria-label="Nowa nazwa zapisu"
                              autoFocus
                            />
                            <button type="submit" className="secondary-button">
                              Zapisz nazwę
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setRenamingId(null)}
                            >
                              Anuluj
                            </button>
                          </form>
                        ) : (
                          <strong>
                            {entry.name}
                            {isActive ? <span className="saved-badge">Otwarta</span> : null}
                          </strong>
                        )}
                        {entrySummary ? (
                          <span>
                            {formatCurrency(entrySummary.amount)} · {entrySummary.years} {pluralize(entrySummary.years, 'rok', 'lata', 'lat')} ·{' '}
                            {formatPercent(entrySummary.rate)} · rata{' '}
                            {formatCurrency(entrySummary.monthlyPayment)}
                          </span>
                        ) : null}
                        <span>{getSavedDateLabel(entry)}</span>
                      </div>
                      <div className="saved-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleLoadSavedCalculation(entry)}
                        >
                          Wczytaj
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => startRename(entry)}
                        >
                          Zmień nazwę
                        </button>
                        <button
                          type="button"
                          className="remove-button"
                          onClick={() => handleDeleteSavedCalculation(entry)}
                        >
                          Usuń
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <main className="app-grid">
        <section className="panel form-panel" id="dane-podstawowe">
          <h2>Dane podstawowe</h2>

          <div className="field-grid">
            <label>
              <span className="field-title">
                Kwota kredytu
                <FieldTooltip id="loan-amount-help" text="Całkowita kwota, którą chcesz pożyczyć" />
              </span>
              <UnitInput
                unit="zł"
                min="0"
                step="5000"
                value={form.amount}
                onValueChange={(value) => updateField('amount', value)}
              />
            </label>

            <label>
              <span>Wartość nieruchomości</span>
              <UnitInput
                unit="zł"
                min="0"
                step="5000"
                value={form.propertyValue}
                onValueChange={(value) => updateField('propertyValue', value)}
              />
            </label>

            {loanValidationMessages.length > 0 ? (
              <div className="field-warnings full-width" role="status">
                {loanValidationMessages.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            ) : null}

            {ltvPercent !== null ? (
              <p className={ltvPercent > 80 ? 'loan-ltv is-high full-width' : 'loan-ltv full-width'}>
                <span>
                  LTV <strong>{formatPercent(ltvPercent)}</strong>
                </span>
                {ownContribution > 0 ? (
                  <span>
                    Własny wkład <strong>{formatCurrency(ownContribution)}</strong>
                  </span>
                ) : null}
                {ltvPercent > 80 ? <span>Wysokie LTV</span> : null}
              </p>
            ) : null}

            <label>
              <span className="field-title">
                Data startu kredytu
                <FieldTooltip id="loan-start-help" text="Miesiąc i rok uruchomienia kredytu, od którego liczony jest harmonogram" />
              </span>
              <MonthYearInput
                value={form.loanStartDate}
                onChange={(value) => updateField('loanStartDate', value)}
              />
            </label>

            <div className="field-grid interest-rate-row full-width">
              <label>
                <span className="field-title">
                  WIBOR
                  <FieldTooltip id="loan-rate-help" text="Roczna stopa procentowa WIBOR" />
                </span>
                <UnitInput
                  unit="%"
                  min="0"
                  step="0.1"
                  value={form.wibor}
                  onValueChange={(value) => updateField('wibor', value)}
                />
              </label>

              <label>
                <span className="field-title">
                  Marża
                  <FieldTooltip id="loan-margin-help" text="Marża banku dodawana do WIBOR-u" />
                </span>
                <UnitInput
                  unit="%"
                  min="0"
                  step="0.1"
                  value={form.margin}
                  onValueChange={(value) => updateField('margin', value)}
                />
              </label>

              <label>
                <span className="field-title">
                  Oprocentowanie
                  <FieldTooltip id="loan-rate-total-help" text="Suma WIBOR-u i marży" />
                </span>
                <UnitInput
                  unit="%"
                  min="0"
                  step="0.1"
                  value={form.rate}
                  readOnly
                  aria-readonly="true"
                />
              </label>
            </div>

            <div className="field-grid compact full-width">
              <label>
                <span className="field-title">
                  Okres kredytowania
                  <FieldTooltip id="loan-term-help" text="Na ile lat rozciągasz spłatę" />
                </span>
                <UnitInput
                  unit="lat"
                  min="1"
                  max="40"
                  step="1"
                  value={form.years}
                  onValueChange={(value) => updateField('years', value)}
                />
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
                  <option value="annuity">Raty równe (annuitetowe)</option>
                  <option value="decreasing">Raty malejące</option>
                </select>
              </label>
            </div>
          </div>

          <p className="form-section-label">
            Dodatkowe parametry <span>opcjonalne</span>
          </p>

          <details className="subsection collapsible-section">
            <summary>
              Koszty około-kredytowe
              <span className="section-badge">Łącznie {formatCurrency(totalAdditionalCosts)}</span>
            </summary>
            <div className="field-grid compact">
              <div className="field-group full-width">
                <span>Prowizja</span>
                <SegmentedControl
                  label="Sposób naliczania prowizji"
                  value={form.applicationFeeCalculationType}
                  options={calculationTypeOptions}
                  onChange={handleApplicationFeeCalculationTypeChange}
                />
              </div>

              {form.applicationFeeCalculationType === 'percentage' ? (
                <>
                  <label>
                    <span>Stawka prowizji</span>
                    <UnitInput
                      unit="%"
                      aria-label="Stawka prowizji"
                      min="0"
                      step="0.01"
                      value={form.applicationFeePercent}
                      onValueChange={(value) => updateField('applicationFeePercent', value)}
                    />
                  </label>

                  <label>
                    <span>Kwota prowizji</span>
                    <UnitInput
                      unit="zł"
                      aria-label="Kwota prowizji"
                      value={Number(getApplicationFee(form).toFixed(2))}
                      readOnly
                      aria-readonly="true"
                    />
                  </label>
                </>
              ) : (
                <label>
                  <span>Kwota prowizji</span>
                  <UnitInput
                    unit="zł"
                    aria-label="Kwota prowizji"
                    min="0"
                    step="100"
                    value={form.applicationFee}
                    onValueChange={(value) => updateField('applicationFee', value)}
                  />
                </label>
              )}

              <label>
                <span>Notariusz / dokumenty</span>
                <UnitInput
                  unit="zł"
                  min="0"
                  step="100"
                  value={form.notary}
                  onValueChange={(value) => updateField('notary', value)}
                />
              </label>

              <label>
                <span>Wycena / ekspertyza</span>
                <UnitInput
                  unit="zł"
                  min="0"
                  step="100"
                  value={form.appraisal}
                  onValueChange={(value) => updateField('appraisal', value)}
                />
              </label>

              <label>
                <span>Inne</span>
                <UnitInput
                  unit="zł"
                  min="0"
                  step="100"
                  value={form.commission}
                  onValueChange={(value) => updateField('commission', value)}
                />
              </label>
            </div>

            <div className="insurance-block">
              <h4>Ubezpieczenie na życie</h4>
              <div className="field-grid compact">
                <div className="field-group full-width">
                  <span>Sposób naliczania</span>
                  <SegmentedControl
                    label="Sposób naliczania ubezpieczenia na życie"
                    value={form.lifeInsuranceCalculationType}
                    options={calculationTypeOptions}
                    onChange={handleLifeInsuranceCalculationTypeChange}
                  />
                </div>

                {form.lifeInsuranceCalculationType === 'percentage' ? (
                  <>
                    <label>
                      <span>Stawka ubezpieczenia</span>
                      <UnitInput
                        unit="%"
                        aria-label="Stawka ubezpieczenia na życie"
                        min="0"
                        step="0.01"
                        value={form.lifeInsuranceRatePercent}
                        onValueChange={(value) => updateField('lifeInsuranceRatePercent', value)}
                      />
                    </label>

                    <label>
                      <span>Składka miesięczna</span>
                      <UnitInput
                        unit="zł"
                        aria-label="Składka miesięczna ubezpieczenia na życie"
                        min="0"
                        step="0.01"
                        value={Number(getLifeInsuranceMonthlyPremium(form).toFixed(2))}
                        readOnly
                        aria-readonly="true"
                      />
                    </label>

                    <p className="field-note full-width">
                      Stawka miesięczna liczona od aktualnego salda kredytu. Wyświetlona składka
                      dotyczy pierwszego miesiąca.
                    </p>
                  </>
                ) : (
                  <label>
                    <span>Składka miesięczna</span>
                    <UnitInput
                      unit="zł"
                      aria-label="Składka miesięczna ubezpieczenia na życie"
                      min="0"
                      step="10"
                      value={form.lifeInsuranceMonthlyPremium}
                      onValueChange={(value) => updateField('lifeInsuranceMonthlyPremium', value)}
                    />
                  </label>
                )}

                <label>
                  <span>Czas ubezpieczenia</span>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      aria-label="Czas ubezpieczenia"
                      min="0"
                      step={form.lifeInsuranceDurationUnit === 'years' ? '1' : '1'}
                      value={form.lifeInsuranceMonths}
                      onChange={(event) => updateField('lifeInsuranceMonths', Number(event.target.value))}
                    />
                    <div className="unit-toggle" role="group" aria-label="Jednostka czasu">
                      {(['months', 'years'] as const).map((unit) => (
                        <button
                          key={unit}
                          type="button"
                          aria-pressed={form.lifeInsuranceDurationUnit === unit}
                          onClick={() => changeLifeInsuranceUnit(unit)}
                        >
                          {unit === 'months' ? 'Miesiące' : 'Lata'}
                        </button>
                      ))}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="insurance-block">
              <h4>Ubezpieczenie nieruchomości</h4>
              <div className="field-grid compact">
                <div className="field-group full-width">
                  <span>Sposób naliczania</span>
                  <SegmentedControl
                    label="Sposób naliczania ubezpieczenia nieruchomości"
                    value={form.propertyInsuranceCalculationType}
                    options={calculationTypeOptions}
                    onChange={handlePropertyInsuranceCalculationTypeChange}
                  />
                </div>

                {form.propertyInsuranceCalculationType === 'percentage' ? (
                  <>
                    <label>
                      <span>Stawka ubezpieczenia</span>
                      <UnitInput
                        unit="%"
                        aria-label="Stawka ubezpieczenia nieruchomości"
                        min="0"
                        step="0.01"
                        value={form.propertyInsuranceRatePercent}
                        onValueChange={(value) => updateField('propertyInsuranceRatePercent', value)}
                      />
                    </label>

                    <label>
                      <span>Składka miesięczna</span>
                      <UnitInput
                        unit="zł"
                        aria-label="Składka ubezpieczenia nieruchomości"
                        min="0"
                        step="0.01"
                        value={Number(getPropertyInsuranceMonthlyPremium(form).toFixed(2))}
                        readOnly
                        aria-readonly="true"
                      />
                    </label>

                    <label>
                      <span>Częstotliwość składki</span>
                      <select
                        aria-label="Częstotliwość składki ubezpieczenia nieruchomości"
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
                  </>
                ) : (
                  <>
                    <label>
                      <span>Składka</span>
                      <UnitInput
                        unit="zł"
                        aria-label="Składka ubezpieczenia nieruchomości"
                        min="0"
                        step="0.01"
                        value={form.propertyInsuranceAmount}
                        onValueChange={(value) => updateField('propertyInsuranceAmount', value)}
                      />
                    </label>

                    <label>
                      <span>Częstotliwość składki</span>
                      <select
                        aria-label="Częstotliwość składki ubezpieczenia nieruchomości"
                        value={form.propertyInsuranceFrequency}
                        onChange={(event) =>
                          updateField('propertyInsuranceFrequency', event.target.value as 'monthly' | 'annual')
                        }
                      >
                        <option value="monthly">Miesięcznie</option>
                        <option value="annual">Rocznie</option>
                      </select>
                    </label>
                  </>
                )}
              </div>
            </div>
          </details>

          <details className="subsection collapsible-section">
            <summary>
              Zmiany oprocentowania
              <span className="section-badge">
                {form.rateChanges.length === 0
                  ? 'Brak'
                  : `${form.rateChanges.length} ${pluralize(form.rateChanges.length, 'zmiana', 'zmiany', 'zmian')}`}
              </span>
            </summary>
            <div className="extra-payment-list">
              <div className="extra-payment-header is-end">
                <button type="button" className="secondary-button" onClick={addRateChange}>
                  + Dodaj zmianę
                </button>
              </div>

              {form.rateChanges.length === 0 ? (
                <p className="empty-state">Brak zmian oprocentowania. Dodaj datę i nowy WIBOR, aby zmienić odsetki od wybranego momentu. Marża zostaje bez zmian.</p>
              ) : (
                sortedRateChanges.map((entry) => {
                  const warning = getRateChangeWarning(entry)

                  return (
                    <div key={entry.id} className="row-with-note">
                      <div className="extra-payment-row">
                        <label>
                          <span>Nowy WIBOR</span>
                          <UnitInput
                            unit="%"
                            min="0"
                            step="0.1"
                            value={entry.wibor}
                            onValueChange={(value) => updateRateChange(entry.id, 'wibor', value)}
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
                          className="remove-button icon-button"
                          aria-label="Usuń zmianę oprocentowania"
                          onClick={() => removeRateChange(entry.id)}
                        >
                          ×
                        </button>
                      </div>
                      <p className="field-note">
                        Oprocentowanie po zmianie:{' '}
                        <strong>{formatPercent(getAnnualRateFromSplit(entry.wibor, form.margin))}</strong>{' '}
                        (WIBOR + marża {formatPercent(form.margin)})
                      </p>
                      {warning ? <p className="row-note">{warning}</p> : null}
                    </div>
                  )
                })
              )}
            </div>
          </details>

          <details className="subsection collapsible-section">
            <summary>
              Nadpłaty
              <span className="section-badge">{overpaymentBadge}</span>
            </summary>
            <div className="extra-payment-list">
              <div className="extra-payment-header is-end">
                <button type="button" className="secondary-button" onClick={addRegularOverpayment}>
                  + Dodaj nadpłatę regularną
                </button>
                <button type="button" className="secondary-button" onClick={addExtraPayment}>
                  + Dodaj nadpłatę jednorazową
                </button>
              </div>

              {form.regularOverpayments.length === 0 && form.extraPayments.length === 0 ? (
                <p className="empty-state">Brak nadpłat. Dodaj nadpłatę regularną (co miesiąc, z datą startu i końca) albo jednorazową.</p>
              ) : null}

              {form.regularOverpayments.map((entry) => {
                const warning = getRegularOverpaymentWarning(entry)

                return (
                  <div key={entry.id} className="row-with-note">
                    <div className="extra-payment-row is-recurring">
                      <span className="row-tag">Regularna</span>
                      <label>
                        <span>Kwota miesięczna</span>
                        <UnitInput
                          unit="zł"
                          min="0"
                          step="100"
                          value={entry.amount}
                          onValueChange={(value) =>
                            updateRegularOverpayment(entry.id, { amount: value })
                          }
                        />
                      </label>
                      <label>
                        <span>Efekt</span>
                        <select
                          value={entry.effect}
                          onChange={(event) =>
                            updateRegularOverpayment(entry.id, {
                              effect: event.target.value as ExtraPaymentMode,
                            })
                          }
                        >
                          <option value="reduceTerm">Skrócenie okresu</option>
                          <option value="reduceInstallment">Obniżenie raty</option>
                        </select>
                        <small className="field-note">
                          {entry.effect === 'reduceTerm'
                            ? 'Rata zostaje bez zmian, a nadpłata skraca okres spłaty.'
                            : 'Rata jest przeliczana po każdej nadpłacie dla pozostałego okresu.'}
                        </small>
                      </label>
                      <label>
                        <span>Od</span>
                        <MonthYearInput
                          value={entry.startDate}
                          onChange={(value) =>
                            updateRegularOverpayment(entry.id, { startDate: value })
                          }
                        />
                      </label>
                      <div className="field-group">
                        <span>Do</span>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={entry.endDate === ''}
                            onChange={(event) =>
                              updateRegularOverpayment(entry.id, {
                                endDate: event.target.checked
                                  ? ''
                                  : addMonthsToDate(entry.startDate, 24),
                              })
                            }
                          />
                          Do końca kredytu
                        </label>
                        {entry.endDate !== '' ? (
                          <MonthYearInput
                            value={entry.endDate}
                            onChange={(value) =>
                              updateRegularOverpayment(entry.id, { endDate: value })
                            }
                          />
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="remove-button icon-button"
                        aria-label="Usuń nadpłatę regularną"
                        onClick={() => removeRegularOverpayment(entry.id)}
                      >
                        ×
                      </button>
                    </div>
                    {warning ? <p className="row-note">{warning}</p> : null}
                  </div>
                )
              })}

              {form.extraPayments.map((payment) => (
                <div key={payment.id} className="extra-payment-row">
                  <span className="row-tag">Jednorazowa</span>
                  <label>
                    <span>Kwota</span>
                    <UnitInput
                      unit="zł"
                      min="0"
                      step="100"
                      value={payment.amount}
                      onValueChange={(value) => updateExtraPayment(payment.id, 'amount', value)}
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
                    className="remove-button icon-button"
                    aria-label="Usuń nadpłatę"
                    onClick={() => removeExtraPayment(payment.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </details>

        </section>

        <aside className="panel summary-panel" id="podsumowanie">
          <h2>Podsumowanie</h2>

          <div className="summary-cards">
            <article className="summary-highlight">
              <span>{paymentLabel}</span>
              <strong>{formatCurrency(firstPayment)}</strong>
              {paymentChanges ? (
                <small>Ostatnia rata: {formatCurrency(lastRegularPayment)}</small>
              ) : null}
            </article>
            <article>
              <span>Okres spłaty</span>
              <strong>{formatDuration(summary.loanTermMonths)}</strong>
              {endMonthLabel ? <small>do: {endMonthLabel}</small> : null}
            </article>
            <article>
              <span>Obciążenie miesięczne</span>
              <strong>{formatCurrency(monthlyBurden)}</strong>
              <small>rata + średnie koszty dodatkowe</small>
            </article>
          </div>

          <div className="cost-breakdown">
            <div className="cost-breakdown-header">
              <span>Całkowity koszt</span>
              <strong>{formatCurrency(totalCost)}</strong>
            </div>
            <div
              className="cost-bar"
              role="img"
              aria-label="Struktura kosztu: kapitał, odsetki i koszty dodatkowe"
            >
              {costParts.map((part) => (
                <span
                  key={part.key}
                  className={`cost-bar-segment cost-tone-${part.key}`}
                  style={{ flexGrow: part.value }}
                />
              ))}
            </div>
            <ul className="cost-legend">
              {costParts.map((part) => (
                <li key={part.key}>
                  <span className={`cost-dot cost-tone-${part.key}`} aria-hidden="true" />
                  <span>{part.label}</span>
                  <strong>{formatCurrency(part.value)}</strong>
                  <small>
                    {costPartsTotal > 0 ? Math.round((part.value / costPartsTotal) * 100) : 0}%
                  </small>
                </li>
              ))}
            </ul>
          </div>

          {hasOverpayments && (interestSaved > 0 || monthsSaved > 0) ? (
            <div className="savings-box">
              <h3>Efekt nadpłat</h3>
              <div>
                <span>Mniej odsetek</span>
                <strong>{formatCurrency(interestSaved)}</strong>
              </div>
              {monthsSaved > 0 ? (
                <div>
                  <span>Krótszy okres</span>
                  <strong>{formatDuration(monthsSaved)}</strong>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </main>

      <section className="panel schedule-panel" id="harmonogram">
        <div className="section-header">
          <h2>Harmonogram spłat</h2>
          <div className="schedule-actions">
            <button type="button" className="secondary-button" onClick={expandAllYears}>
              Rozwiń wszystko
            </button>
            <button type="button" className="secondary-button" onClick={collapseAllYears}>
              Zwiń wszystko
            </button>
          </div>
        </div>

        <div className="schedule-table">
          <table>
            <caption className="visually-hidden">Harmonogram spłat</caption>
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Miesiąc</th>
                <th scope="col" className="num">Oprocentowanie</th>
                <th scope="col" className="num">Rata</th>
                <th scope="col" className="num">Kapitał</th>
                <th scope="col" className="num">Odsetki</th>
                <th scope="col" className="num">Nadpłata</th>
                <th scope="col" className="num">Koszty dodatkowe</th>
                <th scope="col" className="num">Saldo</th>
              </tr>
            </thead>
            {yearSections.map((section) => {
              const isOpen = isYearOpen(section.year)

              return (
                <tbody key={section.year} className={isOpen ? 'year-section is-open' : 'year-section'}>
                  <tr className="year-row">
                    <th scope="rowgroup" className="year-cell">
                      <button
                        type="button"
                        className="year-toggle"
                        aria-expanded={isOpen}
                        onClick={() => toggleYear(section.year)}
                      >
                        <span aria-hidden="true">{isOpen ? '−' : '+'}</span> {section.year}
                      </button>
                    </th>
                    <td className="num year-blank" aria-hidden="true" />
                    <td className="num" data-label="Rata">{formatCurrency(section.totals.payment)}</td>
                    <td className="num" data-label="Kapitał">{formatCurrency(section.totals.principal)}</td>
                    <td className="num" data-label="Odsetki">{formatCurrency(section.totals.interest)}</td>
                    <td className="num" data-label="Nadpłata">{formatMoneyOrDash(section.totals.extraPayment)}</td>
                    <td className="num" data-label="Koszty dodatkowe">{formatMoneyOrDash(section.totals.additionalCosts)}</td>
                    <td className="num" data-label="Saldo na koniec roku">{formatCurrency(section.endBalance)}</td>
                  </tr>
                  {section.rows.map((row) => (
                    <tr
                      key={`${row.year}-${row.month}`}
                      className={row.events.length > 0 ? 'schedule-row has-event' : 'schedule-row'}
                      hidden={!isOpen}
                    >
                      <td data-label="Miesiąc">
                        {capitalize(row.monthLabel)}
                        {row.events.length > 0 ? (
                          <span className="row-events">
                            {row.events.map((event) => (
                              <span key={event.key} className={`event-tag event-${event.key}`}>
                                {event.label}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={row.rateChanged ? 'num' : 'num is-unchanged'}
                        data-label="Oprocentowanie"
                      >
                        {formatPercent(row.annualRate)}
                      </td>
                      <td className="num" data-label="Rata">{formatCurrency(row.payment)}</td>
                      <td className="num" data-label="Kapitał">{formatCurrency(row.principal)}</td>
                      <td className="num" data-label="Odsetki">{formatCurrency(row.interest)}</td>
                      <td className="num" data-label="Nadpłata">{formatMoneyOrDash(row.extraPayment)}</td>
                      <td className="num" data-label="Koszty dodatkowe">{formatMoneyOrDash(row.additionalCosts)}</td>
                      <td className="num" data-label="Saldo">{formatCurrency(row.remainingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              )
            })}
            <tfoot>
              <tr className="schedule-total-row">
                <th scope="row">Razem</th>
                <td className="num year-blank" aria-hidden="true" />
                <td className="num" data-label="Rata">{formatCurrency(scheduleTotals.payment)}</td>
                <td className="num" data-label="Kapitał">{formatCurrency(scheduleTotals.principal)}</td>
                <td className="num" data-label="Odsetki">{formatCurrency(scheduleTotals.interest)}</td>
                <td className="num" data-label="Nadpłata">{formatMoneyOrDash(scheduleTotals.extraPayment)}</td>
                <td className="num" data-label="Koszty dodatkowe">{formatMoneyOrDash(scheduleTotals.additionalCosts)}</td>
                <td className="num" data-label="Saldo" aria-hidden="true" />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>

    <footer className="site-footer">
      <p>
        Wyniki mają charakter orientacyjny i nie stanowią oferty w rozumieniu Kodeksu Cywilnego.
        Rzeczywiste warunki kredytu ustala bank.
      </p>
    </footer>

    <a className="mobile-summary-bar" href="#podsumowanie">
      <span>
        <small>{paymentLabel}</small>
        <strong>{formatCurrency(firstPayment)}</strong>
      </span>
      <span className="mobile-summary-link">Podsumowanie</span>
    </a>
    {confirmRequest ? (
      <ConfirmDialog
        request={confirmRequest}
        onCancel={() => setConfirmRequest(null)}
        onConfirm={() => {
          setConfirmRequest(null)
          confirmRequest.onConfirm()
        }}
      />
    ) : null}
    </>
  )
}

export default App
