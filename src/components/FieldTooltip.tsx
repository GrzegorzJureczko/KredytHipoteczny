import { useEffect, useRef, useState } from 'react'

export const FieldTooltip = ({ id, text }: { id: string; text: string }) => {
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
