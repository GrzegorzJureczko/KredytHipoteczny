import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
// Must load before the Supabase client, which clears the URL fragment during start-up.
import {
  clearAuthRedirectFromUrl,
  getAuthRedirectErrorMessage,
  initialAuthRedirect,
} from '../authRedirect'
import { calculateLoanSummary } from '../calculator'
import { getAuthErrorMessage } from '../authError'
import type { ConfirmRequest } from '../components/ConfirmDialog'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { buildLoanInput, initialForm, payloadToFormState, type FormState } from '../loanForm'
import { getSavedActivityStamp, type SavedCalculationEntry } from '../savedEntries'
import { getLegacyLoanStartDate, normalizeSavedCalculationPayload } from '../savedCalculations'

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const isEmailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export type AuthMode = 'login' | 'register' | 'reset'

export const useAccount = (form: FormState, setForm: Dispatch<SetStateAction<FormState>>) => {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
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
  const [savedCalculationsExpanded, setSavedCalculationsExpanded] = useState(false)
  const [lastSavedForm, setLastSavedForm] = useState<FormState>(initialForm)
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string }>(() =>
    initialAuthRedirect?.kind === 'error'
      ? { type: 'error', text: getAuthRedirectErrorMessage(initialAuthRedirect) }
      : { type: 'success', text: '' },
  )
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(
    () => initialAuthRedirect?.kind === 'recovery',
  )
  const [isAuthMessageVisible, setIsAuthMessageVisible] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(lastSavedForm)
  const shouldWarnAboutChanges = Boolean(currentUserEmail) && hasUnsavedChanges

  useEffect(() => {
    if (initialAuthRedirect?.kind === 'error') {
      clearAuthRedirectFromUrl()
    }
  }, [])

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
    } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveringPassword(true)
      }

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

  const handlePasswordUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!supabase || !isSupabaseConfigured) {
      setAuthMessage({ type: 'error', text: 'Brakuje konfiguracji Supabase.' })
      return
    }

    if (authPassword.length < 6) {
      setAuthMessage({ type: 'error', text: 'Hasło musi mieć co najmniej 6 znaków.' })
      return
    }

    if (authPassword !== authConfirmPassword) {
      setAuthMessage({ type: 'error', text: 'Hasła nie są zgodne.' })
      return
    }

    const { error } = await supabase.auth.updateUser({ password: authPassword })

    if (error) {
      setAuthMessage({ type: 'error', text: getAuthErrorMessage(error) })
      return
    }

    setAuthPassword('')
    setAuthConfirmPassword('')
    setIsRecoveringPassword(false)
    setAuthMessage({ type: 'success', text: 'Hasło zostało zmienione.' })
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

  return {
    authMode,
    setAuthMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authConfirmPassword,
    setAuthConfirmPassword,
    authMessage,
    isAuthMessageVisible,
    isRecoveringPassword,
    currentUserEmail,
    saveDraftName,
    setSaveDraftName,
    savedCalculations,
    savedCalculationSummaries,
    invalidSavedCount,
    activeCalculation,
    renamingId,
    setRenamingId,
    renameValue,
    setRenameValue,
    nameInputRef,
    savedCalculationsExpanded,
    setSavedCalculationsExpanded,
    hasUnsavedChanges,
    isSaveButtonInactive,
    confirmRequest,
    setConfirmRequest,
    discardChangesThen,
    handleAuthSubmit,
    handlePasswordUpdate,
    handleLogout,
    handleSaveCurrentCalculationClick,
    saveNewCalculation,
    handleLoadSavedCalculation,
    startNewCalculation,
    handleDeleteSavedCalculation,
    startRename,
    submitRename,
  }
}

export type AccountState = ReturnType<typeof useAccount>
