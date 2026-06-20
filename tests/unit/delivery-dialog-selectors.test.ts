import { describe, expect, it } from 'vitest'
import { DELIVERY_INPUT_SELECTOR, DELIVERY_SUBMIT_SELECTOR } from '../../src/capture/browser'

describe('delivery dialog selectors', () => {
  it('matches the legacy GLUX controls', () => {
    document.body.innerHTML = `
      <input id="GLUXZipUpdateInput">
      <button id="GLUXZipUpdate">Apply</button>
    `
    expect(document.querySelector(DELIVERY_INPUT_SELECTOR)).not.toBeNull()
    expect(document.querySelector(DELIVERY_SUBMIT_SELECTOR)).not.toBeNull()
  })

  it('matches accessible postal controls used by newer dialogs', () => {
    document.body.innerHTML = `
      <input autocomplete="postal-code" aria-label="Enter a US ZIP code">
      <button aria-label="Apply ZIP code">Apply</button>
    `
    expect(document.querySelector(DELIVERY_INPUT_SELECTOR)).not.toBeNull()
    expect(document.querySelector(DELIVERY_SUBMIT_SELECTOR)).not.toBeNull()
  })
})
