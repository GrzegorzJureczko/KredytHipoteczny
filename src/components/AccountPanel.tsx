import { formatCurrency, formatPercent, pluralize } from '../format'
import type { AccountState } from '../hooks/useAccount'
import { getSavedDateLabel } from '../savedEntries'

export const AccountPanel = ({ account }: { account: AccountState }) => {
  const {
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
    handleAuthSubmit,
    handleLogout,
    handleSaveCurrentCalculationClick,
    saveNewCalculation,
    handleLoadSavedCalculation,
    startNewCalculation,
    handleDeleteSavedCalculation,
    startRename,
    submitRename,
  } = account

  return (
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
          className={authMessage.type === 'success' ? 'auth-message success' : 'auth-message error'}
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
            <p className="empty-state">
              Brak zapisanych kalkulacji. Zapisz bieżący scenariusz, aby wrócić do niego później.
            </p>
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
                          {formatCurrency(entrySummary.amount)} · {entrySummary.years}{' '}
                          {pluralize(entrySummary.years, 'rok', 'lata', 'lat')} ·{' '}
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
  )
}
