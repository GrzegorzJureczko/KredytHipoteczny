/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })

const readBytes = (blob: Blob) =>
  new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })

describe('schedule export and print', () => {
  const createObjectURL = vi.fn((_blob: Blob) => 'blob:schedule')
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
  })

  it('downloads the schedule as a UTF-8 CSV file', async () => {
    const downloads: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download)
    })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Pobierz CSV' }))

    expect(downloads).toEqual(['harmonogram-splat.csv'])
    expect(createObjectURL).toHaveBeenCalledTimes(1)

    const blob = createObjectURL.mock.calls[0][0]
    const text = await readBlob(blob)

    expect(blob.type).toContain('text/csv')
    expect(Array.from((await readBytes(blob)).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    expect(text.startsWith('Miesiąc;Oprocentowanie (%);Rata')).toBe(true)
    expect(text).toContain('\r\nRazem;')
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:schedule'))
  })

  it('opens the print dialog', () => {
    const print = vi.fn()
    window.print = print
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Drukuj' }))

    expect(print).toHaveBeenCalledTimes(1)
  })

  it('exports every year of the schedule, including collapsed ones', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Pobierz CSV' }))
    const text = await readBlob(createObjectURL.mock.calls[0][0])
    const monthRows = text.split('\r\n').filter((line) => /^[^;]+ \d{4};/.test(line))

    expect(monthRows).toHaveLength(360)
  })
})
