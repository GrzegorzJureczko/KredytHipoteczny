import { useEffect, useRef } from 'react'

export type ConfirmRequest = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
}

export const ConfirmDialog = ({
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
