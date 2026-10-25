import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { formatMoneyDraft, sanitizeMoneyInput } from '../format'

type UnitInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onBlur' | 'type'
> & {
  unit: string
  value: number
  onValueChange?: (value: number) => void
}

export const UnitInput = ({
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
